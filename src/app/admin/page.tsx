'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Building2,
  Users,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Plus,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Power,
  RotateCcw,
  Sparkles,
  Calendar,
  ExternalLink,
  ShieldAlert,
  ChevronRight,
  Check,
  RefreshCw,
} from 'lucide-react';
import { usePressingStore } from '@/lib/store';
import { Organization, SubscriptionStatus, SubscriptionPlan, MemberRole } from '@/types/database';
import { CreateTenantModal } from '@/components/CreateTenantModal';

export default function AdminTenantsPage() {
  const {
    organizations,
    currentOrgId,
    currentUser,
    setCurrentUserRole,
    switchTenant,
    toggleTenantStatus,
    updateTenantSubscription,
    extendTenantSubscription,
    deleteTenant,
    allOrders,
  } = usePressingStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'past_due' | 'suspended'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Statistiques globales de la plateforme SaaS
  const stats = useMemo(() => {
    const totalTenants = organizations.length;
    const activeTenants = organizations.filter(
      (o) => o.is_active !== false && o.subscription_status === 'active'
    ).length;
    const pastDueTenants = organizations.filter(
      (o) => o.subscription_status === 'past_due'
    ).length;
    const suspendedTenants = organizations.filter(
      (o) => o.is_active === false || o.subscription_status === 'suspended'
    ).length;

    const totalMRR = organizations
      .filter((o) => o.is_active !== false)
      .reduce((acc, curr) => acc + (curr.monthly_fee || 25000), 0);

    const recoveryRate =
      totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 100) : 100;

    return {
      totalTenants,
      activeTenants,
      pastDueTenants,
      suspendedTenants,
      totalMRR,
      recoveryRate,
    };
  }, [organizations]);

  // Filtrage des tenants
  const filteredOrganizations = useMemo(() => {
    return organizations.filter((org) => {
      const matchesSearch =
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.address.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') {
        return org.is_active !== false && org.subscription_status === 'active';
      }
      if (statusFilter === 'past_due') {
        return org.subscription_status === 'past_due';
      }
      if (statusFilter === 'suspended') {
        return org.is_active === false || org.subscription_status === 'suspended';
      }
      return true;
    });
  }, [organizations, searchQuery, statusFilter]);

  // Génération du lien de relance WhatsApp pour impayé
  const generateWhatsAppReminder = (org: Organization) => {
    const cleanPhone = org.phone.replace(/[^0-9]/g, '');
    const amount = org.monthly_fee?.toLocaleString('fr-FR') || '25 000';
    const currency = org.currency || 'FCFA';
    const expireDate = org.subscription_expires_at
      ? new Date(org.subscription_expires_at).toLocaleDateString('fr-FR')
      : 'récemment';

    const message = encodeURIComponent(
      `Bonjour Direction ${org.name},\n\nSauf erreur de notre part, l'abonnement MyPressing SaaS de votre établissement est arrivé à échéance le ${expireDate}.\n\nMontant à régulariser : ${amount} ${currency}.\n\nPour éviter l'interruption des services de caisse et d'atelier de votre pressing, merci de nous transmettre votre preuve de paiement par Wave, Orange Money ou MTN MoMo.\n\nSupport Plateforme MyPressing : +225 07 89 45 12 30`
    );

    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Notifications Toast */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-5 h-5" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider mb-3">
                <ShieldCheck className="w-4 h-4" />
                Console Super Admin SaaS • Multi-Tenant B2B
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Gestion des Établissements & Facturation
              </h1>
              <p className="mt-1 text-slate-400 text-sm max-w-2xl">
                Contrôlez les accès à la plateforme, activez ou suspendez en 1-clic les pressings en retard
                de paiement, et suivez le revenu récurrent (MRR).
              </p>
            </div>

            {/* Profil simulateur et bouton nouveau tenant */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span className="text-xs text-slate-400">Rôle simulé :</span>
                <select
                  value={currentUser.role}
                  onChange={(e) => {
                    setCurrentUserRole(e.target.value as MemberRole);
                    showNotification(`Rôle basculé sur : ${e.target.value}`);
                  }}
                  className="bg-transparent text-xs font-bold text-blue-400 focus:outline-none cursor-pointer"
                >
                  <option value="super_admin" className="bg-slate-900 text-white">
                    🛡️ Super Admin
                  </option>
                  <option value="owner" className="bg-slate-900 text-white">
                    👔 Gérant Pressing
                  </option>
                  <option value="cashier" className="bg-slate-900 text-white">
                    🏷️ Caissier Guichet
                  </option>
                  <option value="workshop" className="bg-slate-900 text-white">
                    👕 Opérateur Atelier
                  </option>
                </select>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-900/30 transition-all hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" />
                Nouveau Pressing Client
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Total Blanchisseries</span>
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-extrabold text-white">{stats.totalTenants}</p>
            <span className="text-[11px] text-slate-500">Souscriptions créées</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Actifs & À Jour</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-400">{stats.activeTenants}</p>
            <span className="text-[11px] text-emerald-500/80 font-medium">Accès débloqué</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">En Retard</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-extrabold text-amber-400">{stats.pastDueTenants}</p>
            <span className="text-[11px] text-amber-500/80 font-medium">Bannière alerte active</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Suspendus / Coupés</span>
              <XCircle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-extrabold text-rose-400">{stats.suspendedTenants}</p>
            <span className="text-[11px] text-rose-500/80 font-medium">Verrouillés pour impayé</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">MRR Récurrent</span>
              <DollarSign className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-purple-300 font-mono">
              {stats.totalMRR.toLocaleString('fr-FR')}
            </p>
            <span className="text-[11px] text-purple-400/80 font-medium">FCFA / mois</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Recouvrement</span>
              <TrendingUp className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-2xl font-extrabold text-sky-400">{stats.recoveryRate}%</p>
            <span className="text-[11px] text-slate-500">Taux à jour</span>
          </div>
        </div>

        {/* Filtres et Barre de recherche */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80">
          {/* Recherche */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, ville, téléphone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Filtres de statut */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tous ({stats.totalTenants})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              Actifs ({stats.activeTenants})
            </button>
            <button
              onClick={() => setStatusFilter('past_due')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'past_due'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              En Retard ({stats.pastDueTenants})
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'suspended'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              Suspendus ({stats.suspendedTenants})
            </button>
          </div>
        </div>

        {/* Liste des Établissements */}
        <div className="space-y-4">
          {filteredOrganizations.map((org) => {
            const isCurrentlySelected = org.id === currentOrgId;
            const orgOrdersCount = allOrders.filter((o) => o.organization_id === org.id).length;
            const orgRevenue = allOrders
              .filter((o) => o.organization_id === org.id)
              .reduce((acc, curr) => acc + (curr.total_amount || 0), 0);

            const isSuspended =
              org.is_active === false || org.subscription_status === 'suspended';
            const isPastDue =
              org.subscription_status === 'past_due' && org.is_active !== false;
            const isActive = !isSuspended && !isPastDue;

            const expirationDate = org.subscription_expires_at
              ? new Date(org.subscription_expires_at)
              : null;
            const daysLeft = expirationDate
              ? Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <div
                key={org.id}
                className={`bg-slate-900 border rounded-3xl p-5 sm:p-6 transition-all hover:border-slate-700 shadow-md ${
                  isSuspended
                    ? 'border-rose-900/50 bg-rose-950/10'
                    : isPastDue
                    ? 'border-amber-900/50 bg-amber-950/10'
                    : isCurrentlySelected
                    ? 'border-blue-500/60 shadow-blue-950/30'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  {/* Info Principale */}
                  <div className="flex items-start gap-4 min-w-0">
                    {/* Badge / Logo */}
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg font-bold text-white text-lg relative"
                      style={{ backgroundColor: org.primary_color || '#2563eb' }}
                    >
                      {org.logo_url ? (
                        <img
                          src={org.logo_url}
                          alt={org.name}
                          className="w-full h-full object-contain rounded-2xl"
                        />
                      ) : (
                        org.name.slice(0, 2).toUpperCase()
                      )}

                      {/* Statut indicator dot */}
                      <span
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${
                          isSuspended
                            ? 'bg-rose-500'
                            : isPastDue
                            ? 'bg-amber-400 animate-ping'
                            : 'bg-emerald-500'
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-white truncate">{org.name}</h2>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {org.slug}
                        </span>
                        {isCurrentlySelected && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            Pressing Actif
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          {org.address || 'Abidjan'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          {org.phone}
                        </span>
                        {org.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            {org.email}
                          </span>
                        )}
                      </div>

                      {/* Stat métriques d'usage */}
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                        <span>
                          📦 <strong>{orgOrdersCount}</strong> commandes
                        </span>
                        <span>
                          💰 <strong>{orgRevenue.toLocaleString('fr-FR')}</strong> {org.currency} traités
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Statut & Formule d'Abonnement */}
                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                    <div className="space-y-1 min-w-[140px]">
                      <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                        Formule & Statut
                      </div>
                      <div className="flex items-center gap-2">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300">
                            <XCircle className="w-3.5 h-3.5" />
                            Suspendu
                          </span>
                        ) : isPastDue ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            En Retard
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Actif
                          </span>
                        )}

                        <span className="text-xs font-bold text-slate-300 uppercase px-2 py-0.5 rounded bg-slate-800">
                          {org.subscription_plan || 'Pro'}
                        </span>
                      </div>

                      <p className="text-xs font-mono font-bold text-slate-300">
                        {(org.monthly_fee || 25000).toLocaleString('fr-FR')} {org.currency} / mois
                      </p>
                    </div>

                    <div className="space-y-1 min-w-[130px] border-l border-slate-800 pl-4">
                      <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                        Échéance
                      </div>
                      <p className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {expirationDate ? expirationDate.toLocaleDateString('fr-FR') : 'Indéfinie'}
                      </p>
                      <p
                        className={`text-[11px] font-bold ${
                          daysLeft !== null && daysLeft <= 0
                            ? 'text-rose-400'
                            : daysLeft !== null && daysLeft <= 5
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {daysLeft !== null
                          ? daysLeft <= 0
                            ? `Expiré il y a ${Math.abs(daysLeft)} j`
                            : `Reste ${daysLeft} jours`
                          : 'Période active'}
                      </p>
                    </div>
                  </div>

                  {/* Actions Super Admin 1-Clic */}
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {/* Toggle Activation / Suspension */}
                    <button
                      onClick={() => {
                        toggleTenantStatus(org.id);
                        showNotification(
                          isSuspended
                            ? `Établissement "${org.name}" réactivé avec succès.`
                            : `Établissement "${org.name}" suspendu pour impayé.`
                        );
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        isSuspended
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                          : 'bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30'
                      }`}
                      title={isSuspended ? 'Réactiver le pressing' : 'Suspendre pour défaut de paiement'}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {isSuspended ? 'Débloquer & Activer' : 'Suspendre (Impayé)'}
                    </button>

                    {/* Prolonger l'abonnement (+30 jours) */}
                    <button
                      onClick={() => {
                        extendTenantSubscription(org.id, 30);
                        showNotification(`Abonnement de "${org.name}" prolongé de 30 jours.`);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                      title="Enregistrer un encaissement et prolonger de 30 jours"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                      +30 Jours
                    </button>

                    {/* Relance WhatsApp Impayé */}
                    <a
                      href={generateWhatsAppReminder(org)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-950/40 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 hover:text-white transition-colors"
                      title="Envoyer un rappel de règlement WhatsApp au gérant"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      Relance WhatsApp
                    </a>

                    {/* Basculer sur ce pressing */}
                    <button
                      onClick={() => {
                        switchTenant(org.id);
                        showNotification(`Vous travaillez désormais sur "${org.name}".`);
                      }}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                        isCurrentlySelected
                          ? 'bg-blue-600/30 border border-blue-500/50 text-blue-200 cursor-default'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                      }`}
                    >
                      <span>Se connecter</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredOrganizations.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">Aucun établissement trouvé</h3>
              <p className="text-slate-400 text-sm mb-6">
                Aucun pressing ne correspond à vos filtres actuels.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de création de tenant */}
      <CreateTenantModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newName) => {
          showNotification(`Établissement "${newName}" créé avec succès !`);
        }}
      />
    </div>
  );
}
