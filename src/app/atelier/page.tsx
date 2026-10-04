'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Kanban,
  Search,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Phone,
  MessageSquare,
  Receipt,
  User,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { usePressingStore } from '@/lib/store';
import { OrderStatus, OrderWithDetails } from '@/types/database';
import { ReceiptModal } from '@/components/ReceiptModal';

const COLUMNS: Array<{
  id: OrderStatus;
  title: string;
  color: string;
  badgeBg: string;
  borderColor: string;
  description: string;
}> = [
  {
    id: 'to_process',
    title: 'À traiter',
    color: 'text-blue-400',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    borderColor: 'border-blue-500/30',
    description: 'Nouveaux dépôts à trier et laver',
  },
  {
    id: 'in_progress',
    title: 'En cours',
    color: 'text-amber-400',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    borderColor: 'border-amber-500/30',
    description: 'En machine, séchage ou repassage',
  },
  {
    id: 'ready',
    title: 'Prêt pour retrait',
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    borderColor: 'border-emerald-500/30',
    description: 'Repassé & ensaché (Client notifié)',
  },
  {
    id: 'delivered',
    title: 'Retiré / Archivé',
    color: 'text-slate-400',
    badgeBg: 'bg-slate-700 text-slate-300 border-slate-600',
    borderColor: 'border-slate-800',
    description: 'Récupéré et soldé en caisse',
  },
];

