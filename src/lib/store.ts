'use client';

import { useSyncExternalStore, useState, useEffect, useCallback } from 'react';
import {
  initialSettings,
  initialCategories,
  initialServices,
  initialArticles,
  initialClients,
  initialOrders,
} from './initialData';
import {
  Client,
  Category,
  Article,
  Service,
  OrderWithDetails,
  Settings,
  OrderStatus,
  PaymentMethod,
  OrderItem,
  Payment,
} from '@/types/database';
import { createClient as createSupabaseClient } from './supabase/client';

const STORAGE_KEYS = {
  STATE: 'mypressing_state_v2',
  QUEUE: 'mypressing_offline_queue_v2',
};

interface OfflineAction {
  id: string;
  type: 'CREATE_ORDER' | 'UPDATE_STATUS' | 'RECORD_PAYMENT' | 'SAVE_CLIENT' | 'UPDATE_ARTICLE' | 'SAVE_SETTINGS';
  payload: any;
  timestamp: string;
}

export interface PressingState {
  settings: Settings;
  categories: Category[];
  services: Service[];
  articles: Article[];
  clients: Client[];
  orders: OrderWithDetails[];
}

const initialServerState: PressingState = {
  settings: initialSettings,
  categories: initialCategories,
  services: initialServices,
  articles: initialArticles,
  clients: initialClients,
  orders: initialOrders,
};

// Singleton state en mémoire
let memoryState: PressingState = {
  settings: initialSettings,
  categories: initialCategories,
  services: initialServices,
  articles: initialArticles,
  clients: initialClients,
  orders: initialOrders,
};

let offlineQueue: OfflineAction[] = [];
let listeners: Array<() => void> = [];

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('Listener notification error:', err);
    }
  });
}

function subscribe(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function getSnapshot(): PressingState {
  return memoryState;
}

function getServerSnapshot(): PressingState {
  return initialServerState;
}

// Sauvegarde synchrone dans localStorage
function persistLocal() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(memoryState));
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(offlineQueue));
  } catch (err) {
    console.warn('LocalStorage error:', err);
  }
}

// Chargement initial depuis localStorage
function loadLocal() {
  if (typeof window === 'undefined') return;
  try {
    const rawState = localStorage.getItem(STORAGE_KEYS.STATE);
    if (rawState) {
      const parsed = JSON.parse(rawState);
      memoryState = {
        settings: parsed.settings || initialSettings,
        categories: parsed.categories?.length ? parsed.categories : initialCategories,
        services: parsed.services?.length ? parsed.services : initialServices,
        articles: parsed.articles?.length ? parsed.articles : initialArticles,
        clients: parsed.clients?.length ? parsed.clients : initialClients,
        orders: parsed.orders?.length ? parsed.orders : initialOrders,
      };
    }
    const rawQueue = localStorage.getItem(STORAGE_KEYS.QUEUE);
    if (rawQueue) {
      offlineQueue = JSON.parse(rawQueue);
    }
  } catch (err) {
    console.error('Erreur chargement local:', err);
  }
}

// Initialiser le state côté client au démarrage du module
if (typeof window !== 'undefined') {
  loadLocal();
}

