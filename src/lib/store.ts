'use client';

import { useSyncExternalStore, useState, useEffect, useCallback } from 'react';
import {
  initialSettings,
  initialCategories,
  initialServices,
  initialArticles,
  initialClients,
  initialOrders,
  initialOrganization,
  demoOrganizations,
  DEFAULT_ORG_ID,
  createDefaultCatalogForOrg,
} from './initialData';
import {
  Client,
  Category,
  Article,
  Service,
  OrderWithDetails,
  Settings,
  Organization,
  OrderStatus,
  PaymentMethod,
  OrderItem,
  Payment,
  MemberRole,
  SubscriptionStatus,
  SubscriptionPlan,
} from '@/types/database';
import { createClient as createSupabaseClient } from './supabase/client';

const STORAGE_KEYS = {
  STATE: 'mypressing_state_v6',
  QUEUE: 'mypressing_offline_queue_v6',
  PREV_STATE: 'mypressing_state_v5',
  ORGS: 'mypressing_organizations_v6',
  ACTIVE_ORG: 'mypressing_active_org_v6',
  ALL_SETTINGS: 'mypressing_all_settings_v6',
  CURRENT_USER: 'mypressing_current_user_v6',
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

// Utilitaire d'upsert tolérant aux schémas distants (bascule automatique en mode legacy si une colonne n'existe pas encore)
async function safeSupabaseUpsert(
  supabase: any,
  table: string,
  fullPayload: any,
  fallbackPayload?: any
) {
  try {
    const res = await supabase.from(table).upsert(fullPayload);
    if (res.error) {
      const isColumnOrSchemaError =
        res.error.code === 'PGRST204' ||
        res.error.code === '42703' ||
        res.error.code === 'PGRST205' ||
        res.error.message?.includes('schema cache') ||
        res.error.message?.includes('column');

      if (isColumnOrSchemaError && fallbackPayload) {
        const fallbackRes = await supabase.from(table).upsert(fallbackPayload);
        if (fallbackRes.error) {
          console.warn(`[SUPABASE] Synchro ${table} (mode legacy):`, fallbackRes.error.message || fallbackRes.error);
          return fallbackRes;
        }
        return fallbackRes;
      }

      console.warn(`[SUPABASE] Synchro ${table}:`, res.error.message || res.error);
      return res;
    }
    return res;
  } catch (err: any) {
    console.warn(`[SUPABASE] Exception ${table}:`, err?.message || err);
    return { error: err };
  }
}

interface OfflineAction {
  id: string;
  type: 'CREATE_ORDER' | 'UPDATE_STATUS' | 'RECORD_PAYMENT' | 'SAVE_CLIENT' | 'UPDATE_ARTICLE' | 'SAVE_SETTINGS';
  payload: any;
  timestamp: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  organization_id?: string;
  isLoggedIn?: boolean;
}

export const defaultCurrentUser: UserSession = {
  id: 'usr-admin-01',
  name: 'Super Admin MyPressing',
  email: 'admin@mypressing.ci',
  role: 'super_admin',
  organization_id: DEFAULT_ORG_ID,
  isLoggedIn: true,
};

export interface PressingState {
  organizations: Organization[];
  currentOrgId: string;
  allSettings: Record<string, Settings>;
  settings: Settings;
  categories: Category[];
  services: Service[];
  articles: Article[];
  clients: Client[];
  orders: OrderWithDetails[];
  currentUser: UserSession;
}

const initialServerState: PressingState = {
  organizations: demoOrganizations,
  currentOrgId: DEFAULT_ORG_ID,
  allSettings: { [DEFAULT_ORG_ID]: initialSettings },
  settings: initialSettings,
  categories: initialCategories,
  services: initialServices,
  articles: initialArticles,
  clients: initialClients,
  orders: initialOrders,
  currentUser: defaultCurrentUser,
};

// Singleton state en mémoire
let memoryState: PressingState = {
  organizations: demoOrganizations,
  currentOrgId: DEFAULT_ORG_ID,
  allSettings: { [DEFAULT_ORG_ID]: initialSettings },
  settings: initialSettings,
  categories: initialCategories,
  services: initialServices,
  articles: initialArticles,
  clients: initialClients,
  orders: initialOrders,
  currentUser: defaultCurrentUser,
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
    localStorage.setItem(STORAGE_KEYS.ORGS, JSON.stringify(memoryState.organizations));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ORG, memoryState.currentOrgId);
    localStorage.setItem(STORAGE_KEYS.ALL_SETTINGS, JSON.stringify(memoryState.allSettings));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(memoryState.currentUser));
  } catch (err) {
    console.warn('LocalStorage error:', err);
  }
}

