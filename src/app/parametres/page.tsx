'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { usePressingStore } from '@/lib/store';
import { Article, Category, Settings } from '@/types/database';

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

  // Formulaire Paramètres Pressing
  const [formData, setFormData] = useState<Settings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Articles filtrés
  const filteredArticles = articles.filter((art) => {
    if (filterCat !== 'all' && art.category_id !== filterCat) return false;
    if (searchArticle.trim() && !art.name.toLowerCase().includes(searchArticle.toLowerCase()))
      return false;
    return true;
  });

  const handleOpenAddArticle = () => {
    setEditingArticle({
      category_id: categories[0]?.id || 'cat-1',
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
      category_id: editingArticle.category_id || categories[0]?.id || 'cat-1',
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
            Infos Pressing
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
      {activeTab === 'pressing' && (
        <form onSubmit={handleSaveSettingsSubmit} className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Coordonnées de l&apos;Établissement
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nom du Pressing
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
                  Numéro de Téléphone (Caisse / Guichet)
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
                  Adresse / Localisation
                </label>
                <input
                  type="text"
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

              <div>
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

            {/* Template SMS / WhatsApp automatique */}
            <div className="pt-3 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Modèle de message WhatsApp / SMS (Déclenché au statut &quot;Prêt&quot;)
              </label>
              <textarea
                rows={3}
                value={formData.whatsapp_template || ''}
                onChange={(e) => setFormData({ ...formData, whatsapp_template: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Variables disponibles : <code>{'{{client_name}}'}</code>, <code>{'{{order_number}}'}</code>, <code>{'{{shop_name}}'}</code>, <code>{'{{remaining_amount}}'}</code>, <code>{'{{currency}}'}</code>
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {saveSuccess && (
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-4 h-4" /> Paramètres enregistrés avec succès !
                </span>
              )}
              <button
                type="submit"
                className="ml-auto flex items-center gap-2 py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/30"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les Paramètres</span>
              </button>
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
