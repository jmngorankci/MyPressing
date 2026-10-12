'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  Lock,
  ShieldAlert,
  CreditCard,
  PhoneCall,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { usePressingStore } from '@/lib/store';

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    currentOrganization,
    currentUser,
    extendTenantSubscription,
    toggleTenantStatus,
  } = usePressingStore();

  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Ne pas bloquer l'accès à la console Super Admin, à la connexion ni au suivi public
  const isBypassedRoute =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/suivi') ||
    currentUser?.role === 'super_admin';

  const isSuspended =
    currentOrganization &&
    (currentOrganization.is_active === false || currentOrganization.subscription_status === 'suspended');

  const isPastDue =
    currentOrganization &&
    currentOrganization.subscription_status === 'past_due' &&
    currentOrganization.is_active !== false;

  const handleSimulatePayment = () => {
    setIsSimulatingPayment(true);
    setTimeout(() => {
      extendTenantSubscription(currentOrganization.id, 30);
      setIsSimulatingPayment(false);
      setPaymentSuccess(true);
      setTimeout(() => setPaymentSuccess(false), 4000);
    }, 1200);
  };

  // WhatsApp payment assistance link
  const supportPhone = '+2250789451230';
  const whatsappPaymentMsg = encodeURIComponent(
    `Bonjour Support MyPressing SaaS,\nJe souhaite régulariser l'abonnement de mon établissement "${currentOrganization?.name}" (ID: ${currentOrganization?.id?.slice(0, 8)}).\nPlan: ${currentOrganization?.subscription_plan?.toUpperCase()} - Montant: ${currentOrganization?.monthly_fee?.toLocaleString('fr-FR')} ${currentOrganization?.currency}.\nMerci de m'indiquer les modalités Wave / Orange Money.`
  );
  const whatsappUrl = `https://wa.me/${supportPhone.replace(/[^0-9]/g, '')}?text=${whatsappPaymentMsg}`;

  // Si le tenant est suspendu et qu'on n'est pas sur une route bypassée
  if (isSuspended && !isBypassedRoute) {
    return (
      <div className="flex-1 min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100">
        <div className="w-full max-w-xl bg-slate-900 border border-rose-900/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/40 text-center relative overflow-hidden backdrop-blur-xl">
          {/* Accent Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Badge & Lock Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-6 shadow-inner mx-auto">
            <Lock className="w-10 h-10 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold uppercase tracking-wider mb-3">
            <ShieldAlert className="w-3.5 h-3.5" />
            Accès Suspendu • Défaut de Paiement
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
            Service Temporairement Interrompu
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
            L'établissement{' '}
            <strong className="text-white font-semibold">
              {currentOrganization?.name || 'Ce pressing'}
            </strong>{' '}
            a été suspendu par la plateforme SaaS pour défaut de règlement de son abonnement mensuel.
          </p>

          {/* Facture récapitulative */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 mb-6 text-left space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-center text-slate-400">
              <span>Formule souscrite :</span>
              <span className="font-bold text-white uppercase px-2 py-0.5 rounded bg-slate-800">
                Plan {currentOrganization?.subscription_plan || 'Pro'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Montant de la mensualité :</span>
              <span className="font-bold text-rose-400 font-mono text-base">
                {currentOrganization?.monthly_fee?.toLocaleString('fr-FR')} {currentOrganization?.currency || 'FCFA'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Échéance dépassée :</span>
              <span className="font-semibold text-slate-300">
                {currentOrganization?.subscription_expires_at
                  ? new Date(currentOrganization.subscription_expires_at).toLocaleDateString('fr-FR')
                  : 'Échue'}
              </span>
            </div>
          </div>

          {/* Actions de déblocage */}
          <div className="space-y-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-sm transition-all shadow-lg shadow-emerald-950/50"
            >
              <MessageCircle className="w-4 h-4" />
              Contacter le Support WhatsApp pour Régulariser (Wave / Orange Money)
            </a>

            <button
              onClick={handleSimulatePayment}
              disabled={isSimulatingPayment}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-white text-sm transition-all border border-blue-400/30"
            >
              <CreditCard className="w-4 h-4" />
              {isSimulatingPayment
                ? 'Traitement du règlement en cours...'
                : 'Régulariser Instantanément (+30 Jours)'}
            </button>

            <div className="pt-2 flex items-center justify-center gap-4 text-xs text-slate-400">
              <Link
                href="/admin"
                className="hover:text-blue-400 underline transition-colors flex items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Console Super Admin (Débloquer / Activer)
              </Link>
            </div>
          </div>

          {paymentSuccess && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Abonnement réactivé avec succès ! Rechargement de vos services...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Bannière d'avertissement en cas d'impayé récent (Past Due) */}
      {isPastDue && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-amber-200 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
            <span>
              <strong>Avertissement d'échéance :</strong> L'abonnement de{' '}
              <strong>{currentOrganization?.name}</strong> est arrivé à expiration. Veuillez régulariser
              la facture de{' '}
              <strong className="underline">
                {currentOrganization?.monthly_fee?.toLocaleString('fr-FR')} {currentOrganization?.currency}
              </strong>{' '}
              pour éviter l'interruption du service de caisse.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulatePayment}
              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shrink-0"
            >
              Régulariser Maintenant
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors shrink-0"
            >
              WhatsApp Support
            </a>
          </div>
        </div>
      )}

      {children}
    </>
  );
}