// Chargement initial depuis localStorage avec support multi-tenant
function loadLocal() {
  if (typeof window === 'undefined') return;
  try {
    // 1. Charger les organisations enregistrées
    let loadedOrgs: Organization[] = demoOrganizations;
    const rawOrgs = localStorage.getItem(STORAGE_KEYS.ORGS);
    if (rawOrgs) {
      try {
        const parsedOrgs = JSON.parse(rawOrgs);
        if (Array.isArray(parsedOrgs) && parsedOrgs.length > 0) {
          loadedOrgs = parsedOrgs.map((org: any) => ({
            ...org,
            is_active: org.is_active !== undefined ? org.is_active : true,
            subscription_status: org.subscription_status || 'active',
            subscription_plan: org.subscription_plan || 'pro',
            subscription_expires_at:
              org.subscription_expires_at ||
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            monthly_fee: org.monthly_fee || 25000,
          }));
        }
      } catch (e) {}
    }

    // 2. Charger l'utilisateur courant / rôle
    let loadedCurrentUser = defaultCurrentUser;
    const rawUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (rawUser) {
      try {
        loadedCurrentUser = { ...defaultCurrentUser, ...JSON.parse(rawUser) };
      } catch (e) {}
    }

    // 3. Charger le tenant actif
    let activeOrgId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ORG) || DEFAULT_ORG_ID;
    if (!loadedOrgs.some((o) => o.id === activeOrgId)) {
      activeOrgId = loadedOrgs[0].id;
    }

    // 4. Charger le dictionnaire des settings
    let loadedAllSettings: Record<string, Settings> = { [DEFAULT_ORG_ID]: initialSettings };
    const rawAllSettings = localStorage.getItem(STORAGE_KEYS.ALL_SETTINGS);
    if (rawAllSettings) {
      try {
        loadedAllSettings = { ...loadedAllSettings, ...JSON.parse(rawAllSettings) };
      } catch (e) {}
    }

    // 5. Charger le state persistant
    const rawState = localStorage.getItem(STORAGE_KEYS.STATE) || localStorage.getItem(STORAGE_KEYS.PREV_STATE);
    let loadedCategories = initialCategories;
    let loadedServices = initialServices;
    let loadedArticles = initialArticles;
    let loadedClients = initialClients;
    let loadedOrders = initialOrders;

    if (rawState) {
      const parsed = JSON.parse(rawState);
      if (parsed.settings) {
        const parsedOrgId = parsed.settings.organization_id || DEFAULT_ORG_ID;
        loadedAllSettings[parsedOrgId] = {
          ...initialSettings,
          ...parsed.settings,
          organization_id: parsedOrgId,
        };
      }
      if (parsed.allSettings) {
        loadedAllSettings = { ...loadedAllSettings, ...parsed.allSettings };
      }
      if (parsed.categories?.length) loadedCategories = parsed.categories;
      if (parsed.services?.length) loadedServices = parsed.services;
      if (parsed.articles?.length) loadedArticles = parsed.articles;
      if (parsed.clients?.length) loadedClients = parsed.clients;
      if (parsed.orders?.length) loadedOrders = parsed.orders;
      if (parsed.organizations?.length) {
        loadedOrgs = parsed.organizations.map((org: any) => ({
          ...org,
          is_active: org.is_active !== undefined ? org.is_active : true,
          subscription_status: org.subscription_status || 'active',
          subscription_plan: org.subscription_plan || 'pro',
          subscription_expires_at:
            org.subscription_expires_at ||
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          monthly_fee: org.monthly_fee || 25000,
        }));
      }
      if (parsed.currentOrgId && loadedOrgs.some((o) => o.id === parsed.currentOrgId)) {
        activeOrgId = parsed.currentOrgId;
      }
      if (parsed.currentUser) {
        loadedCurrentUser = parsed.currentUser;
      }
    }

    const currentOrg = loadedOrgs.find((o) => o.id === activeOrgId) || loadedOrgs[0] || initialOrganization;
    const currentSettings = loadedAllSettings[activeOrgId] || {
      ...initialSettings,
      id: generateUuid(),
      organization_id: activeOrgId,
      shop_name: currentOrg.name,
      currency: currentOrg.currency,
      primary_color: currentOrg.primary_color,
      phone: currentOrg.phone,
      address: currentOrg.address,
      ticket_header: currentOrg.ticket_header,
      ticket_footer: currentOrg.ticket_footer,
    };
    loadedAllSettings[activeOrgId] = currentSettings;

    memoryState = {
      organizations: loadedOrgs,
      currentOrgId: activeOrgId,
      allSettings: loadedAllSettings,
      settings: currentSettings,
      categories: loadedCategories,
      services: loadedServices,
      articles: loadedArticles,
      clients: loadedClients,
      orders: loadedOrders,
      currentUser: loadedCurrentUser,
    };

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
        { data: sbOrgs },
        { data: sbSettings },
        { data: sbCategories },
        { data: sbServices },
        { data: sbArticles },
        { data: sbClients },
        { data: sbOrders },
      ] = await Promise.all([
        supabase.from('organizations').select('*').order('created_at', { ascending: true }),
        supabase.from('settings').select('*'),
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

      if (sbOrgs && sbOrgs.length > 0) {
        const mergedOrgsMap = new Map<string, Organization>();
        [...memoryState.organizations, ...sbOrgs].forEach((o: Organization) => mergedOrgsMap.set(o.id, o));
        newState.organizations = Array.from(mergedOrgsMap.values());
        hasChanges = true;
      }

      if (sbSettings && sbSettings.length > 0) {
        sbSettings.forEach((s: Settings) => {
          if (s.organization_id) {
            newState.allSettings[s.organization_id] = s;
          }
        });
        if (newState.allSettings[newState.currentOrgId]) {
          newState.settings = newState.allSettings[newState.currentOrgId];
        }
        hasChanges = true;
      } else if (sbSettings && !Array.isArray(sbSettings)) {
        newState.settings = sbSettings as Settings;
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
            if (client) {
              const fullClient = { ...client };
              const { organization_id: _cOrg, ...legacyClient } = client;
              await safeSupabaseUpsert(supabase, 'clients', fullClient, legacyClient);
            }
            const fullOrder = {
              id: order.id,
              organization_id: order.organization_id,
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
            };
            const { organization_id: _oOrg, ...legacyOrder } = fullOrder;
            await safeSupabaseUpsert(supabase, 'orders', fullOrder, legacyOrder);

            if (items && items.length) {
              for (const item of items) {
                const fullItem = { ...item };
                const { organization_id: _iOrg, ...legacyItem } = item;
                await safeSupabaseUpsert(supabase, 'order_items', fullItem, legacyItem);
              }
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
            const fullArt = { ...action.payload };
            const { organization_id: _aOrg, ...legacyArt } = action.payload;
            await safeSupabaseUpsert(supabase, 'articles', fullArt, legacyArt);
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
      const currentOrgId = memoryState.currentOrgId || memoryState.settings.organization_id || DEFAULT_ORG_ID;

      let client = memoryState.clients.find(
        (c) => (c.organization_id || DEFAULT_ORG_ID) === currentOrgId &&
               c.phone.trim().replace(/\s+/g, '') === params.client.phone.trim().replace(/\s+/g, '')
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

      const currentOrgOrders = memoryState.orders.filter(
        (o) => (o.organization_id || DEFAULT_ORG_ID) === currentOrgId
      );
      const orderCounter = currentOrgOrders.length + 1;
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
      const currentOrgId = memoryState.currentOrgId || memoryState.settings.organization_id || DEFAULT_ORG_ID;
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
        const fullPayload = {
          id: client.id,
          organization_id: client.organization_id,
          name: client.name,
          phone: client.phone,
          address: client.address,
          notes: client.notes,
        };
        const legacyPayload = {
          id: client.id,
          name: client.name,
          phone: client.phone,
          address: client.address,
          notes: client.notes,
        };

        safeSupabaseUpsert(supabase, 'clients', fullPayload, legacyPayload);
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
      const currentOrgId = memoryState.currentOrgId || memoryState.settings.organization_id || DEFAULT_ORG_ID;
      let article: Article;
      let updatedArticles: Article[];

      const validCategory =
        articleData.category_id && articleData.category_id.length > 25 && !articleData.category_id.startsWith('cat-')
          ? articleData.category_id
          : (memoryState.categories.find((c) => (c.organization_id || DEFAULT_ORG_ID) === currentOrgId)?.id ||
             memoryState.categories[0]?.id ||
             'c1111111-1111-1111-1111-111111111111');

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
        const fullPayload = {
          id: article.id,
          organization_id: article.organization_id,
          category_id: article.category_id,
          name: article.name,
          base_price: article.base_price,
          icon: article.icon,
          is_active: article.is_active,
        };
        const legacyPayload = {
          id: article.id,
          category_id: article.category_id,
          name: article.name,
          base_price: article.base_price,
          icon: article.icon,
          is_active: article.is_active,
        };

        safeSupabaseUpsert(supabase, 'articles', fullPayload, legacyPayload);
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

  // 6. GESTION DES PARAMÈTRES GÉNÉRAUX & SYNCHRO AVEC LE TENANT
  const saveSettings = useCallback((newSettings: Partial<Settings>) => {
    const currentOrgId = memoryState.currentOrgId || DEFAULT_ORG_ID;
    const updatedSettings: Settings = {
      ...memoryState.settings,
      ...newSettings,
      organization_id: currentOrgId,
      updated_at: new Date().toISOString(),
    };

    const updatedOrgs = memoryState.organizations.map((org) => {
      if (org.id === currentOrgId) {
        return {
          ...org,
          name: updatedSettings.shop_name || org.name,
          logo_url: updatedSettings.logo_url !== undefined ? updatedSettings.logo_url : org.logo_url,
          primary_color: updatedSettings.primary_color || org.primary_color,
          phone: updatedSettings.phone || org.phone,
          email: updatedSettings.email !== undefined ? updatedSettings.email : org.email,
          address: updatedSettings.address || org.address,
          currency: updatedSettings.currency || org.currency,
          ticket_header: updatedSettings.ticket_header !== undefined ? updatedSettings.ticket_header : org.ticket_header,
          ticket_footer: updatedSettings.ticket_footer !== undefined ? updatedSettings.ticket_footer : org.ticket_footer,
          updated_at: new Date().toISOString(),
        };
      }
      return org;
    });

    memoryState = {
      ...memoryState,
      settings: updatedSettings,
      organizations: updatedOrgs,
      allSettings: {
        ...memoryState.allSettings,
        [currentOrgId]: updatedSettings,
      },
    };

    if (isSupabaseConfigured && navigator.onLine) {
      const supabase = createSupabaseClient() as any;
      const fullSettingsPayload = updatedSettings;
      const legacySettingsPayload = {
        id: updatedSettings.id,
        shop_name: updatedSettings.shop_name,
        phone: updatedSettings.phone,
        address: updatedSettings.address,
        currency: updatedSettings.currency,
        default_pickup_days: updatedSettings.default_pickup_days,
        express_surcharge_percent: updatedSettings.express_surcharge_percent,
        sms_api_key: updatedSettings.sms_api_key,
        whatsapp_api_url: updatedSettings.whatsapp_api_url,
        whatsapp_template: updatedSettings.whatsapp_template,
      };

      safeSupabaseUpsert(supabase, 'settings', fullSettingsPayload, legacySettingsPayload);

      const currentOrg = updatedOrgs.find((o) => o.id === currentOrgId);
      if (currentOrg) {
        supabase.from('organizations').upsert(currentOrg).then((res: any) => {
          if (res.error && res.error.code !== 'PGRST205') {
            console.warn('[SUPABASE] Organisation:', res.error.message || res.error);
          }
        });
      }
    }

    persistLocal();
    notifyListeners();
    return updatedSettings;
  }, [isSupabaseConfigured]);

  // 7. GESTION DU CYCLE DE VIE DES TENANTS (CRÉATION, BASCULE, MODIFICATION, SUPPRESSION)
  const switchTenant = useCallback((orgId: string) => {
    const targetOrg = memoryState.organizations.find((o) => o.id === orgId);
    if (!targetOrg) {
      console.warn('Tenant non trouvé:', orgId);
      return;
    }

    const targetSettings = memoryState.allSettings[orgId] || {
      ...initialSettings,
      id: generateUuid(),
      organization_id: orgId,
      shop_name: targetOrg.name,
      phone: targetOrg.phone,
      email: targetOrg.email,
      address: targetOrg.address,
      currency: targetOrg.currency,
      primary_color: targetOrg.primary_color || '#2563eb',
      ticket_header: targetOrg.ticket_header,
      ticket_footer: targetOrg.ticket_footer,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryState = {
      ...memoryState,
      currentOrgId: orgId,
      settings: targetSettings,
      allSettings: {
        ...memoryState.allSettings,
        [orgId]: targetSettings,
      },
    };

    persistLocal();
    notifyListeners();
  }, []);

  const createTenant = useCallback(async (input: {
    name: string;
    slug?: string;
    phone: string;
    email?: string;
    address: string;
    currency: string;
    primary_color?: string;
    ticket_header?: string;
    ticket_footer?: string;
    seedCatalog?: boolean;
  }) => {
    const newOrgId = generateUuid();
    const baseSlug = (input.slug?.trim() || input.name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')) || (`pressing-${Date.now().toString(36)}`);

    let uniqueSlug = baseSlug;
    let counter = 1;
    while (memoryState.organizations.some((o) => o.slug === uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${counter++}`;
    }

    const primaryColor = input.primary_color || '#2563eb';
    const currency = input.currency || 'FCFA';

    const newOrg: Organization = {
      id: newOrgId,
      name: input.name.trim(),
      slug: uniqueSlug,
      logo_url: null,
      primary_color: primaryColor,
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      address: input.address.trim(),
      ticket_header: input.ticket_header?.trim() || `*** ${input.name.toUpperCase().trim()} ***`,
      ticket_footer: input.ticket_footer?.trim() || 'Merci pour votre confiance ! Tout vêtement non réclamé sous 90 jours sera cédé.',
      currency,
      is_active: true,
      subscription_status: 'active',
      subscription_plan: 'pro',
      subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      monthly_fee: 25000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newSettings: Settings = {
      id: generateUuid(),
      organization_id: newOrgId,
      shop_name: newOrg.name,
      phone: newOrg.phone,
      email: newOrg.email,
      address: newOrg.address,
      currency: newOrg.currency,
      logo_url: null,
      primary_color: primaryColor,
      ticket_header: newOrg.ticket_header,
      ticket_footer: newOrg.ticket_footer,
      default_pickup_days: 2,
      express_surcharge_percent: 50,
      sms_api_key: null,
      whatsapp_api_url: null,
      whatsapp_template: `Bonjour {{client_name}}, vos vêtements déposés sous le ticket #{{order_number}} sont PRÊTS au pressing ${newOrg.name}. Reste à payer : {{remaining_amount}} {{currency}}. Merci de votre confiance !`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let newCategories: Category[] = [];
    let newServices: Service[] = [];
    let newArticles: Article[] = [];

    if (input.seedCatalog !== false) {
      const catalog = createDefaultCatalogForOrg(newOrgId, newOrg.name, currency);
      newCategories = catalog.categories;
      newServices = catalog.services;
      newArticles = catalog.articles;
    }

    memoryState = {
      ...memoryState,
      organizations: [...memoryState.organizations, newOrg],
      currentOrgId: newOrgId,
      settings: newSettings,
      allSettings: {
        ...memoryState.allSettings,
        [newOrgId]: newSettings,
      },
      categories: [...memoryState.categories, ...newCategories],
      services: [...memoryState.services, ...newServices],
      articles: [...memoryState.articles, ...newArticles],
    };

    persistLocal();
    notifyListeners();

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const supabase = createSupabaseClient() as any;
        await supabase.from('organizations').insert(newOrg);
        await supabase.from('settings').insert(newSettings);
        if (newCategories.length > 0) {
          await supabase.from('categories').insert(newCategories);
        }
        if (newServices.length > 0) {
          await supabase.from('services').insert(newServices);
        }
        if (newArticles.length > 0) {
          await supabase.from('articles').insert(newArticles);
        }
      } catch (err) {
        console.warn('[SUPABASE] Erreur synchronisation création tenant:', err);
      }
    }

    return newOrg;
  }, [isSupabaseConfigured]);

  const updateTenant = useCallback((orgId: string, updates: Partial<Organization>) => {
    const updatedOrgs = memoryState.organizations.map((org) => {
      if (org.id === orgId) {
        return {
          ...org,
          ...updates,
          updated_at: new Date().toISOString(),
        };
      }
      return org;
    });

    const updatedSettings = { ...memoryState.allSettings };
    if (updatedSettings[orgId]) {
      updatedSettings[orgId] = {
        ...updatedSettings[orgId],
        ...(updates.name ? { shop_name: updates.name } : {}),
        ...(updates.phone ? { phone: updates.phone } : {}),
        ...(updates.email !== undefined ? { email: updates.email } : {}),
        ...(updates.address ? { address: updates.address } : {}),
        ...(updates.currency ? { currency: updates.currency } : {}),
        ...(updates.primary_color ? { primary_color: updates.primary_color } : {}),
        ...(updates.ticket_header !== undefined ? { ticket_header: updates.ticket_header } : {}),
        ...(updates.ticket_footer !== undefined ? { ticket_footer: updates.ticket_footer } : {}),
        updated_at: new Date().toISOString(),
      };
    }

    const currentSettings = orgId === memoryState.currentOrgId && updatedSettings[orgId]
      ? updatedSettings[orgId]
      : memoryState.settings;

    memoryState = {
      ...memoryState,
      organizations: updatedOrgs,
      allSettings: updatedSettings,
      settings: currentSettings,
    };

    if (isSupabaseConfigured && navigator.onLine) {
      const supabase = createSupabaseClient() as any;
      supabase.from('organizations').update(updates).eq('id', orgId).then();
      if (updatedSettings[orgId]) {
        supabase.from('settings').upsert(updatedSettings[orgId]).then();
      }
    }

    persistLocal();
    notifyListeners();
  }, [isSupabaseConfigured]);

  // 7.b GESTION DES ABONNEMENTS ET ACCÈS SAAS (SUPER ADMIN)
  const toggleTenantStatus = useCallback((orgId: string, forcedActive?: boolean) => {
    const target = memoryState.organizations.find((o) => o.id === orgId);
    if (!target) return;

    const nextActive = forcedActive !== undefined ? forcedActive : !target.is_active;
    const nextStatus: SubscriptionStatus = nextActive ? 'active' : 'suspended';

    const updatedOrgs = memoryState.organizations.map((org) => {
      if (org.id === orgId) {
        return {
          ...org,
          is_active: nextActive,
          subscription_status: nextStatus,
          updated_at: new Date().toISOString(),
        };
      }
      return org;
    });

    memoryState = {
      ...memoryState,
      organizations: updatedOrgs,
    };

    persistLocal();
    notifyListeners();

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const supabase = createSupabaseClient() as any;
        supabase
          .from('organizations')
          .update({
            is_active: nextActive,
            subscription_status: nextStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orgId)
          .then();
      } catch (e) {
        console.warn('[SUPABASE] Erreur maj statut abonnement:', e);
      }
    }
  }, [isSupabaseConfigured]);

  const updateTenantSubscription = useCallback(
    (
      orgId: string,
      data: {
        plan?: SubscriptionPlan;
        status?: SubscriptionStatus;
        expiresAt?: string;
        monthlyFee?: number;
      }
    ) => {
      const updatedOrgs = memoryState.organizations.map((org) => {
        if (org.id === orgId) {
          const newStatus = data.status || org.subscription_status;
          const isActive = newStatus === 'suspended' ? false : true;
          return {
            ...org,
            subscription_plan: data.plan || org.subscription_plan,
            subscription_status: newStatus,
            subscription_expires_at: data.expiresAt !== undefined ? data.expiresAt : org.subscription_expires_at,
            monthly_fee: data.monthlyFee !== undefined ? data.monthlyFee : org.monthly_fee,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          };
        }
        return org;
      });

      memoryState = {
        ...memoryState,
        organizations: updatedOrgs,
      };

      persistLocal();
      notifyListeners();

      if (isSupabaseConfigured && navigator.onLine) {
        try {
          const supabase = createSupabaseClient() as any;
          const target = updatedOrgs.find((o) => o.id === orgId);
          if (target) {
            supabase
              .from('organizations')
              .update({
                subscription_plan: target.subscription_plan,
                subscription_status: target.subscription_status,
                subscription_expires_at: target.subscription_expires_at,
                monthly_fee: target.monthly_fee,
                is_active: target.is_active,
                updated_at: new Date().toISOString(),
              })
              .eq('id', orgId)
              .then();
          }
        } catch (e) {
          console.warn('[SUPABASE] Erreur maj abonnement:', e);
        }
      }
    },
    [isSupabaseConfigured]
  );

  const extendTenantSubscription = useCallback(
    (orgId: string, daysToAdd: number = 30) => {
      const target = memoryState.organizations.find((o) => o.id === orgId);
      if (!target) return;

      const baseDate =
        target.subscription_expires_at && new Date(target.subscription_expires_at) > new Date()
          ? new Date(target.subscription_expires_at)
          : new Date();

      const newExpiresAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

      updateTenantSubscription(orgId, {
        status: 'active',
        expiresAt: newExpiresAt,
      });
    },
    [updateTenantSubscription]
  );

  const setCurrentUserRole = useCallback((role: MemberRole) => {
    const updatedUser = {
      ...memoryState.currentUser,
      role,
    };
    memoryState = {
      ...memoryState,
      currentUser: updatedUser,
    };
    persistLocal();
    notifyListeners();
  }, []);

  const loginUser = useCallback((user: UserSession, orgId?: string) => {
    let nextOrgId = memoryState.currentOrgId;
    if (orgId && memoryState.organizations.some((o) => o.id === orgId)) {
      nextOrgId = orgId;
    }

    const nextSettings = memoryState.allSettings[nextOrgId] || memoryState.settings;

    const loggedUser: UserSession = {
      ...user,
      isLoggedIn: true,
      organization_id: nextOrgId,
    };

    memoryState = {
      ...memoryState,
      currentUser: loggedUser,
      currentOrgId: nextOrgId,
      settings: nextSettings,
    };

    persistLocal();
    notifyListeners();
  }, []);

  const logoutUser = useCallback(async () => {
    if (isSupabaseConfigured) {
      try {
        const supabase = createSupabaseClient();
        await supabase.auth.signOut();
      } catch (e) {}
    }

    const guestUser: UserSession = {
      id: 'guest',
      name: 'Invité Déconnecté',
      email: '',
      role: 'member',
      isLoggedIn: false,
    };

    memoryState = {
      ...memoryState,
      currentUser: guestUser,
    };

    persistLocal();
    notifyListeners();
  }, [isSupabaseConfigured]);

  const deleteTenant = useCallback(async (orgId: string) => {
    if (orgId === DEFAULT_ORG_ID) {
      return { success: false, message: 'Le tenant racine par défaut ne peut pas être supprimé.' };
    }

    const remainingOrgs = memoryState.organizations.filter((o) => o.id !== orgId);
    if (remainingOrgs.length === 0) {
      return { success: false, message: 'Au moins un établissement doit rester actif.' };
    }

    const nextActiveId = memoryState.currentOrgId === orgId ? remainingOrgs[0].id : memoryState.currentOrgId;
    const nextSettings = memoryState.allSettings[nextActiveId] || initialSettings;

    memoryState = {
      ...memoryState,
      organizations: remainingOrgs,
      currentOrgId: nextActiveId,
      settings: nextSettings,
      categories: memoryState.categories.filter((c) => c.organization_id !== orgId),
      services: memoryState.services.filter((s) => s.organization_id !== orgId),
      articles: memoryState.articles.filter((a) => a.organization_id !== orgId),
      clients: memoryState.clients.filter((c) => c.organization_id !== orgId),
      orders: memoryState.orders.filter((o) => o.organization_id !== orgId),
    };

    persistLocal();
    notifyListeners();

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const supabase = createSupabaseClient() as any;
        await supabase.from('organizations').delete().eq('id', orgId);
      } catch (err) {
        console.warn('[SUPABASE] Erreur suppression tenant:', err);
      }
    }

    return { success: true };
  }, [isSupabaseConfigured]);

  const seedTenantCatalog = useCallback(async (orgId: string) => {
    const targetOrg = memoryState.organizations.find((o) => o.id === orgId);
    if (!targetOrg) return;

    const catalog = createDefaultCatalogForOrg(orgId, targetOrg.name, targetOrg.currency);

    const otherCategories = memoryState.categories.filter((c) => c.organization_id !== orgId);
    const otherServices = memoryState.services.filter((s) => s.organization_id !== orgId);
    const otherArticles = memoryState.articles.filter((a) => a.organization_id !== orgId);

    memoryState = {
      ...memoryState,
      categories: [...otherCategories, ...catalog.categories],
      services: [...otherServices, ...catalog.services],
      articles: [...otherArticles, ...catalog.articles],
    };

    persistLocal();
    notifyListeners();

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const supabase = createSupabaseClient() as any;
        await supabase.from('categories').insert(catalog.categories);
        await supabase.from('services').insert(catalog.services);
        await supabase.from('articles').insert(catalog.articles);
      } catch (e) {
        console.warn('[SUPABASE] Erreur seed catalogue:', e);
      }
    }
  }, [isSupabaseConfigured]);

  // 8. RÉINITIALISATION AUX DONNÉES DÉMO
  const resetToDemoData = useCallback(() => {
    memoryState = {
      organizations: demoOrganizations,
      currentOrgId: DEFAULT_ORG_ID,
      currentUser: defaultCurrentUser,
      allSettings: { [DEFAULT_ORG_ID]: initialSettings },
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

  // Partitionnement réactif par tenant pour les composants consommateurs
  const currentOrgId = activeState.currentOrgId || DEFAULT_ORG_ID;
  const currentOrganization =
    activeState.organizations?.find((o) => o.id === currentOrgId) ||
    activeState.organizations?.[0] ||
    initialOrganization;

  const currentCategories = activeState.categories.filter(
    (c) => (c.organization_id || DEFAULT_ORG_ID) === currentOrgId
  );
  const currentServices = activeState.services.filter(
    (s) => (s.organization_id || DEFAULT_ORG_ID) === currentOrgId
  );
  const currentArticles = activeState.articles.filter(
    (a) => (a.organization_id || DEFAULT_ORG_ID) === currentOrgId
  );
  const currentClients = activeState.clients.filter(
    (c) => (c.organization_id || DEFAULT_ORG_ID) === currentOrgId
  );
  const currentOrders = activeState.orders.filter(
    (o) => (o.organization_id || DEFAULT_ORG_ID) === currentOrgId
  );

  return {
    // États Multi-Tenant
    organizations: activeState.organizations || [initialOrganization],
    currentOrganization,
    currentOrgId,
    settings: activeState.settings,
    categories: currentCategories,
    services: currentServices,
    articles: currentArticles,
    clients: currentClients,
    orders: currentOrders,
    allOrders: activeState.orders,
    isMounted: mounted,
    isOnline,
    isSyncing,
    pendingSyncCount: offlineQueue.length,
    lastSyncTime,

    // Actions Multi-Tenant & SaaS Super Admin
    currentUser: activeState.currentUser || defaultCurrentUser,
    setCurrentUserRole,
    loginUser,
    logoutUser,
    createTenant,
    switchTenant,
    updateTenant,
    deleteTenant,
    seedTenantCatalog,
    toggleTenantStatus,
    updateTenantSubscription,
    extendTenantSubscription,

    // Actions Métier
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
