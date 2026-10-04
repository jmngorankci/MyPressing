'use client';

import React, { use } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  Calendar,
  ShieldCheck,
  ShoppingBag,
  ArrowLeft,
  Share2,
} from 'lucide-react';
import { usePressingStore } from '@/lib/store';
import { OrderStatus } from '@/types/database';

const STEPS: Array<{ id: OrderStatus; label: string; desc: string }> = [
  { id: 'to_process', label: 'Dépôt Enregistré', desc: 'Linge réceptionné et étiqueté' },
  { id: 'in_progress', label: 'Traitement en Cours', desc: 'Nettoyage, détachage & repassage' },
  { id: 'ready', label: 'Prêt pour Retrait', desc: 'Emballé sous housse protectrice' },
  { id: 'delivered', label: 'Linge Retiré', desc: 'Remis au client & soldé' },
];

export default function OrderTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { orders, settings } = usePressingStore();

  const order = orders.find(
    (o) => o.id === resolvedParams.id || o.order_number === resolvedParams.id
  );

  if (!order) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 max-w-md w-full space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Commande introuvable</h2>
          <p className="text-xs text-slate-400">
            Le reçu scanné ne correspond à aucune commande active ou archivée.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à l&apos;accueil</span>
          </Link>
        </div>
      </div>
    );
  }

  // Calcul de l'étape courante
  const currentStepIndex = STEPS.findIndex((s) => s.id === order.status);
  const formattedPickup = new Date(order.pickup_date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 sm:p-6">
      <div className="max-w-xl w-full space-y-5">
        
        {/* En-tête Pressing */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Suivi Client en Temps Réel</span>
          </div>
          <h1 suppressHydrationWarning className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {settings.shop_name}
          </h1>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> {settings.address}
          </p>
        </div>

        {/* Carte Statut Principal */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
          
          {/* Header Numéro & Client */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <span className="text-xs text-slate-400">Référence Ticket</span>
              <div className="font-mono font-extrabold text-white text-lg">
                #{order.order_number}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Client</span>
              <div className="font-bold text-white text-sm">
                {order.client.name}
              </div>
            </div>
          </div>

          {/* Stepper / Timeline de progression */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Progression du linge
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {STEPS.map((step, idx) => {
                const isPassed = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div key={step.id} className="relative flex items-start gap-3">
                    <span
                      className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 transition-all ${
                        isCurrent
                          ? 'bg-blue-500 border-white ring-4 ring-blue-500/30'
                          : isPassed
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'bg-slate-900 border-slate-700'
                      }`}
                    />
                    <div>
                      <div
                        className={`text-sm font-bold ${
                          isCurrent
                            ? 'text-blue-400'
                            : isPassed
                            ? 'text-white'
                            : 'text-slate-500'
                        }`}
                      >
                        {step.label}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{step.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Date de retrait */}
          <div className="p-4 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-600 text-white">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-300">Date estimée de retrait</span>
                <div className="text-sm font-bold text-white capitalize">
                  {formattedPickup}
                </div>
              </div>
            </div>

            {order.status === 'ready' && (
              <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold animate-pulse">
                PRÊT !
              </span>
            )}
          </div>

          {/* Liste des articles déposés */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Articles ({order.items.reduce((s, i) => s + i.quantity, 0)})</span>
              <span>Total</span>
            </div>
            <div className="space-y-1.5 divide-y divide-slate-800/60">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs pt-1.5">
                  <div>
                    <span className="font-semibold text-white">
                      {item.quantity}x {item.article_name}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-2">
                      ({item.service_code === 'wash' ? 'Lavage' : item.service_code === 'iron' ? 'Repassage' : 'Complet'})
                    </span>
                  </div>
                  <div className="font-mono text-slate-300">
                    {item.total_price.toLocaleString('fr-FR')} {settings.currency}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Situation Financière */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Montant total :</span>
              <span className="font-bold text-white font-mono">
                {order.total_amount.toLocaleString('fr-FR')} {settings.currency}
              </span>
            </div>
            <div className="flex justify-between text-emerald-400">
              <span>Acompte déjà versé :</span>
              <span className="font-bold font-mono">
                - {order.advance_amount.toLocaleString('fr-FR')} {settings.currency}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-extrabold text-sm">
              <span className="text-slate-200">Reste à payer au guichet :</span>
              <span className={order.remaining_amount > 0 ? 'text-rose-400 font-mono' : 'text-emerald-400'}>
                {order.remaining_amount.toLocaleString('fr-FR')} {settings.currency}
              </span>
            </div>
          </div>

          {/* Bouton Contact WhatsApp Pressing */}
          <div className="pt-2">
            <a
              href={`https://wa.me/${settings.phone.replace(/[^0-9]/g, '')}?text=Bonjour%20${encodeURIComponent(settings.shop_name)},%20je%20vous%20contacte%20concernant%20ma%20commande%20%23${order.order_number}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
            >
              <Phone className="w-4 h-4" />
              <span>Contacter le Pressing (WhatsApp / Téléphone)</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
