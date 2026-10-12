'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Building2,
  Sparkles,
  X,
  Check,
  CheckCircle2,
  Palette,
  Phone,
  Mail,
  MapPin,
  Coins,
  Receipt,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { usePressingStore } from '@/lib/store';

const COLOR_PRESETS = [
  { name: 'Bleu Royal (Saphir)', value: '#2563eb' },
  { name: 'Vert Émeraude Luxe', value: '#059669' },
  { name: 'Violet Impérial', value: '#7c3aed' },
  { name: 'Ambre & Or Chaud', value: '#d97706' },
  { name: 'Rouge Rubis Prestige', value: '#e11d48' },
  { name: 'Bleu Indigo Minuit', value: '#4f46e5' },
  { name: 'Cyan Lagon', value: '#0891b2' },
  { name: 'Noir Ardoise Prestige', value: '#1e293b' },
];

const CURRENCIES = [
  { code: 'FCFA', label: 'FCFA — Franc CFA (Afrique de l’Ouest & Centrale)' },
  { code: 'EUR', label: 'EUR (€) — Euro' },
  { code: 'USD', label: 'USD ($) — Dollar US' },
  { code: 'GNF', label: 'GNF — Franc Guinéen' },
  { code: 'MAD', label: 'MAD — Dirham Marocain' },
  { code: 'XOF', label: 'XOF — Franc CFA UEMOA' },
];

interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newOrgName: string) => void;
}

