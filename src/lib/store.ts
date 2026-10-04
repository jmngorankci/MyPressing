'use client';

import { useSyncExternalStore, useState, useEffect, useCallback } from 'react';
import {
  initialSettings,
  initialCategories,
  initialServices,
  initialArticles,
  initialClients,
  initialOrders,
  DEFAULT_ORG_ID,
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
  STATE: 'mypressing_state_v6',
  QUEUE: 'mypressing_offline_queue_v6',
  PREV_STATE: 'mypressing_state_v5',
};

// Générateur d'UUID compatible v4 pour PostgreSQL / Supabase
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
    const rawState = localStorage.getItem(STORAGE_KEYS.STATE) || localStorage.getItem(STORAGE_KEYS.PREV_STATE);
    if (rawState) {
      const parsed = JSON.parse(rawState);
      const mergedSettings: Settings = {
        ...initialSettings,
        ...(parsed.settings || {}),
        organization_id: parsed.settings?.organization_id || initialSettings.organization_id || DEFAULT_ORG_ID,
        primary_color: parsed.settings?.primary_color || initialSettings.primary_color || '#2563eb',
        ticket_header: parsed.settings?.ticket_header || initialSettings.ticket_header,
        ticket_footer: parsed.settings?.ticket_footer || initialSettings.ticket_footer,
      };

      memoryState = {
        settings: mergedSettings,
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

// Variable pour s'assurer que le chargement local ne se fait qu'une fois
let hasLoadedLocal = false;

export function usePressingStore() {
  const storeState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [mounted, setMounted] = useState(false);

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock-pressing')
  );

  useEffect(() => {
    setMounted(true);
    if (!hasLoadedLocal) {
      hasLoadedLocal = true;
      loadLocal();
      notifyListeners();
    }
  }, []);

  const activeState = mounted ? storeState : initialServerState;

  // Synchronisation descendante : récupération depuis Supabase
  const fetchFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured || !navigator.onLine) return;

    try {
      const supabase = createSupabaseClient() as any;

      const [
        { data: sbSettings },
        { data: sbCategories },
        { data: sbServices },
        { data: sbArticles },
        { data: sbClients },
        { data: sbOrders },
      ] = await Promise.all([
        supabase.from('settings').select('*').limit(1).maybeSingle(),
        supabase.from('categories').select('*').order('display_order', { ascending: true }),
        supabase.from('services').select('*'),
        supabase.from('articles').select('*').order('created_at', { ascending: true }),
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select(`
          *,
          client:clients (*),
          items:order_items (*),
          payments:payments (*)
        `).order('created_at', { ascending: false }),
      ]);

      let hasChanges = false;
      const newState = { ...memoryState };

      if (sbSettings) {
        newState.settings = sbSettings;
        hasChanges = true;
      }
      if (sbCategories && sbCategories.length > 0) {
        newState.categories = sbCategories;
        hasChanges = true;
      }
      if (sbServices && sbServices.length > 0) {
        newState.services = sbServices;
        hasChanges = true;
      }
      if (sbArticles && sbArticles.length > 0) {
        newState.articles = sbArticles;
        hasChanges = true;
      }
      if (sbClients && sbClients.length > 0) {
        newState.clients = sbClients;
        hasChanges = true;
      }
      if (sbOrders && sbOrders.length > 0) {
        newState.orders = sbOrders;
        hasChanges = true;
      }

      if (hasChanges) {
        memoryState = newState;
        persistLocal();
        notifyListeners();
      }
      setLastSyncTime(new Date().toLocaleTimeString('fr-FR'));
    } catch (err) {
      console.warn('[SUPABASE] Erreur lors de la récupération initiale:', err);
    }
  }, [isSupabaseConfigured]);

  // Synchronisation montante : envoi de la file d'attente vers Supabase
  const triggerSync = useCallback(async () => {
    if (!isSupabaseConfigured) return { success: true, count: 0 };
    setIsSyncing(true);

    try {
      const supabase = createSupabaseClient() as any;

      if (offlineQueue.length > 0 && navigator.onLine) {
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
        offlineQueue = [];
      }

      // Recharger les données fraîches depuis Supabase
      await fetchFromSupabase();

      persistLocal();
      notifyListeners();
      setLastSyncTime(new Date().toLocaleTimeString('fr-FR'));
      return { success: true, count: offlineQueue.length };
    } catch (err) {
      console.warn('Sync failed (will retry):', err);
      return { success: false, error: err };
    } finally {
      setIsSyncing(false);
    }
  }, [fetchFromSupabase, isSupabaseConfigured]);

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

      // Chargement initial depuis Supabase au montage
      if (isSupabaseConfigured && navigator.onLine) {
        fetchFromSupabase();
      }

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [fetchFromSupabase, isSupabaseConfigured, triggerSync]);

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
      const currentOrgId = memoryState.settings.organization_id || DEFAULT_ORG_ID;

      let client = memoryState.clients.find(
        (c) => c.phone.trim().replace(/\s+/g, '') === params.client.phone.trim().replace(/\s+/g, '')
      );

      let updatedClients = memoryState.clients;
      if (!client) {
        client = {
          id: (params.client.id && params.client.id.length > 25 && !params.client.id.startsWith('cli-'))
            ? params.client.id
            : generateUuid(),
          organization_id: currentOrgId,
          name: params.client.name,
          phone: params.client.phone,
          address: params.client.address || '',
          notes: params.client.notes || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        updatedClients = [client, ...memoryState.clients];
      }

      const activeClient: Client = client;

      const totalAmount = params.items.reduce((sum, item) => sum + item.totalPrice, 0);
      const remainingAmount = Math.max(0, totalAmount - params.advanceAmount);
      const paymentStatus =
        remainingAmount === 0 ? 'paid' : params.advanceAmount > 0 ? 'partially_paid' : 'unpaid';

      const orderCounter = memoryState.orders.length + 42;
      const orderNumber = `PRS-2026-${String(orderCounter).padStart(4, '0')}`;
      const orderId = generateUuid();
      const qrCodeValue = `${orderNumber}|${activeClient.phone}|${totalAmount}`;

      const orderItems: OrderItem[] = params.items.map((item) => ({
        id: generateUuid(),
        organization_id: currentOrgId,
        order_id: orderId,
        article_id: (item.articleId && item.articleId.length > 25 && !item.articleId.startsWith('custom-') && !item.articleId.startsWith('art-'))
          ? item.articleId
          : null,
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
                id: generateUuid(),
                organization_id: currentOrgId,
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
        organization_id: currentOrgId,
        order_number: orderNumber,
        client_id: activeClient.id,
        client: activeClient,
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

      // Sauvegarde locale instantanée
      memoryState = {
        ...memoryState,
        clients: updatedClients,
        orders: [newOrder, ...memoryState.orders],
      };

      // Si Supabase est connecté et en ligne, insertion directe
      if (isSupabaseConfigured && navigator.onLine) {
        try {
          const supabase = createSupabaseClient() as any;
          await supabase.from('clients').upsert({
            ...activeClient,
            organization_id: activeClient.organization_id || currentOrgId,
          });
          await supabase.from('orders').insert({
            id: newOrder.id,
            organization_id: newOrder.organization_id,
            order_number: newOrder.order_number,
            client_id: activeClient.id,
            status: newOrder.status,
            total_amount: newOrder.total_amount,
            advance_amount: newOrder.advance_amount,
            remaining_amount: newOrder.remaining_amount,
            payment_status: newOrder.payment_status,
            payment_method: newOrder.payment_method,
            pickup_date: newOrder.pickup_date,
            is_express: newOrder.is_express,
            notes: newOrder.notes,
            qr_code: newOrder.qr_code,
            notification_sent: newOrder.notification_sent,
          });
          if (orderItems.length > 0) {
            await supabase.from('order_items').insert(orderItems);
          }
          if (payments.length > 0) {
            await supabase.from('payments').insert(payments);
          }
        } catch (dbErr) {
          console.warn('[SUPABASE] Insertion directe échouée, mise en file d\'attente:', dbErr);
          offlineQueue.push({
            id: `act-${Date.now()}`,
            type: 'CREATE_ORDER',
            payload: { order: newOrder, client, items: orderItems },
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        offlineQueue.push({
          id: `act-${Date.now()}`,
          type: 'CREATE_ORDER',
          payload: { order: newOrder, client, items: orderItems },
          timestamp: new Date().toISOString(),
        });
      }

      persistLocal();
      notifyListeners();

      return newOrder;
    },
    [isSupabaseConfigured]
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

      if (isSupabaseConfigured && navigator.onLine) {
        try {
          const supabase = createSupabaseClient() as any;
          await supabase
            .from('orders')
            .update({
              status: newStatus,
              notification_sent: updatedOrder.notification_sent,
              notification_sent_at: updatedOrder.notification_sent_at,
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);
        } catch (err) {
          offlineQueue.push({
            id: `act-${Date.now()}`,
            type: 'UPDATE_STATUS',
            payload: { orderId, status: newStatus },
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        offlineQueue.push({
          id: `act-${Date.now()}`,
          type: 'UPDATE_STATUS',
          payload: { orderId, status: newStatus },
          timestamp: new Date().toISOString(),
        });
      }

      persistLocal();
      notifyListeners();

      return { order: updatedOrder, notificationTriggered, notificationDetails };
    },
    [isSupabaseConfigured]
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

      const currentOrgId = memoryState.settings.organization_id || DEFAULT_ORG_ID;

      const newPayment: Payment = {
        id: `pay-${Date.now()}`,
        organization_id: order.organization_id || currentOrgId,
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

      if (isSupabaseConfigured && navigator.onLine) {
        try {
          const supabase = createSupabaseClient() as any;
          await supabase.from('payments').insert(newPayment);
          await supabase
            .from('orders')
            .update({
              status: 'delivered',
              advance_amount: newAdvance,
              remaining_amount: newRemaining,
              payment_status: newPaymentStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', params.orderId);
        } catch (err) {
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
        }
      } else {
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
      }

      persistLocal();
      notifyListeners();

      return updatedOrder;
    },
    [isSupabaseConfigured]
  );

  // 4. CRÉATION OU MODIFICATION D'UN CLIENT
  const saveClient = useCallback(
    (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'organization_id'> & { id?: string; organization_id?: string }) => {
      const existingIndex = memoryState.clients.findIndex((c) => c.id === clientData.id);
      const currentOrgId = memoryState.settings.organization_id || DEFAULT_ORG_ID;
      let client: Client;
      let updatedClients: Client[];

      if (existingIndex >= 0) {
        client = {
          ...memoryState.clients[existingIndex],
          ...clientData,
          organization_id: memoryState.clients[existingIndex].organization_id || currentOrgId,
          updated_at: new Date().toISOString(),
        };
        updatedClients = memoryState.clients.map((c, idx) => (idx === existingIndex ? client : c));
      } else {
        client = {
          ...clientData,
          id: (clientData.id && clientData.id.length > 25 && !clientData.id.startsWith('cli-'))
            ? clientData.id
            : generateUuid(),
          organization_id: currentOrgId,
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

      if (isSupabaseConfigured && navigator.onLine) {
        const supabase = createSupabaseClient() as any;
        supabase.from('clients').upsert({
          id: client.id,
          organization_id: client.organization_id,
          name: client.name,
          phone: client.phone,
          address: client.address,
          notes: client.notes,
        }).then((res: any) => {
          if (res.error) console.error('[SUPABASE] Erreur client:', res.error);
        });
      }

      persistLocal();
      notifyListeners();
      return client;
    },
    [isSupabaseConfigured]
  );

  // 5. GESTION DES TARIFS & ARTICLES (PARAMÈTRES CRUD)
  const saveArticle = useCallback(
    (articleData: Partial<Article> & { name: string; base_price: number; category_id: string }) => {
      const existingIndex = articleData.id
        ? memoryState.articles.findIndex((a) => a.id === articleData.id)
        : -1;
      const currentOrgId = memoryState.settings.organization_id || DEFAULT_ORG_ID;
      let article: Article;
      let updatedArticles: Article[];

      const validCategory =
        articleData.category_id && articleData.category_id.length > 25 && !articleData.category_id.startsWith('cat-')
          ? articleData.category_id
          : (memoryState.categories[0]?.id || 'c1111111-1111-1111-1111-111111111111');

      if (existingIndex >= 0) {
        article = {
          ...memoryState.articles[existingIndex],
          ...articleData,
          organization_id: memoryState.articles[existingIndex].organization_id || currentOrgId,
          category_id: validCategory,
          base_price: Number(articleData.base_price),
        };
        updatedArticles = memoryState.articles.map((a, idx) => (idx === existingIndex ? article : a));
      } else {
        article = {
          id: (articleData.id && articleData.id.length > 25 && !articleData.id.startsWith('art-'))
            ? articleData.id
            : generateUuid(),
          organization_id: currentOrgId,
          category_id: validCategory,
          name: articleData.name.trim(),
          base_price: Number(articleData.base_price),
          icon: articleData.icon || 'shirt',
          is_active: articleData.is_active !== undefined ? articleData.is_active : true,
          created_at: new Date().toISOString(),
        };
        updatedArticles = [article, ...memoryState.articles];
      }

      memoryState = {
        ...memoryState,
        articles: updatedArticles,
      };

      if (isSupabaseConfigured && navigator.onLine) {
        const supabase = createSupabaseClient() as any;
        supabase.from('articles').upsert({
          id: article.id,
          organization_id: article.organization_id,
          category_id: article.category_id,
          name: article.name,
          base_price: article.base_price,
          icon: article.icon,
          is_active: article.is_active,
        }).then((res: any) => {
          if (res.error) console.error('[SUPABASE] Erreur ajout article:', res.error);
          else console.log('[SUPABASE] Article enregistré avec succès:', article.name);
        });
      } else {
        offlineQueue.push({
          id: `act-${Date.now()}`,
          type: 'UPDATE_ARTICLE',
          payload: article,
          timestamp: new Date().toISOString(),
        });
      }

      persistLocal();
      notifyListeners();

      return article;
    },
    [isSupabaseConfigured]
  );

  const deleteArticle = useCallback((articleId: string) => {
    memoryState = {
      ...memoryState,
      articles: memoryState.articles.filter((a) => a.id !== articleId),
    };
    if (isSupabaseConfigured && navigator.onLine) {
      const supabase = createSupabaseClient() as any;
      supabase.from('articles').delete().eq('id', articleId).then();
    }
    persistLocal();
    notifyListeners();
  }, [isSupabaseConfigured]);

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

    if (isSupabaseConfigured && navigator.onLine) {
      const supabase = createSupabaseClient() as any;
      supabase.from('settings').upsert(memoryState.settings).then();
    }

    persistLocal();
    notifyListeners();
    return memoryState.settings;
  }, [isSupabaseConfigured]);

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
    // États
    settings: activeState.settings,
    categories: activeState.categories,
    services: activeState.services,
    articles: activeState.articles,
    clients: activeState.clients,
    orders: activeState.orders,
    isMounted: mounted,
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
    fetchFromSupabase,
    resetToDemoData,
  };
}
