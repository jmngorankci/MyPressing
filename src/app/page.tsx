'use client';

import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Search,
  UserPlus,
  Calendar,
  Sparkles,
  Shirt,
  Scissors,
  BedDouble,
  Footprints,
  Crown,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  Receipt,
  Zap,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronRight,
  Clock,
  Check,
  PackagePlus,
  Tag,
  X,
  ShoppingBag,
} from 'lucide-react';
import { usePressingStore } from '@/lib/store';
import { Client, PaymentMethod, ServiceCode, OrderWithDetails, Article } from '@/types/database';
import { ReceiptModal } from '@/components/ReceiptModal';
import { NewClientModal } from '@/components/NewClientModal';

interface CartItem {
  articleId: string;
  articleName: string;
  serviceCode: ServiceCode;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export default function ReceptionPage() {
  const {
    settings,
    categories,
    services,
    articles,
    clients,
    createOrder,
    saveClient,
    saveArticle,
  } = usePressingStore();

  // État du client sélectionné
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(clients[0] || null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  // Filtre catégorie
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [articleSearchQuery, setArticleSearchQuery] = useState('');

  // Panier d'articles déposés
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // Modals pour création d'article
  const [isNewArticleModalOpen, setIsNewArticleModalOpen] = useState(false);
  const [isCustomItemModalOpen, setIsCustomItemModalOpen] = useState(false);

  // Formulaire nouvel article catalogue
  const [newArticleData, setNewArticleData] = useState({
    name: '',
    category_id: categories[0]?.id || 'c1111111-1111-1111-1111-111111111111',
    base_price: 1500,
    icon: 'Shirt',
  });

  // Formulaire article sur-mesure / ponctuel
  const [customItemData, setCustomItemData] = useState({
    name: '',
    price: 2500,
    serviceCode: 'full' as ServiceCode,
    quantity: 1,
  });

  // Option Express & Date de retrait calculée
  const [isExpress, setIsExpress] = useState(false);
  const [pickupDateOffset, setPickupDateOffset] = useState<number>(settings.default_pickup_days || 2);
  const [customPickupDate, setCustomPickupDate] = useState<string>('');

  // Acompte & Paiement
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [orderNotes, setOrderNotes] = useState('');

  // Modal de reçu
  const [completedOrder, setCompletedOrder] = useState<OrderWithDetails | null>(null);

  // Recherche autocomplétion client
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return [];
    const q = clientSearch.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    ).slice(0, 5);
  }, [clientSearch, clients]);

  // Articles filtrés par catégorie et recherche
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      if (!art.is_active) return false;
      if (selectedCategoryId !== 'all' && art.category_id !== selectedCategoryId) return false;
      if (articleSearchQuery.trim() && !art.name.toLowerCase().includes(articleSearchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [articles, selectedCategoryId, articleSearchQuery]);

  // Date de retrait estimée formatée
  const calculatedPickupDate = useMemo(() => {
    if (customPickupDate) {
      return new Date(customPickupDate).toISOString();
    }
    const days = isExpress ? 1 : pickupDateOffset;
    const target = new Date();
    target.setDate(target.getDate() + days);
    target.setHours(17, 0, 0, 0); // 17h00 par défaut
    return target.toISOString();
  }, [isExpress, pickupDateOffset, customPickupDate]);

  // Calcul du prix selon le service sélectionné
  const calculateItemPrice = (basePrice: number, serviceCode: ServiceCode, express: boolean) => {
    const srv = services.find((s) => s.code === serviceCode);
    const multiplier = srv ? srv.price_multiplier : 1.0;
    const additional = srv ? srv.additional_fee : 0;
    let price = Math.round(basePrice * multiplier + additional);
    if (express) {
      price = Math.round(price * (1 + settings.express_surcharge_percent / 100));
    }
    return price;
  };

  // Ajout au panier avec animation flash de confirmation
  const handleAddArticle = (articleId: string, serviceCode: ServiceCode = 'full') => {
    const art = articles.find((a) => a.id === articleId);
    if (!art) return;

    const srv = services.find((s) => s.code === serviceCode);
    const unitPrice = calculateItemPrice(art.base_price, serviceCode, isExpress);

    // Animation de confirmation
    setLastAddedId(articleId);
    setTimeout(() => setLastAddedId(null), 1200);

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.articleId === articleId && item.serviceCode === serviceCode
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + 1;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          totalPrice: newQty * updated[existingIndex].unitPrice,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            articleId: art.id,
            articleName: art.name,
            serviceCode,
            serviceName: srv ? srv.name : 'Nettoyage complet',
            quantity: 1,
            unitPrice,
            totalPrice: unitPrice,
          },
        ];
      }
    });
  };

  // Ajout d'un article sur-mesure / ponctuel au panier
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemData.name.trim() || customItemData.price <= 0) return;

    const srv = services.find((s) => s.code === customItemData.serviceCode);
    let unitPrice = customItemData.price;
    if (isExpress) {
      unitPrice = Math.round(unitPrice * (1 + settings.express_surcharge_percent / 100));
    }

    const newItem: CartItem = {
      articleId: `custom-${Date.now()}`,
      articleName: customItemData.name.trim(),
      serviceCode: customItemData.serviceCode,
      serviceName: srv ? srv.name : 'Service spécial',
      quantity: Number(customItemData.quantity) || 1,
      unitPrice,
      totalPrice: (Number(customItemData.quantity) || 1) * unitPrice,
    };

    setCart((prev) => [newItem, ...prev]);
    setIsCustomItemModalOpen(false);
    setCustomItemData({ name: '', price: 2500, serviceCode: 'full', quantity: 1 });
  };

  // Création d'un nouvel article dans le catalogue général
  const handleCreateCatalogueArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArticleData.name.trim() || newArticleData.base_price <= 0) {
      alert('Veuillez renseigner un nom et un prix valide pour l\'article.');
      return;
    }

    const created = saveArticle({
      name: newArticleData.name.trim(),
      category_id: newArticleData.category_id || categories[0]?.id || 'c1111111-1111-1111-1111-111111111111',
      base_price: Number(newArticleData.base_price),
      icon: newArticleData.icon || 'Shirt',
      is_active: true,
    });

    // Ajouter immédiatement au ticket
    handleAddArticle(created.id, 'full');

    setIsNewArticleModalOpen(false);
    setNewArticleData({
      name: '',
      category_id: categories[0]?.id || 'c1111111-1111-1111-1111-111111111111',
      base_price: 1500,
      icon: 'Shirt',
    });
  };

  // Modification quantité
  const handleUpdateQty = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index] = {
        ...updated[index],
        quantity: newQty,
        totalPrice: newQty * updated[index].unitPrice,
      };
      return updated;
    });
  };

  // Changement de service pour une ligne de panier
  const handleChangeService = (index: number, newServiceCode: ServiceCode) => {
    const art = articles.find((a) => a.id === cart[index].articleId);
    const basePrice = art ? art.base_price : cart[index].unitPrice;

    const srv = services.find((s) => s.code === newServiceCode);
    const unitPrice = calculateItemPrice(basePrice, newServiceCode, isExpress);

    setCart((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        serviceCode: newServiceCode,
        serviceName: srv ? srv.name : '',
        unitPrice,
        totalPrice: updated[index].quantity * unitPrice,
      };
      return updated;
    });
  };

  // Recalcul du panier lors de la bascule Express
  const handleToggleExpress = () => {
    const nextExpress = !isExpress;
    setIsExpress(nextExpress);
    setCart((prev) =>
      prev.map((item) => {
        const art = articles.find((a) => a.id === item.articleId);
        const base = art ? art.base_price : item.unitPrice;
        const unitPrice = calculateItemPrice(base, item.serviceCode, nextExpress);
        return {
          ...item,
          unitPrice,
          totalPrice: item.quantity * unitPrice,
        };
      })
    );
  };

  // Calcul du total du panier
  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [cart]);

  const remainingAmount = Math.max(0, totalAmount - advanceAmount);

  // Raccourcis d'acompte
  const setAdvancePercent = (percent: number) => {
    setAdvanceAmount(Math.round((totalAmount * percent) / 100));
  };

  // Validation finale de la commande
  const handleCreateOrder = async () => {
    if (!selectedClient) {
      alert('Veuillez sélectionner ou créer un client avant de valider.');
      return;
    }
    if (cart.length === 0) {
      alert('Veuillez ajouter au moins un article dans la commande.');
      return;
    }

    try {
      const order = await createOrder({
        client: selectedClient,
        items: cart,
        advanceAmount,
        paymentMethod,
        pickupDate: calculatedPickupDate,
        isExpress,
        notes: orderNotes,
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });

      setCompletedOrder(order);
      setCart([]);
      setAdvanceAmount(0);
      setOrderNotes('');
      setIsExpress(false);
    } catch (err) {
      console.error('Erreur création commande:', err);
      alert('Erreur lors de la validation de la commande');
    }
  };

  // Icône dynamique par catégorie
  const renderCategoryIcon = (iconName: string) => {
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
    <div className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 lg:p-5 flex flex-col lg:flex-row gap-4 lg:gap-5 overflow-x-hidden">
      
      {/* ========================================================================= */}
      {/* COLONNE GAUCHE : SÉLECTION CLIENT & SÉLECTEUR TACTILE D'ARTICLES */}
      {/* ========================================================================= */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        
        {/* BANDEAU CLIENT TACTILE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            
            {/* Recherche Client & Autocomplétion */}
            <div className="relative flex-1">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Rechercher client (N° téléphone ou nom)..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Menu déroulant autocomplétion */}
              {filteredClients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-slate-850 border border-slate-700 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-800">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedClient(c);
                        setClientSearch('');
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-blue-600/20 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-white text-sm">{c.name}</div>
                        <div className="text-xs text-slate-400">{c.phone} - {c.address || 'Sans adresse'}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bouton Nouveau Client */}
            <button
              type="button"
              onClick={() => setIsClientModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-blue-600/25 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nouveau Client</span>
            </button>
          </div>

          {/* Client Actif Sélectionné */}
          {selectedClient && (
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs bg-slate-950/40 p-2.5 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-400">Client guichet :</span>
                <span className="font-bold text-white text-sm">{selectedClient.name}</span>
                <span className="text-blue-400 font-mono font-medium">{selectedClient.phone}</span>
              </div>
              <div className="text-slate-400 hidden sm:block">
                {selectedClient.address && <span>📍 {selectedClient.address}</span>}
              </div>
            </div>
          )}
        </div>

        {/* BARRE D'ACTIONS RAPIDES ARTICLES (RECHERCHE & AJOUTS) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-900/60 p-2.5 rounded-2xl border border-slate-800">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filtrer un vêtement (ex: Chemise, Pantalon, Boubou)..."
              value={articleSearchQuery}
              onChange={(e) => setArticleSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Bouton Créer Article au Catalogue */}
            <button
              type="button"
              onClick={() => setIsNewArticleModalOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
              title="Ajouter un article au catalogue permanent"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>+ Nouvel Article</span>
            </button>

            {/* Bouton Article Sur-Mesure */}
            <button
              type="button"
              onClick={() => setIsCustomItemModalOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all"
              title="Ajouter un article sur-mesure pour cette commande"
            >
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Article Sur-Mesure</span>
            </button>
          </div>
        </div>

        {/* ONGLETS CATÉGORIES TACTILES */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategoryId === 'all'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Tous ({articles.length})</span>
          </button>

          {categories.map((cat) => {
            const count = articles.filter((a) => a.category_id === cat.id && a.is_active).length;
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {renderCategoryIcon(cat.icon)}
                <span>{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* GRILLE TACTILE DES ARTICLES */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {filteredArticles.map((article) => {
            const price = calculateItemPrice(article.base_price, 'full', isExpress);
            const inCartQty = cart
              .filter((i) => i.articleId === article.id)
              .reduce((sum, i) => sum + i.quantity, 0);
            const isJustAdded = lastAddedId === article.id;

            return (
              <div
                key={article.id}
                role="button"
                tabIndex={0}
                className={`group relative bg-slate-900 hover:bg-slate-850 border rounded-2xl p-3.5 flex flex-col justify-between transition-all shadow-sm hover:shadow-md cursor-pointer select-none ${
                  inCartQty > 0
                    ? 'border-blue-500/80 bg-blue-950/20'
                    : 'border-slate-800 hover:border-blue-500/50'
                } ${isJustAdded ? 'ring-2 ring-emerald-400 scale-[1.02]' : ''}`}
                onClick={() => handleAddArticle(article.id, 'full')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleAddArticle(article.id, 'full');
                  }
                }}
              >
                {/* Badge Quantité déjà dans le ticket */}
                {inCartQty > 0 && (
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold text-xs shadow-md border-2 border-slate-950 flex items-center gap-1 animate-in zoom-in-50">
                    <Check className="w-3 h-3" />
                    <span>x{inCartQty}</span>
                  </span>
                )}

                {/* Icône & Titre */}
                <div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-colors ${
                    isJustAdded
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : inCartQty > 0
                      ? 'bg-blue-600/30 text-blue-300'
                      : 'bg-slate-800 text-slate-300 group-hover:bg-blue-600/20 group-hover:text-blue-400'
                  }`}>
                    {isJustAdded ? <Check className="w-5 h-5 stroke-[3]" /> : renderCategoryIcon(article.icon)}
                  </div>
                  <h4 className="text-sm font-semibold text-white leading-tight line-clamp-2">
                    {article.name}
                  </h4>
                </div>

                {/* Prix & Bouton Ajout rapide */}
                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-blue-400">
                      {price.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">{settings.currency}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddArticle(article.id, 'full');
                    }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shadow-sm ${
                      isJustAdded
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                    title="Ajouter au ticket"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message si aucun article trouvé */}
        {filteredArticles.length === 0 && (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <Shirt className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">
              Aucun article ne correspond à ce filtre.
            </p>
            <button
              type="button"
              onClick={() => setIsNewArticleModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Créer cet article maintenant</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* COLONNE DROITE : TICKET DE COMMANDE & ENCAISSEMENT ACOMPTE */}
      {/* ========================================================================= */}
      <div id="reception-cart-panel" className="w-full lg:w-[370px] xl:w-[410px] 2xl:w-[430px] shrink-0 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-3.5 sm:p-4 flex flex-col gap-3 sm:gap-4 sticky top-16 sm:top-20 max-h-[calc(100vh-5rem)] overflow-y-auto">
          
          {/* Header Ticket */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-white text-base">Ticket de Dépôt</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                {cart.reduce((sum, i) => sum + i.quantity, 0)} pièces
              </span>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs text-rose-400 hover:text-rose-300 hover:underline"
              >
                Vider
              </button>
            )}
          </div>

          {/* Option Express Toggle */}
          <div
            onClick={handleToggleExpress}
            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              isExpress
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${isExpress ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-400'}`}>
                <Zap className="w-4 h-4 font-bold" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  Service Express 24h (+{settings.express_surcharge_percent}%)
                </div>
                <div className="text-[11px] text-slate-400">
                  {isExpress ? 'Priorité maximale atelier (Retrait J+1)' : 'Délai standard'}
                </div>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isExpress ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-600'}`}>
              {isExpress && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>

          {/* Date de Retrait Estimée */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>Date de retrait estimée :</span>
              </span>
              <span className="font-bold text-blue-400">
                {new Date(calculatedPickupDate).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })} (17h)
              </span>
            </div>

            {/* Raccourcis de délais */}
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              {[
                { label: 'J+0 (Ce soir)', days: 0 },
                { label: 'J+1 (Demain)', days: 1 },
                { label: 'J+2 (Std)', days: 2 },
                { label: 'J+3', days: 3 },
              ].map((pill) => (
                <button
                  key={pill.days}
                  type="button"
                  onClick={() => {
                    setCustomPickupDate('');
                    setPickupDateOffset(pill.days);
                  }}
                  className={`py-1 px-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    !customPickupDate && pickupDateOffset === pill.days
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Liste des articles dans le panier */}
          <div className="flex-1 min-h-[60px] max-h-[160px] xl:max-h-[220px] overflow-y-auto space-y-2 pr-1">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs space-y-2">
                <ShoppingBag className="w-8 h-8 text-slate-700 mx-auto" />
                <p>Touchez un vêtement à gauche pour l&apos;ajouter au ticket de dépôt.</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={`${item.articleId}-${item.serviceCode}-${idx}`}
                  className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5 text-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">{item.articleName}</div>
                      <div className="text-[11px] text-blue-400 font-mono">
                        {item.unitPrice.toLocaleString('fr-FR')} {settings.currency} / unité
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(idx, -1)}
                        className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center"
                        title="Diminuer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-bold text-white text-sm">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(idx, 1)}
                        className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center"
                        title="Augmenter"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Sélecteur de service (Lavage seul / Repassage seul / Complet) */}
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-700/50">
                    <div className="flex gap-1">
                      {[
                        { code: 'wash' as ServiceCode, label: 'Lavage' },
                        { code: 'iron' as ServiceCode, label: 'Repassage' },
                        { code: 'full' as ServiceCode, label: 'Complet' },
                      ].map((srv) => (
                        <button
                          key={srv.code}
                          type="button"
                          onClick={() => handleChangeService(idx, srv.code)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                            item.serviceCode === srv.code
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {srv.label}
                        </button>
                      ))}
                    </div>

                    <div className="font-bold text-white text-xs font-mono">
                      {item.totalPrice.toLocaleString('fr-FR')} {settings.currency}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ENCAISSEMENT ACOMPTE & MODE DE PAIEMENT */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            {/* Totaux */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Total de la commande :</span>
                <span className="font-bold text-white text-sm font-mono">
                  {totalAmount.toLocaleString('fr-FR')} {settings.currency}
                </span>
              </div>

              {/* Saisie Acompte */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Acompte versé :</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setAdvancePercent(0)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:bg-slate-700"
                    >
                      0%
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdvancePercent(50)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:bg-slate-700"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdvancePercent(100)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:bg-slate-700"
                    >
                      100%
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max={totalAmount}
                    value={advanceAmount || ''}
                    onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                    placeholder="Montant acompte..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400">
                    {settings.currency}
                  </span>
                </div>
              </div>

              {/* Modes de paiement */}
              {advanceAmount > 0 && (
                <div className="pt-1">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Mode d&apos;acompte :
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'cash' as PaymentMethod, label: 'Espèces', icon: Banknote },
                      { id: 'wave' as PaymentMethod, label: 'Wave', icon: Smartphone, color: 'text-cyan-400' },
                      { id: 'orange_money' as PaymentMethod, label: 'Orange', icon: Smartphone, color: 'text-orange-400' },
                      { id: 'card' as PaymentMethod, label: 'Carte', icon: CreditCard },
                    ].map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`py-1.5 px-1 rounded-lg text-[11px] font-medium flex flex-col items-center gap-1 transition-all ${
                          paymentMethod === pm.id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <pm.icon className={`w-3.5 h-3.5 ${pm.color || ''}`} />
                        <span className="truncate">{pm.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reste à payer */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-bold text-sm">
                <span className="text-slate-300">Reste à payer :</span>
                <span className={`font-mono ${remainingAmount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {remainingAmount.toLocaleString('fr-FR')} {settings.currency}
                </span>
              </div>
            </div>

            {/* Bouton de validation tactile principal */}
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={cart.length === 0}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                cart.length > 0
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              <span>Valider Dépôt &amp; Reçu QR</span>
            </button>
          </div>

        </div>
      </div>

      {/* BANDEAU FLOTTANT MOBILE / TABLETTE SI PANIER NON VIDE */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 bg-blue-600 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </div>
            <div>
              <div className="text-xs font-semibold text-blue-100">Total panier</div>
              <div className="text-sm font-bold font-mono">
                {totalAmount.toLocaleString('fr-FR')} {settings.currency}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('reception-cart-panel');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3.5 py-2 rounded-xl bg-white text-blue-900 text-xs font-extrabold flex items-center gap-1 shadow-md"
          >
            <span>Voir le Ticket</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODAL 1 : REÇU NUMÉRIQUE & QR CODE */}
      <ReceiptModal
        order={completedOrder}
        settings={settings}
        onClose={() => setCompletedOrder(null)}
      />

      {/* MODAL 2 : NOUVEAU CLIENT */}
      <NewClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        initialPhone={clientSearch}
        onSave={(data) => {
          const newCli = saveClient(data);
          setSelectedClient(newCli);
          setClientSearch('');
        }}
      />

      {/* MODAL 3 : CRÉATION ARTICLE CATALOGUE (DEPUIS LE GUICHET) */}
      {isNewArticleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-base">Ajouter un Article au Catalogue</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewArticleModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCatalogueArticle} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nom de l&apos;article *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Chemise en Soie, Doudoune, Tapis..."
                  value={newArticleData.name}
                  onChange={(e) => setNewArticleData({ ...newArticleData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Catégorie
                </label>
                <select
                  value={newArticleData.category_id}
                  onChange={(e) => setNewArticleData({ ...newArticleData, category_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  Prix de base ({settings.currency}) *
                </label>
                <input
                  type="number"
                  required
                  min="100"
                  step="50"
                  value={newArticleData.base_price}
                  onChange={(e) => setNewArticleData({ ...newArticleData, base_price: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewArticleModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30"
                >
                  Enregistrer &amp; Ajouter au Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4 : ARTICLE SUR-MESURE / PONCTUEL */}
      {isCustomItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Ajout Article Sur-Mesure</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomItemModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Désignation personnalisée *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Nettoyage Peluche géante, Rideau lin..."
                  value={customItemData.name}
                  onChange={(e) => setCustomItemData({ ...customItemData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Prix unitaire ({settings.currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="100"
                    step="50"
                    value={customItemData.price}
                    onChange={(e) => setCustomItemData({ ...customItemData, price: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={customItemData.quantity}
                    onChange={(e) => setCustomItemData({ ...customItemData, quantity: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Type de service
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { code: 'wash' as ServiceCode, label: 'Lavage' },
                    { code: 'iron' as ServiceCode, label: 'Repassage' },
                    { code: 'full' as ServiceCode, label: 'Complet' },
                  ].map((srv) => (
                    <button
                      key={srv.code}
                      type="button"
                      onClick={() => setCustomItemData({ ...customItemData, serviceCode: srv.code })}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                        customItemData.serviceCode === srv.code
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {srv.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomItemModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
                >
                  Ajouter au Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
