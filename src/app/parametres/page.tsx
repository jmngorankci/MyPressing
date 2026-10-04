'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Tag,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Save,
  Check,
  RotateCcw,
  Sparkles,
  Smartphone,
  Wifi,
  Database,
  RefreshCw,
  X,
  Layers,
  Shirt,
  Scissors,
  BedDouble,
  Footprints,
  Crown,
  Upload,
  Image as ImageIcon,
  Palette,
  Building2,
  Mail,
  MapPin,
  Receipt,
  FileText,
  QrCode,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { usePressingStore } from '@/lib/store';
import { Article, Category, Settings } from '@/types/database';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';

const COLOR_PRESETS = [
  { name: 'Bleu Royal (Saphir)', value: '#2563eb' },
  { name: 'Vert Émeraude Luxe', value: '#059669' },
  { name: 'Violet Impérial', value: '#7c3aed' },
  { name: 'Ambre & Or Chaud', value: '#d97706' },
  { name: 'Rouge Rubis Prestige', value: '#e11d48' },
  { name: 'Bleu Indigo Minuit', value: '#4f46e5' },
  { name: 'Cyan Lagon Caraïbes', value: '#0891b2' },
  { name: 'Noir Ardoise Prestige', value: '#1e293b' },
];

export default function ParametresPage() {
  const {
    settings,
    categories,
    services,
    articles,
    isOnline,
    isSyncing,
    pendingSyncCount,
    saveArticle,
    deleteArticle,
    saveSettings,
    triggerSync,
    resetToDemoData,
  } = usePressingStore();

  const [activeTab, setActiveTab] = useState<'tarifs' | 'pressing' | 'offline'>('tarifs');

  // Filtre catégorie
  const [filterCat, setFilterCat] = useState<string>('all');
  const [searchArticle, setSearchArticle] = useState('');

  // Formulaire Article (Ajout / Édition)
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);

  // Formulaire Paramètres Blanchisserie
  const [formData, setFormData] = useState<Settings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadMsg, setLogoUploadMsg] = useState<string | null>(null);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      ...settings,
      logo_url: prev.logo_url !== undefined ? prev.logo_url : settings.logo_url,
      primary_color: prev.primary_color || settings.primary_color || '#2563eb',
      ticket_header: prev.ticket_header || settings.ticket_header || '*** PRESSING & BLANCHISSERIE HAUT DE GAMME ***',
      ticket_footer: prev.ticket_footer || settings.ticket_footer || 'Merci pour votre confiance ! Tout vêtement non réclamé sous 90 jours sera cédé.',
    }));
  }, [settings]);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert('L\'image dépasse 4 Mo. Veuillez choisir une image plus légère.');
      return;
    }

    setIsUploadingLogo(true);
    setLogoUploadMsg(null);

    let uploadedUrl: string | null = null;
    const isSupabaseConfigured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock-pressing')
    );

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const supabase = createSupabaseClient() as any;
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `logo-${formData.organization_id || 'default'}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName);
          uploadedUrl = publicUrl;
        }
      } catch (storageErr) {
        console.warn('Storage upload error, using local fallback:', storageErr);
      }
    }

    if (!uploadedUrl) {
      // Fallback Data URL (Base64) fonctionne 100% même sans Supabase
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setFormData((prev) => ({ ...prev, logo_url: base64 }));
        setIsUploadingLogo(false);
        setLogoUploadMsg('Logo chargé avec succès (mode local)');
        setTimeout(() => setLogoUploadMsg(null), 3500);
      };
      reader.readAsDataURL(file);
      return;
    }

    setFormData((prev) => ({ ...prev, logo_url: uploadedUrl }));
    setIsUploadingLogo(false);
    setLogoUploadMsg('Logo téléversé sur Supabase Storage !');
    setTimeout(() => setLogoUploadMsg(null), 3500);
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logo_url: null }));
    setLogoUploadMsg('Logo retiré');
    setTimeout(() => setLogoUploadMsg(null), 2500);
  };

  // Articles filtrés
  const filteredArticles = articles.filter((art) => {
    if (filterCat !== 'all' && art.category_id !== filterCat) return false;
    if (searchArticle.trim() && !art.name.toLowerCase().includes(searchArticle.toLowerCase()))
      return false;
    return true;
  });

  const handleOpenAddArticle = () => {
    setEditingArticle({
      category_id: categories[0]?.id || 'c1111111-1111-1111-1111-111111111111',
      name: '',
      base_price: 1000,
      icon: 'Shirt',
      is_active: true,
    });
    setIsArticleModalOpen(true);
  };

  const handleOpenEditArticle = (art: Article) => {
    setEditingArticle({ ...art });
    setIsArticleModalOpen(true);
  };

  const [articleSuccessMsg, setArticleSuccessMsg] = useState<string | null>(null);

  const handleSaveArticleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle || !editingArticle.name?.trim()) {
      alert('Veuillez renseigner le nom de l\'article.');
      return;
    }
    const price = Number(editingArticle.base_price);
    if (isNaN(price) || price <= 0) {
      alert('Veuillez renseigner un prix valide (supérieur à 0).');
      return;
    }

    const saved = saveArticle({
      id: editingArticle.id,
      category_id: editingArticle.category_id || categories[0]?.id || 'c1111111-1111-1111-1111-111111111111',
      name: editingArticle.name.trim(),
      base_price: price,
      icon: editingArticle.icon || 'Shirt',
      is_active: editingArticle.is_active !== undefined ? editingArticle.is_active : true,
    });

    setIsArticleModalOpen(false);
    setEditingArticle(null);
    setArticleSuccessMsg(`Article "${saved.name}" enregistré avec succès !`);
    setTimeout(() => setArticleSuccessMsg(null), 3000);
  };

  const handleSaveSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const renderIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case 'shirt':
        return <Shirt className="w-4 h-4" />;
      case 'scissors':
        return <Scissors className="w-4 h-4" />;
      case 'sparkles':
        return <Sparkles className="w-4 h-4" />;
      case 'crown':
        return <Crown className="w-4 h-4" />;
      case 'beddouble':
      case 'bed':
        return <BedDouble className="w-4 h-4" />;
      case 'footprints':
        return <Footprints className="w-4 h-4" />;
      default:
        return <Shirt className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-6">
      
      {/* En-tête Paramètres */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Paramètres &amp; Grille Tarifaire
            </h1>
            <p className="text-xs text-slate-400">
              Gérez les articles, prix unitaires, modèles SMS/WhatsApp et la synchronisation Supabase hors-ligne.
            </p>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('tarifs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'tarifs'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tarifs &amp; Articles
          </button>
          <button
            onClick={() => setActiveTab('pressing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'pressing'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Paramètres Blanchisserie
          </button>
          <button
            onClick={() => setActiveTab('offline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'offline'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            PWA &amp; Supabase
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : GRILLE TARIFAIRE & ARTICLES (CRUD COMPLET) */}
      {/* ========================================================================= */}
      {activeTab === 'tarifs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          
          {articleSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{articleSuccessMsg}</span>
            </div>
          )}

          {/* Barre d'action & Filtres */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Rechercher un article..."
                value={searchArticle}
                onChange={(e) => setSearchArticle(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Toutes catégories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleOpenAddArticle}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/30 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un Article</span>
            </button>
          </div>

          {/* Tableau CRUD Articles */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-850 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Article</th>
                  <th className="py-3 px-4">Catégorie</th>
                  <th className="py-3 px-4">Prix de Base ({settings.currency})</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredArticles.map((art) => {
                  const cat = categories.find((c) => c.id === art.category_id);
                  return (
                    <tr key={art.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-slate-800 text-blue-400">
                          {renderIcon(art.icon)}
                        </div>
                        <span>{art.name}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{cat?.name || 'Général'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-400 text-sm">
                        {art.base_price.toLocaleString('fr-FR')} {settings.currency}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            art.is_active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {art.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditArticle(art)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Supprimer l'article "${art.name}" ?`)) {
                              deleteArticle(art.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : PARAMÈTRES DU PRESSING & TEMPLATE SMS/WHATSAPP */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* ONGLET 2 : PARAMÈTRES DE LA BLANCHISSERIE (SAAS MULTI-TENANT) */}
      {/* ========================================================================= */}
      {activeTab === 'pressing' && (
        <form onSubmit={handleSaveSettingsSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* COLONNE GAUCHE : FORMULAIRES DE CONFIGURATION */}
          <div className="xl:col-span-7 space-y-6">
            
            {/* 1. LOGO DE LA BLANCHISSERIE (SUPABASE STORAGE) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="p-2 rounded-xl text-white shadow-sm"
                    style={{ backgroundColor: formData.primary_color || '#2563eb' }}
                  >
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Logo de la Blanchisserie
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Téléversement vers Supabase Storage avec affichage dynamique sur ticket et navigation.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Aperçu du logo actuel */}
                <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-850 flex items-center justify-center p-2 relative group overflow-hidden shrink-0">
                  {formData.logo_url ? (
                    <img
                      src={formData.logo_url}
                      alt="Logo blanchisserie"
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-500">
                      <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <span className="text-[10px] font-semibold block leading-tight">Aucun logo</span>
                    </div>
                  )}
                </div>

                {/* Boutons d'upload et suppression */}
                <div className="flex-1 space-y-2.5 text-center sm:text-left">
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition-all shadow-md shadow-blue-600/30">
                      <Upload className="w-4 h-4" />
                      <span>{formData.logo_url ? 'Changer de logo' : 'Téléverser un logo'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoFileChange}
                        disabled={isUploadingLogo}
                        className="hidden"
                      />
                    </label>

                    {formData.logo_url && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-400 border border-slate-700 text-xs font-semibold transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Formats acceptés : PNG, JPG, WebP ou SVG (Max 4 Mo). Le logo s&apos;imprime automatiquement sur les tickets thermiques.
                  </p>

                  {logoUploadMsg && (
                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 justify-center sm:justify-start">
                      <Check className="w-4 h-4" />
                      <span>{logoUploadMsg}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. IDENTITÉ VISUELLE & COULEUR PRINCIPALE */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="p-2 rounded-xl text-white shadow-sm"
                    style={{ backgroundColor: formData.primary_color || '#2563eb' }}
                  >
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Couleur Principale de la Blanchisserie
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Thème visuel appliqué à la barre de navigation, boutons d&apos;action et tickets.
                    </p>
                  </div>
                </div>

                <span 
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-white shadow-sm"
                  style={{ backgroundColor: formData.primary_color || '#2563eb' }}
                >
                  {formData.primary_color || '#2563eb'}
                </span>
              </div>

              {/* Palette de nuances de prestige */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Palettes Recommandées (1-Clic) :
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {COLOR_PRESETS.map((preset) => {
                    const isSelected = (formData.primary_color || '#2563eb').toLowerCase() === preset.value.toLowerCase();
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, primary_color: preset.value })}
                        className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                          isSelected
                            ? 'bg-slate-800 border-white/60 shadow-md ring-2 ring-white/20'
                            : 'bg-slate-850 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full shrink-0 shadow-sm flex items-center justify-center"
                          style={{ backgroundColor: preset.value }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-200 truncate">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sélecteur personnalisé libre */}
              <div className="flex items-center gap-3 pt-2">
                <label className="text-xs font-semibold text-slate-300">
                  Ou choisir une couleur personnalisée :
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.primary_color || '#2563eb'}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-9 h-9 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.primary_color || '#2563eb'}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-28 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none"
                    placeholder="#2563eb"
                  />
                </div>
              </div>
            </div>

            {/* 3. COORDONNÉES & EMPLACEMENT DE L'ÉTABLISSEMENT */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
                <div 
                  className="p-2 rounded-xl text-white shadow-sm"
                  style={{ backgroundColor: formData.primary_color || '#2563eb' }}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Coordonnées &amp; Emplacement
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Contacts visibles sur les tickets de caisse et la page de suivi client.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nom du Pressing / Blanchisserie *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.shop_name}
                    onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Numéro de Téléphone (Caisse &amp; WhatsApp) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Professionnel
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@votre-pressing.ci"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Adresse &amp; Emplacement Physique *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Devise Monétaire
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FCFA">FCFA (Franc CFA)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GNF">GNF (Franc Guinéen)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Délai Standard de Retrait (Jours)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="14"
                    value={formData.default_pickup_days}
                    onChange={(e) =>
                      setFormData({ ...formData, default_pickup_days: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Majoration Service Express (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={formData.express_surcharge_percent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        express_surcharge_percent: Number(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 4. PERSONNALISATION DES TICKETS THERMIQUES */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
                <div 
                  className="p-2 rounded-xl text-white shadow-sm"
                  style={{ backgroundColor: formData.primary_color || '#2563eb' }}
                >
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Textes du Ticket Thermique
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    En-tête et pied de page imprimés sur chaque ticket de caisse client.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Texte d&apos;En-tête du Ticket (Slogan, RCCM, Mentions)
                </label>
                <input
                  type="text"
                  value={formData.ticket_header || ''}
                  onChange={(e) => setFormData({ ...formData, ticket_header: e.target.value })}
                  placeholder="ex: *** PRESSING & BLANCHISSERIE HAUT DE GAMME ***"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Texte de Pied de Ticket (Mentions légales, Délais de garde, Remerciements)
                </label>
                <textarea
                  rows={2}
                  value={formData.ticket_footer || ''}
                  onChange={(e) => setFormData({ ...formData, ticket_footer: e.target.value })}
                  placeholder="ex: Merci pour votre confiance ! Tout vêtement non réclamé sous 90 jours sera cédé."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Template WhatsApp */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Modèle de Message WhatsApp 1-Click (Statut Prêt)
                </label>
                <textarea
                  rows={3}
                  value={formData.whatsapp_template || ''}
                  onChange={(e) => setFormData({ ...formData, whatsapp_template: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Variables : <code>{'{{client_name}}'}</code>, <code>{'{{order_number}}'}</code>, <code>{'{{shop_name}}'}</code>, <code>{'{{remaining_amount}}'}</code>, <code>{'{{currency}}'}</code>
                </p>
              </div>
            </div>

            {/* BOUTON ENREGISTRER */}
            <div className="pt-2 flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
              <div>
                {saveSuccess ? (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 animate-in fade-in">
                    <Check className="w-4 h-4" /> Paramètres blanchisserie enregistrés avec succès !
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">
                    Modifications sauvegardées localement et synchronisées avec Supabase.
                  </span>
                )}
              </div>
              <button
                type="submit"
                style={{ backgroundColor: formData.primary_color || '#2563eb' }}
                className="flex items-center gap-2 py-3 px-6 rounded-xl text-white text-xs font-bold transition-all shadow-lg hover:brightness-110 active:scale-95 shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les Paramètres</span>
              </button>
            </div>

          </div>

          {/* COLONNE DROITE : APERÇU LIVE DU TICKET THERMIQUE 80MM */}
          <div className="xl:col-span-5 sticky top-20 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider px-1">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-blue-400" />
                <span>Aperçu Live Ticket Thermique (80mm)</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold">● Temps Réel</span>
            </div>

            {/* TICKET DE CAISSE THERMIQUE BLANC AVEC DÉCOUPES RÉALISTES */}
            <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-2xl font-mono text-xs space-y-3.5 border border-slate-200">
              
              {/* Entête avec Logo */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                {formData.logo_url ? (
                  <div className="flex justify-center mb-2">
                    <img
                      src={formData.logo_url}
                      alt="Logo"
                      className="max-h-14 max-w-[170px] object-contain rounded"
                    />
                  </div>
                ) : (
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 text-white font-bold"
                    style={{ backgroundColor: formData.primary_color || '#2563eb' }}
                  >
                    <Sparkles className="w-6 h-6" />
                  </div>
                )}

                {formData.ticket_header && (
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">
                    {formData.ticket_header}
                  </p>
                )}

                <h2 className="text-base font-black uppercase tracking-tight text-slate-900">
                  {formData.shop_name || 'Pressing Royal Ivoire'}
                </h2>
                <p className="text-[11px] text-slate-600">{formData.address || 'Abidjan, Cocody'}</p>
                <p className="text-[11px] font-semibold text-slate-800">Tél : {formData.phone || '+225 07 00 00 00 00'}</p>
                {formData.email && (
                  <p className="text-[10px] text-slate-500">{formData.email}</p>
                )}

                <div 
                  className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-bold text-[11px] text-white"
                  style={{ backgroundColor: formData.primary_color || '#2563eb' }}
                >
                  TICKET DE DÉPÔT : #PRS-2026-0042
                </div>
              </div>

              {/* Détails Client & Retrait */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Client :</span>
                  <span className="font-bold text-slate-900">Kouassi Jean-Philippe</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Téléphone :</span>
                  <span className="font-medium text-slate-800">+225 07 47 12 34 56</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date dépôt :</span>
                  <span>{new Date().toLocaleDateString('fr-FR')}</span>
                </div>
                <div 
                  className="flex justify-between font-bold"
                  style={{ color: formData.primary_color || '#1d4ed8' }}
                >
                  <span>Date retrait prévue :</span>
                  <span>
                    {new Date(Date.now() + (formData.default_pickup_days || 2) * 86400000).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>

              {/* Articles d'exemple */}
              <div className="space-y-1 border-b border-dashed border-slate-300 pb-2.5">
                <div className="flex justify-between font-bold text-slate-600 text-[10px] uppercase pb-1">
                  <span>Article / Service</span>
                  <span>Qté x P.U</span>
                  <span>Total</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <div>
                    <div className="font-semibold text-slate-800">Chemise Homme</div>
                    <div className="text-[10px] text-slate-500">Nettoyage complet</div>
                  </div>
                  <div className="text-slate-600">3 x 1 000</div>
                  <div className="font-semibold text-slate-900">3 000</div>
                </div>
                <div className="flex justify-between text-[11px]">
                  <div>
                    <div className="font-semibold text-slate-800">Costume 2 Pièces</div>
                    <div className="text-[10px] text-slate-500">Nettoyage complet</div>
                  </div>
                  <div className="text-slate-600">1 x 3 000</div>
                  <div className="font-semibold text-slate-900">3 000</div>
                </div>
              </div>

              {/* Totaux & Financier */}
              <div className="space-y-1.5 pt-0.5 text-[12px]">
                <div className="flex justify-between text-slate-600">
                  <span>TOTAL COMMANDE :</span>
                  <span className="font-bold text-slate-900">
                    6 000 {formData.currency}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Acompte versé (Wave) :</span>
                  <span className="font-bold">- 2 000 {formData.currency}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold border-t border-slate-300 pt-1.5">
                  <span className="text-slate-900">RESTE À PAYER :</span>
                  <span 
                    className="font-black"
                    style={{ color: formData.primary_color || '#e11d48' }}
                  >
                    4 000 {formData.currency}
                  </span>
                </div>
              </div>

              {/* QR Code de Suivi */}
              <div className="pt-2 text-center flex flex-col items-center justify-center">
                <div className="p-2 bg-white border border-slate-300 rounded-lg shadow-sm">
                  <QRCodeSVG
                    value={`https://mypressing.ci/suivi/PRS-2026-0042`}
                    size={100}
                    level="M"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Scannez pour suivre l&apos;état en temps réel
                </p>
                <p className="text-[9px] text-slate-500 mt-1 px-1 italic text-center font-sans">
                  {formData.ticket_footer || 'Merci pour votre confiance ! Tout vêtement non réclamé sous 90 jours sera cédé.'}
                </p>
              </div>

            </div>
          </div>

        </form>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 3 : PWA & CONNEXION SUPABASE HORS-LIGNE */}
      {/* ========================================================================= */}
      {activeTab === 'offline' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                État de Synchronisation &amp; Résistance Réseau
              </h3>
              <p className="text-xs text-slate-400">
                Architecture PWA avec Service Worker et file d&apos;attente IndexedDB/localStorage.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Statut Réseau</span>
              <div className="flex items-center gap-2 text-base font-bold mt-1">
                {isOnline ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    <span className="text-emerald-400">En Ligne</span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
                    <span className="text-rose-400">Hors-ligne (Actif local)</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Actions Hors-ligne en Attente</span>
              <div className="text-base font-bold text-white mt-1">
                {pendingSyncCount} transaction(s) dans la file
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Connecteur Supabase</span>
              <div className="text-base font-bold text-blue-400 mt-1">
                @supabase/ssr actif
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => triggerSync()}
              disabled={isSyncing}
              className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-600/30"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Synchroniser vers Supabase maintenant</span>
            </button>

            <button
              onClick={() => {
                if (confirm('Voulez-vous restaurer les données de démonstration initiales ?')) {
                  resetToDemoData();
                  alert('Données réinitialisées avec succès !');
                }
              }}
              className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all border border-slate-700"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Réinitialiser aux Données Démo</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL AJOUT / ÉDITION ARTICLE */}
      {isArticleModalOpen && editingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">
                {editingArticle.id ? 'Modifier l’Article' : 'Ajouter un Nouvel Article'}
              </h3>
              <button
                onClick={() => setIsArticleModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveArticleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nom de l&apos;Article *
                </label>
                <input
                  type="text"
                  required
                  value={editingArticle.name || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Catégorie
                </label>
                <select
                  value={editingArticle.category_id || categories[0]?.id}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle, category_id: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Prix de Base ({settings.currency}) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="50"
                  value={editingArticle.base_price || 0}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle, base_price: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Icône
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {[
                    { id: 'Shirt', label: 'Haut' },
                    { id: 'Scissors', label: 'Bas' },
                    { id: 'Sparkles', label: 'Élégant' },
                    { id: 'Crown', label: 'Traditionnel' },
                    { id: 'BedDouble', label: 'Maison' },
                    { id: 'Footprints', label: 'Chaussure' },
                  ].map((ic) => (
                    <button
                      key={ic.id}
                      type="button"
                      onClick={() => setEditingArticle({ ...editingArticle, icon: ic.id })}
                      className={`p-2 rounded-lg border flex flex-col items-center gap-1 ${
                        editingArticle.icon === ic.id
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {renderIcon(ic.id)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="art-active"
                  checked={editingArticle.is_active}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle, is_active: e.target.checked })
                  }
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                />
                <label htmlFor="art-active" className="text-xs text-slate-300">
                  Article actif et disponible en caisse
                </label>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsArticleModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-600/30"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