export function usePressingStore() {
  const storeState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => {
        setIsOnline(true);
        triggerSync();
      };
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Déclencheur de synchronisation hors-ligne -> Supabase
  const triggerSync = useCallback(async () => {
    if (offlineQueue.length === 0) return { success: true, count: 0 };
    setIsSyncing(true);

    try {
      const supabase = createSupabaseClient() as any;
      const isSupabaseConfigured =
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock-pressing');

      if (isSupabaseConfigured && navigator.onLine) {
        for (const action of [...offlineQueue]) {
          if (action.type === 'CREATE_ORDER') {
            const { order, client, items } = action.payload;
            await supabase.from('clients').upsert(client);
            await supabase.from('orders').upsert({
              id: order.id,
              order_number: order.order_number,
              client_id: order.client_id,
              status: order.status,
              total_amount: order.total_amount,
              advance_amount: order.advance_amount,
              remaining_amount: order.remaining_amount,
              payment_status: order.payment_status,
              payment_method: order.payment_method,
              pickup_date: order.pickup_date,
              is_express: order.is_express,
              notes: order.notes,
              qr_code: order.qr_code,
              notification_sent: order.notification_sent,
            });
            if (items && items.length) {
              await supabase.from('order_items').upsert(items);
            }
          } else if (action.type === 'UPDATE_STATUS') {
            await supabase
              .from('orders')
              .update({ status: action.payload.status, updated_at: new Date().toISOString() })
              .eq('id', action.payload.orderId);
          } else if (action.type === 'RECORD_PAYMENT') {
            await supabase.from('payments').insert(action.payload.payment);
            await supabase
              .from('orders')
              .update({
                advance_amount: action.payload.advance_amount,
                remaining_amount: action.payload.remaining_amount,
                payment_status: action.payload.payment_status,
                status: action.payload.status,
              })
              .eq('id', action.payload.orderId);
          } else if (action.type === 'UPDATE_ARTICLE') {
            await supabase.from('articles').upsert(action.payload);
          }
        }
      }

      const count = offlineQueue.length;
      offlineQueue = [];
      persistLocal();
      setLastSyncTime(new Date().toLocaleTimeString('fr-FR'));
      notifyListeners();
      return { success: true, count };
    } catch (err) {
      console.warn('Sync failed (will retry):', err);
      return { success: false, error: err };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // 1. CRÉATION D'UNE COMMANDE AU GUICHET (RÉCEPTION)
  const createOrder = useCallback(
    async (params: {
      client: { id?: string; name: string; phone: string; address?: string | null; notes?: string | null };
      items: Array<{
        articleId: string;
        articleName: string;
        serviceCode: 'wash' | 'iron' | 'full' | 'express';
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        notes?: string;
      }>;
      advanceAmount: number;
      paymentMethod: PaymentMethod;
      pickupDate: string;
      isExpress: boolean;
      notes?: string;
    }) => {
      let client = memoryState.clients.find(
        (c) => c.phone.trim().replace(/\s+/g, '') === params.client.phone.trim().replace(/\s+/g, '')
      );

      let updatedClients = memoryState.clients;
      if (!client) {
        client = {
          id: params.client.id || `cli-${Date.now()}`,
          name: params.client.name,
          phone: params.client.phone,
          address: params.client.address || '',
          notes: params.client.notes || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        updatedClients = [client, ...memoryState.clients];
      }

      const totalAmount = params.items.reduce((sum, item) => sum + item.totalPrice, 0);
      const remainingAmount = Math.max(0, totalAmount - params.advanceAmount);
      const paymentStatus =
        remainingAmount === 0 ? 'paid' : params.advanceAmount > 0 ? 'partially_paid' : 'unpaid';

      const orderCounter = memoryState.orders.length + 42;
      const orderNumber = `PRS-2026-${String(orderCounter).padStart(4, '0')}`;
      const orderId = `ord-${Date.now()}`;
      const qrCodeValue = `${orderNumber}|${client.phone}|${totalAmount}`;

      const orderItems: OrderItem[] = params.items.map((item, idx) => ({
        id: `item-${orderId}-${idx + 1}`,
        order_id: orderId,
        article_id: item.articleId,
        article_name: item.articleName,
        service_code: item.serviceCode,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
        notes: item.notes || null,
        created_at: new Date().toISOString(),
      }));

      const payments: Payment[] =
        params.advanceAmount > 0
          ? [
              {
                id: `pay-${Date.now()}`,
                order_id: orderId,
                amount: params.advanceAmount,
                payment_method: params.paymentMethod,
                amount_received: params.advanceAmount,
                change_returned: 0,
                reference: `${params.paymentMethod.toUpperCase()}-DEP-${Date.now().toString().slice(-4)}`,
                cashier_note: 'Acompte versé au guichet',
                created_at: new Date().toISOString(),
              },
            ]
          : [];

      const newOrder: OrderWithDetails = {
        id: orderId,
        order_number: orderNumber,
        client_id: client.id,
        client,
        status: 'to_process',
        total_amount: totalAmount,
        advance_amount: params.advanceAmount,
        remaining_amount: remainingAmount,
        payment_status: paymentStatus,
        payment_method: params.paymentMethod,
        pickup_date: params.pickupDate,
        is_express: params.isExpress,
        notes: params.notes || null,
        qr_code: qrCodeValue,
        notification_sent: false,
        notification_sent_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: orderItems,
        payments,
      };

      // Mutation immuable du state
      memoryState = {
        ...memoryState,
        clients: updatedClients,
        orders: [newOrder, ...memoryState.orders],
      };

      offlineQueue.push({
        id: `act-${Date.now()}`,
        type: 'CREATE_ORDER',
        payload: { order: newOrder, client, items: orderItems },
        timestamp: new Date().toISOString(),
      });

      persistLocal();
      notifyListeners();

      if (typeof window !== 'undefined' && navigator.onLine) {
        triggerSync();
      }

      return newOrder;
    },
    [triggerSync]
  );

  // 2. MISE À JOUR DE STATUT DANS LE KANBAN ATELIER
  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      const orderIndex = memoryState.orders.findIndex((o) => o.id === orderId);
      if (orderIndex === -1) return null;

      const order = memoryState.orders[orderIndex];
      const previousStatus = order.status;
      const updatedOrder = {
        ...order,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      let notificationTriggered = false;
      let notificationDetails: any = null;

      if (newStatus === 'ready' && previousStatus !== 'ready') {
        const client = updatedOrder.client;
        const shopName = memoryState.settings.shop_name;
        const currency = memoryState.settings.currency;
        const template = memoryState.settings.whatsapp_template || '';

        const message = template
          .replace('{{client_name}}', client.name)
          .replace('{{order_number}}', updatedOrder.order_number)
          .replace('{{shop_name}}', shopName)
          .replace('{{remaining_amount}}', updatedOrder.remaining_amount.toLocaleString('fr-FR'))
          .replace('{{currency}}', currency);

        const cleanPhone = client.phone.replace(/[^0-9]/g, '');
        const directWhatsAppUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

        updatedOrder.notification_sent = true;
        updatedOrder.notification_sent_at = new Date().toISOString();
        notificationTriggered = true;

        notificationDetails = {
          order: updatedOrder,
          client,
          message,
          directWhatsAppUrl,
        };

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('pressing:notify-ready', { detail: notificationDetails })
          );
        }
      }

      const updatedOrders = [...memoryState.orders];
      updatedOrders[orderIndex] = updatedOrder;

      memoryState = {
        ...memoryState,
        orders: updatedOrders,
      };

      offlineQueue.push({
        id: `act-${Date.now()}`,
        type: 'UPDATE_STATUS',
        payload: { orderId, status: newStatus },
        timestamp: new Date().toISOString(),
      });

      persistLocal();
      notifyListeners();

      if (typeof window !== 'undefined' && navigator.onLine) {
        triggerSync();
      }

      return { order: updatedOrder, notificationTriggered, notificationDetails };
    },
    [triggerSync]
  );

  // 3. ENCAISSEMENT ET RETRAIT DU LINGE EN CAISSE
  const checkoutAndDeliverOrder = useCallback(
    async (params: {
      orderId: string;
      amountToPay: number;
      paymentMethod: PaymentMethod;
      amountReceived: number;
      changeReturned: number;
      cashierNote?: string;
    }) => {
      const orderIndex = memoryState.orders.findIndex((o) => o.id === params.orderId);
      if (orderIndex === -1) return null;

      const order = memoryState.orders[orderIndex];
      const newAdvance = order.advance_amount + params.amountToPay;
      const newRemaining = Math.max(0, order.total_amount - newAdvance);
      const newPaymentStatus = newRemaining === 0 ? 'paid' : 'partially_paid';

      const newPayment: Payment = {
        id: `pay-${Date.now()}`,
        order_id: params.orderId,
        amount: params.amountToPay,
        payment_method: params.paymentMethod,
        amount_received: params.amountReceived,
        change_returned: params.changeReturned,
        reference: `${params.paymentMethod.toUpperCase()}-RETRAIT-${Date.now().toString().slice(-4)}`,
        cashier_note: params.cashierNote || 'Règlement final au retrait',
        created_at: new Date().toISOString(),
      };

      const updatedOrder: OrderWithDetails = {
        ...order,
        status: 'delivered',
        advance_amount: newAdvance,
        remaining_amount: newRemaining,
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString(),
        payments: [...(order.payments || []), newPayment],
      };

      const updatedOrders = [...memoryState.orders];
      updatedOrders[orderIndex] = updatedOrder;

      memoryState = {
        ...memoryState,
        orders: updatedOrders,
      };

      offlineQueue.push({
        id: `act-${Date.now()}`,
        type: 'RECORD_PAYMENT',
        payload: {
          orderId: params.orderId,
          payment: newPayment,
          advance_amount: newAdvance,
          remaining_amount: newRemaining,
          payment_status: newPaymentStatus,
          status: 'delivered',
        },
        timestamp: new Date().toISOString(),
      });

      persistLocal();
      notifyListeners();

      if (typeof window !== 'undefined' && navigator.onLine) {
        triggerSync();
      }

      return updatedOrder;
    },
    [triggerSync]
  );

  // 4. CRÉATION OU MODIFICATION D'UN CLIENT
  const saveClient = useCallback(
    (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => {
      const existingIndex = memoryState.clients.findIndex((c) => c.id === clientData.id);
      let client: Client;
      let updatedClients: Client[];

      if (existingIndex >= 0) {
        client = {
          ...memoryState.clients[existingIndex],
          ...clientData,
          updated_at: new Date().toISOString(),
        };
        updatedClients = memoryState.clients.map((c, idx) => (idx === existingIndex ? client : c));
      } else {
        client = {
          ...clientData,
          id: clientData.id || `cli-${Date.now()}`,
          address: clientData.address || null,
          notes: clientData.notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        updatedClients = [client, ...memoryState.clients];
      }

      memoryState = {
        ...memoryState,
        clients: updatedClients,
      };

      persistLocal();
      notifyListeners();
      return client;
    },
    []
  );

  // 5. GESTION DES TARIFS & ARTICLES (PARAMÈTRES CRUD)
  const saveArticle = useCallback(
    (articleData: Partial<Article> & { name: string; base_price: number; category_id: string }) => {
      const existingIndex = articleData.id
        ? memoryState.articles.findIndex((a) => a.id === articleData.id)
        : -1;
      let article: Article;
      let updatedArticles: Article[];

      if (existingIndex >= 0) {
        article = {
          ...memoryState.articles[existingIndex],
          ...articleData,
          base_price: Number(articleData.base_price),
        };
        updatedArticles = memoryState.articles.map((a, idx) => (idx === existingIndex ? article : a));
      } else {
        article = {
          id: `art-${Date.now()}`,
          category_id: articleData.category_id,
          name: articleData.name.trim(),
          base_price: Number(articleData.base_price),
          icon: articleData.icon || 'Shirt',
          is_active: articleData.is_active !== undefined ? articleData.is_active : true,
          created_at: new Date().toISOString(),
        };
        updatedArticles = [article, ...memoryState.articles];
      }

      memoryState = {
        ...memoryState,
        articles: updatedArticles,
      };

      offlineQueue.push({
        id: `act-${Date.now()}`,
        type: 'UPDATE_ARTICLE',
        payload: article,
        timestamp: new Date().toISOString(),
      });

      persistLocal();
      notifyListeners();

      if (typeof window !== 'undefined' && navigator.onLine) {
        triggerSync();
      }

      return article;
    },
    [triggerSync]
  );

  const deleteArticle = useCallback((articleId: string) => {
    memoryState = {
      ...memoryState,
      articles: memoryState.articles.filter((a) => a.id !== articleId),
    };
    persistLocal();
    notifyListeners();
  }, []);

  // 6. GESTION DES PARAMÈTRES GÉNÉRAUX
  const saveSettings = useCallback((newSettings: Partial<Settings>) => {
    memoryState = {
      ...memoryState,
      settings: {
        ...memoryState.settings,
        ...newSettings,
        updated_at: new Date().toISOString(),
      },
    };

    offlineQueue.push({
      id: `act-${Date.now()}`,
      type: 'SAVE_SETTINGS',
      payload: memoryState.settings,
      timestamp: new Date().toISOString(),
    });

    persistLocal();
    notifyListeners();
    return memoryState.settings;
  }, []);

  // 7. RÉINITIALISATION AUX DONNÉES DÉMO
  const resetToDemoData = useCallback(() => {
    memoryState = {
      settings: initialSettings,
      categories: initialCategories,
      services: initialServices,
      articles: initialArticles,
      clients: initialClients,
      orders: initialOrders,
    };
    offlineQueue = [];
    persistLocal();
    notifyListeners();
  }, []);

  return {
    // États réactifs avec useSyncExternalStore
    settings: storeState.settings,
    categories: storeState.categories,
    services: storeState.services,
    articles: storeState.articles,
    clients: storeState.clients,
    orders: storeState.orders,
    isOnline,
    isSyncing,
    pendingSyncCount: offlineQueue.length,
    lastSyncTime,

    // Actions
    createOrder,
    updateOrderStatus,
    checkoutAndDeliverOrder,
    saveClient,
    saveArticle,
    deleteArticle,
    saveSettings,
    triggerSync,
    resetToDemoData,
  };
}
