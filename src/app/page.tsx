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
} from 'lucide-react';
import { usePressingStore } from '@/lib/store';
import { Client, PaymentMethod, ServiceCode, OrderWithDetails } from '@/types/database';
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
  } = usePressingStore();

  // État du client sélectionné
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(clients[0] || null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  // Filtre catégorie
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // Panier d'articles déposés
  const [cart, setCart] = useState<CartItem[]>([]);

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

  // Articles filtrés par catégorie
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      if (!art.is_active) return false;
      if (selectedCategoryId === 'all') return true;
      return art.category_id === selectedCategoryId;
    });
  }, [articles, selectedCategoryId]);

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

  // Ajout au panier
  const handleAddArticle = (articleId: string, serviceCode: ServiceCode = 'full') => {
    const art = articles.find((a) => a.id === articleId);
    if (!art) return;

    const srv = services.find((s) => s.code === serviceCode);
    const unitPrice = calculateItemPrice(art.base_price, serviceCode, isExpress);

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
    if (!art) return;

    const srv = services.find((s) => s.code === newServiceCode);
    const unitPrice = calculateItemPrice(art.base_price, newServiceCode, isExpress);

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
        if (!art) return item;
        const unitPrice = calculateItemPrice(art.base_price, item.serviceCode, nextExpress);
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
      // Réinitialiser le panier
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
    <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col lg:flex-row gap-5">
      
      {/* ========================================================================= */}
      {/* COLONNE GAUCHE : SÉLECTION CLIENT & SÉLECTEUR TACTILE D'ARTICLES */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col gap-4">
        
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
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
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

        {/* ONGLETS CATÉGORIES TACTILES */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
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
            const count = articles.filter((a) => a.category_id === cat.id).length;
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredArticles.map((article) => {
            const price = calculateItemPrice(article.base_price, 'full', isExpress);
            return (
              <div
                key={article.id}
                className="group relative bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-3.5 flex flex-col justify-between transition-all shadow-sm hover:shadow-md cursor-pointer select-none"
                onClick={() => handleAddArticle(article.id, 'full')}
              >
                {/* Icône & Titre */}
                <div>
                  <div className="w-10 h-10 rounded-xl bg-slate-800 group-hover:bg-blue-600/20 text-slate-300 group-hover:text-blue-400 flex items-center justify-center mb-2 transition-colors">
                    {renderCategoryIcon(article.icon)}
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

                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 group-hover:bg-blue-600 text-blue-400 group-hover:text-white flex items-center justify-center transition-colors">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COLONNE DROITE : TICKET DE COMMANDE & ENCAISSEMENT ACOMPTE */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[410px] xl:w-[440px] flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-4 flex flex-col gap-4 sticky top-20">
          
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
          <div className="flex-1 max-h-[220px] overflow-y-auto space-y-2 pr-1">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Touchez un article à gauche pour l&apos;ajouter au dépôt.
              </div>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={`${item.articleId}-${item.serviceCode}`}
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
                        onClick={() => handleUpdateQty(idx, -1)}
                        className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-bold text-white text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQty(idx, 1)}
                        className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center"
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

                    <div className="font-bold text-white text-xs">
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
                <span className="font-bold text-white text-sm">
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
                <span className={remainingAmount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  {remainingAmount.toLocaleString('fr-FR')} {settings.currency}
                </span>
              </div>
            </div>

            {/* Bouton de validation tactile principal */}
            <button
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

      {/* Modal Reçu Numérique & QR Code */}
      <ReceiptModal
        order={completedOrder}
        settings={settings}
        onClose={() => setCompletedOrder(null)}
      />

      {/* Modal Nouveau Client */}
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
    </div>
  );
}