export function CreateTenantModal({ isOpen, onClose, onSuccess }: CreateTenantModalProps) {
  const { createTenant } = usePressingStore();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugAuto, setSlugAuto] = useState(true);
  const [phone, setPhone] = useState('+225 ');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('FCFA');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [seedCatalog, setSeedCatalog] = useState(true);

  // Accordéon options de ticket thermique
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ticketHeader, setTicketHeader] = useState('');
  const [ticketFooter, setTicketFooter] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-génération du slug
  useEffect(() => {
    if (slugAuto && name.trim()) {
      const generated = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generated);
    }
  }, [name, slugAuto]);

  // Réinitialiser les champs quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setName('');
      setSlug('');
      setSlugAuto(true);
      setPhone('+225 ');
      setEmail('');
      setAddress('');
      setCurrency('FCFA');
      setPrimaryColor('#2563eb');
      setSeedCatalog(true);
      setShowAdvanced(false);
      setTicketHeader('');
      setTicketFooter('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Fermeture par la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Veuillez spécifier le nom du pressing ou de la blanchisserie.');
      return;
    }

    if (!phone.trim() || phone.trim() === '+225') {
      setErrorMsg('Veuillez renseigner un numéro de téléphone guichet / WhatsApp.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const newOrg = await createTenant({
        name: name.trim(),
        slug: slug.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || 'Abidjan',
        currency,
        primary_color: primaryColor,
        ticket_header: ticketHeader.trim() || undefined,
        ticket_footer: ticketFooter.trim() || undefined,
        seedCatalog,
      });

      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 },
      });

      if (onSuccess) {
        onSuccess(newOrg.name);
      }
      onClose();
    } catch (err: any) {
      console.error('Erreur lors de la création du tenant:', err);
      setErrorMsg(err?.message || 'Une erreur est survenue lors de la création.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 md:p-6 flex items-center justify-center animate-in fade-in duration-200">
      
      {/* Conteneur de la Modale */}
      <div 
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl text-slate-100 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Bandeau supérieur d'accentuation couleur */}
        <div 
          className="h-2 w-full transition-colors duration-300 shrink-0" 
          style={{ backgroundColor: primaryColor }} 
        />

        {/* 1. EN-TÊTE FIXÉ (Toujours visible au sommet) */}
        <div className="shrink-0 flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 transition-colors"
              style={{ backgroundColor: primaryColor, boxShadow: `0 8px 16px -2px ${primaryColor}40` }}
            >
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Créer un Nouveau Pressing
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  Tenant SaaS B2B
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Créez une blanchisserie étanche avec sa propre identité, devise et catalogue de tarifs.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors shrink-0"
            title="Fermer (Échap)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. CORPS DU FORMULAIRE DÉFILABLE */}
        <form 
          id="create-tenant-form" 
          onSubmit={handleSubmit} 
          className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5"
        >
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1 : IDENTITÉ DU PRESSING & DEVISE */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
              <Building2 className="w-4 h-4" />
              <span>1. Identité Commerciale &amp; Devise</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Nom Commercial du Pressing / Blanchisserie <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="ex: Pressing Royal Riviera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>Identifiant Unique (Slug URL) <span className="text-rose-400">*</span></span>
                  {!slugAuto && (
                    <button
                      type="button"
                      onClick={() => setSlugAuto(true)}
                      className="text-[10px] text-blue-400 hover:underline"
                    >
                      Réactiver auto
                    </button>
                  )}
                </label>
                <input
                  type="text"
                  required
                  placeholder="pressing-royal-riviera"
                  value={slug}
                  onChange={(e) => {
                    setSlugAuto(false);
                    setSlug(e.target.value);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Utilisé pour l&apos;URL de suivi client et l&apos;étanchéité multi-tenant.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>Devise Monétaire Principale <span className="text-rose-400">*</span></span>
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2 : COORDONNÉES DE CONTACT & LOCALISATION */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <MapPin className="w-4 h-4" />
              <span>2. Coordonnées de Contact &amp; Boutique</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Téléphone Guichet &amp; WhatsApp <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="+225 07 00 00 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Sera utilisé pour les notifications WhatsApp 1-Click aux clients.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  <span>Email Professionnel (Optionnel)</span>
                </label>
                <input
                  type="email"
                  placeholder="contact@pressing-riviera.ci"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Adresse Physique / Localisation Magasin</span>
                </label>
                <input
                  type="text"
                  placeholder="ex: Rond-point Saint-Viateur, Riviera Palmeraie, Abidjan"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3 : IDENTITÉ VISUELLE (COULEUR THÉMATIQUE) */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-4 h-4" />
                <span>3. Couleur Principale de la Blanchisserie</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-300">{primaryColor}</span>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0"
                  title="Code HEX libre"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5 pt-1">
              {COLOR_PRESETS.map((color) => {
                const isSelected = primaryColor.toLowerCase() === color.value.toLowerCase();
                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setPrimaryColor(color.value)}
                    title={color.name}
                    className={`h-10 rounded-xl flex items-center justify-center transition-all ${
                      isSelected
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105 shadow-lg'
                        : 'hover:scale-95 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color.value }}
                  >
                    {isSelected && <Check className="w-5 h-5 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 4 : PROVISIONING AUTOMATIQUE DU CATALOGUE */}
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3.5">
            <input
              type="checkbox"
              id="seedCatalog"
              checked={seedCatalog}
              onChange={(e) => setSeedCatalog(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-600 cursor-pointer shrink-0"
            />
            <label htmlFor="seedCatalog" className="cursor-pointer text-xs text-slate-300 leading-relaxed space-y-1">
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Initialiser avec le catalogue standard de blanchisserie (Recommandé)</span>
              </div>
              <p className="text-slate-400">
                Génère instantanément les 6 catégories de pressing (Hauts, Bas, Costumes, Traditionnel, Linge, Chaussures), les 4 formules (Lavage, Repassage, Nettoyage complet, Express) et 14 articles avec tarifs de base prêts à l&apos;emploi.
              </p>
            </label>
          </div>

          {/* SECTION 5 : OPTIONS AVANCÉES TICKET THERMIQUE 80MM */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-800/40 hover:bg-slate-800/70 text-xs font-semibold text-slate-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-400" />
                <span>Personnalisation des tickets thermiques 80mm (Optionnel)</span>
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="p-5 space-y-4 border-t border-slate-800 text-xs bg-slate-900/60">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">En-tête personnalisé du ticket thermique</label>
                  <input
                    type="text"
                    placeholder={`*** ${name ? name.toUpperCase() : 'PRESSING PROFESSIONNEL'} ***`}
                    value={ticketHeader}
                    onChange={(e) => setTicketHeader(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Pied de page (conditions de garde &amp; mentions légales)</label>
                  <input
                    type="text"
                    placeholder="Merci pour votre confiance ! Tout vêtement non réclamé sous 90 jours sera cédé."
                    value={ticketFooter}
                    onChange={(e) => setTicketFooter(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        {/* 3. PIED DE PAGE FIXÉ (Toujours accessible sans défiler) */}
        <div className="shrink-0 flex items-center justify-between px-5 sm:px-7 py-4 border-t border-slate-800 bg-slate-900/95">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Données et caisse 100% isolées</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 sm:px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs sm:text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="create-tenant-form"
              disabled={isSubmitting}
              style={{ backgroundColor: primaryColor }}
              className="flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Création en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Créer &amp; Basculer vers ce Pressing</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