export default function AtelierKanbanPage() {
  const { orders, settings, updateOrderStatus } = usePressingStore();
  const [search, setSearch] = useState('');
  const [filterExpressOnly, setFilterExpressOnly] = useState(false);
  const [inspectOrder, setInspectOrder] = useState<OrderWithDetails | null>(null);

  // Filtrage des commandes
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filterExpressOnly && !order.is_express) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        order.order_number.toLowerCase().includes(q) ||
        order.client.name.toLowerCase().includes(q) ||
        order.client.phone.includes(q)
      );
    });
  }, [orders, search, filterExpressOnly]);

  // Commandes par colonne
  const ordersByStatus = useMemo(() => {
    const map: Record<OrderStatus, OrderWithDetails[]> = {
      to_process: [],
      in_progress: [],
      ready: [],
      delivered: [],
      cancelled: [],
    };
    filteredOrders.forEach((o) => {
      if (map[o.status]) {
        map[o.status].push(o);
      }
    });
    return map;
  }, [filteredOrders]);

  // Statuts suivants et précédents
  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    switch (current) {
      case 'to_process':
        return 'in_progress';
      case 'in_progress':
        return 'ready';
      case 'ready':
        return 'delivered';
      default:
        return null;
    }
  };

  const getPreviousStatus = (current: OrderStatus): OrderStatus | null => {
    switch (current) {
      case 'in_progress':
        return 'to_process';
      case 'ready':
        return 'in_progress';
      case 'delivered':
        return 'ready';
      default:
        return null;
    }
  };

  // Indicateur d'urgence délai
  const getDelayBadge = (pickupDateStr: string, isExpress: boolean) => {
    const now = new Date().getTime();
    const pickup = new Date(pickupDateStr).getTime();
    const diffHours = Math.round((pickup - now) / (1000 * 60 * 60));

    if (diffHours < 0) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-rose-400" />
          <span>Retard</span>
        </span>
      );
    }
    if (isExpress || diffHours <= 24) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>Pour aujourd&apos;hui</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        <span>J+{Math.ceil(diffHours / 24)}</span>
      </span>
    );
  };

  return (
    <div className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-6 flex flex-col gap-4">
      
      {/* Header Atelier & Statistiques */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
              <Kanban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Atelier &amp; Suivi des États en Direct
              </h2>
              <p className="text-xs text-slate-400">
                Passez les commandes en &quot;Prêt&quot; pour déclencher automatiquement la notification SMS/WhatsApp client.
              </p>
            </div>
          </div>
        </div>

        {/* Barre de recherche et filtre Express */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher réf, client, tél..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setFilterExpressOnly(!filterExpressOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              filterExpressOnly
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Express uniquement</span>
          </button>
        </div>
      </div>

      {/* TABLEAU KANBAN À 4 COLONNES */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 items-start">
        {COLUMNS.map((col) => {
          const columnOrders = ordersByStatus[col.id] || [];

          return (
            <div
              key={col.id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col min-h-[580px] max-h-[calc(100vh-180px)] shadow-md overflow-hidden"
            >
              {/* En-tête de la colonne */}
              <div className="p-3.5 border-b border-slate-800/80 bg-slate-850/50 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-sm ${col.color}`}>{col.title}</h3>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${col.badgeBg}`}>
                      {columnOrders.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]">
                    {col.description}
                  </p>
                </div>
              </div>

              {/* Liste des cartes de commande */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {columnOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs italic">
                    Aucune commande dans cet état
                  </div>
                ) : (
                  columnOrders.map((order) => {
                    const next = getNextStatus(order.status);
                    const prev = getPreviousStatus(order.status);

                    return (
                      <div
                        key={order.id}
                        className={`bg-slate-800/90 hover:bg-slate-800 border rounded-xl p-3.5 space-y-3 transition-all shadow-sm ${
                          order.is_express
                            ? 'border-amber-500/50 bg-amber-950/10'
                            : 'border-slate-700/80'
                        }`}
                      >
                        {/* Haut de carte : Réf & Badges */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-white text-sm">
                                #{order.order_number}
                              </span>
                              {order.is_express && (
                                <span className="p-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black flex items-center" title="Express 24h">
                                  <Zap className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-slate-200 mt-0.5">
                              {order.client.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {order.client.phone}
                            </div>
                          </div>

                          <div>
                            {getDelayBadge(order.pickup_date, order.is_express)}
                          </div>
                        </div>

                        {/* Liste succincte des articles */}
                        <div className="bg-slate-900/60 rounded-lg p-2 text-xs text-slate-300 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 pb-0.5 border-b border-slate-800">
                            <span>{order.items.reduce((s, i) => s + i.quantity, 0)} articles</span>
                            <span>{order.total_amount.toLocaleString('fr-FR')} {settings.currency}</span>
                          </div>
                          {order.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex justify-between text-[11px] truncate">
                              <span className="truncate">
                                {item.quantity}x {item.article_name}
                              </span>
                              <span className="text-slate-400 ml-1">
                                {item.service_code === 'wash'
                                  ? 'Lavage'
                                  : item.service_code === 'iron'
                                  ? 'Repassage'
                                  : 'Complet'}
                              </span>
                            </div>
                          ))}
                          {order.items.length > 3 && (
                            <div className="text-[10px] text-blue-400 italic">
                              +{order.items.length - 3} autre(s) article(s)...
                            </div>
                          )}
                        </div>

                        {/* Statut Paiement & Reste à Payer */}
                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            {order.remaining_amount <= 0 ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Totalité réglée</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                Reste :{' '}
                                <strong className="text-rose-400">
                                  {order.remaining_amount.toLocaleString('fr-FR')} {settings.currency}
                                </strong>
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => setInspectOrder(order)}
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-0.5"
                          >
                            <span>Reçu</span>
                            <Receipt className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Boutons de transition Kanban tactile */}
                        <div className="pt-2 border-t border-slate-700/60 flex items-center gap-2">
                          {prev && (
                            <button
                              onClick={() => updateOrderStatus(order.id, prev)}
                              className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                              title="Reculer d'un état"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {next ? (
                            <button
                              onClick={() => updateOrderStatus(order.id, next)}
                              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                                next === 'ready'
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                                  : next === 'in_progress'
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                              }`}
                            >
                              <span>
                                {next === 'in_progress'
                                  ? 'Démarrer traitement'
                                  : next === 'ready'
                                  ? 'Marquer PRÊT (SMS)'
                                  : 'Valider retrait'}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <div className="flex-1 py-1.5 text-center text-[11px] text-slate-400 italic">
                              Commande clôturée
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Reçu de consultation */}
      <ReceiptModal
        order={inspectOrder}
        settings={settings}
        onClose={() => setInspectOrder(null)}
      />
    </div>
  );
}
