'use client';

import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Receipt,
  Search,
  QrCode,
  CheckCircle2,
  Banknote,
  Smartphone,
  CreditCard,
  ArrowRight,
  Printer,
  Sparkles,
  AlertCircle,
  Clock,
  User,
  Phone,
  Calculator,
  RotateCcw,
} from 'lucide-react';
import { usePressingStore } from '@/lib/store';
import { OrderWithDetails, PaymentMethod } from '@/types/database';
import { ReceiptModal } from '@/components/ReceiptModal';

export default function CaisseRetraitPage() {
  const { orders, settings, checkoutAndDeliverOrder } = usePressingStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Paiement & Monnaie
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [cashierNote, setCashierNote] = useState('');

  // Modal Reçu
  const [receiptModalOrder, setReceiptModalOrder] = useState<OrderWithDetails | null>(null);

  // Commandes prêtes pour retrait en priorité
  const readyOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'ready' || o.status === 'to_process' || o.status === 'in_progress');
  }, [orders]);

  // Commande actuellement sélectionnée
  const selectedOrder = useMemo(() => {
    if (selectedOrderId) {
      return orders.find((o) => o.id === selectedOrderId) || null;
    }
    // Si rien de sélectionné manuellement, prendre la première commande prête
    return readyOrders.find((o) => o.status === 'ready') || readyOrders[0] || null;
  }, [selectedOrderId, orders, readyOrders]);

  // Recherche rapide
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.client.name.toLowerCase().includes(q) ||
        o.client.phone.includes(q)
    );
  }, [searchQuery, orders]);

  // Reste à payer pour la commande sélectionnée
  const remainingAmount = selectedOrder ? selectedOrder.remaining_amount : 0;

  // Calcul automatique de la monnaie à rendre
  const changeToReturn = useMemo(() => {
    if (paymentMethod !== 'cash' || !amountReceived) return 0;
    return Math.max(0, amountReceived - remainingAmount);
  }, [paymentMethod, amountReceived, remainingAmount]);

  // Décomposition de la monnaie à rendre (billets & pièces)
  const changeBreakdown = useMemo(() => {
    if (changeToReturn <= 0) return [];
    let rem = changeToReturn;
    const denominations = [10000, 5000, 2000, 1000, 500, 200, 100, 50];
    const breakdown: Array<{ value: number; count: number; type: 'billet' | 'piece' }> = [];

    denominations.forEach((denom) => {
      const count = Math.floor(rem / denom);
      if (count > 0) {
        breakdown.push({
          value: denom,
          count,
          type: denom >= 1000 ? 'billet' : 'piece',
        });
        rem = rem % denom;
      }
    });

    return breakdown;
  }, [changeToReturn]);

  // Définition rapide du montant reçu
  const handleQuickAmount = (val: number) => {
    setAmountReceived(val);
  };

  // Validation finale du paiement et remise du linge
  const handleValidateCheckout = async () => {
    if (!selectedOrder) return;

    if (remainingAmount > 0 && paymentMethod === 'cash' && amountReceived < remainingAmount) {
      alert('Le montant en espèces reçu est inférieur au reste à payer.');
      return;
    }

    try {
      const updatedOrder = await checkoutAndDeliverOrder({
        orderId: selectedOrder.id,
        amountToPay: remainingAmount,
        paymentMethod,
        amountReceived: paymentMethod === 'cash' ? amountReceived : remainingAmount,
        changeReturned: changeToReturn,
        cashierNote,
      });

      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 },
      });

      setReceiptModalOrder(updatedOrder);
      setAmountReceived(0);
      setCashierNote('');
      setSearchQuery('');
    } catch (err) {
      console.error('Erreur encaissement:', err);
      alert('Erreur lors de la validation du retrait.');
    }
  };

  // Simulation d'un scan QR code
  const handleSimulateScan = () => {
    const readyOne = readyOrders.find((o) => o.status === 'ready');
    if (readyOne) {
      setSelectedOrderId(readyOne.id);
      setSearchQuery(readyOne.order_number);
      setAmountReceived(readyOne.remaining_amount);
    } else if (orders.length > 0) {
      setSelectedOrderId(orders[0].id);
      setSearchQuery(orders[0].order_number);
      setAmountReceived(orders[0].remaining_amount);
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 flex flex-col lg:flex-row gap-5">
      
      {/* ========================================================================= */}
      {/* COLONNE GAUCHE : RECHERCHE & SÉLECTION COMMANDE */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[420px] flex flex-col gap-4">
        
        {/* Barre de Recherche & Scan QR */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-400" />
              <span>Recherche Commande</span>
            </h2>
            <button
              onClick={handleSimulateScan}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-xs font-semibold transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan QR Rapide</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Scanner code, réf (ex: PRS-2026-0040), nom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              autoFocus
            />
          </div>

          {/* Résultats de recherche filtrés */}
          {searchResults.length > 0 && (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pt-1">
              <div className="text-[11px] font-semibold text-slate-400">Résultats correspondants :</div>
              {searchResults.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setSelectedOrderId(o.id);
                    setAmountReceived(o.remaining_amount);
                  }}
                  className={`w-full p-2.5 rounded-xl text-left text-xs flex items-center justify-between transition-all ${
                    selectedOrder?.id === o.id
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-850 hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <div>
                    <div className="font-mono">#{o.order_number}</div>
                    <div className="text-[11px] text-slate-300">{o.client.name} - {o.client.phone}</div>
                  </div>
                  <div className="text-right">
                    <div>{o.remaining_amount.toLocaleString('fr-FR')} {settings.currency}</div>
                    <div className="text-[10px] uppercase font-bold text-emerald-300">{o.status}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Liste des commandes prêtes pour retrait */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex-1 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              En attente de retrait ({readyOrders.length})
            </h3>
            <span className="text-[11px] text-emerald-400 font-semibold">
              ● {readyOrders.filter((o) => o.status === 'ready').length} Prêtes
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 mt-3 max-h-[380px]">
            {readyOrders.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs italic">
                Aucune commande en attente de retrait
              </div>
            ) : (
              readyOrders.map((o) => {
                const isSelected = selectedOrder?.id === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => {
                      setSelectedOrderId(o.id);
                      setAmountReceived(o.remaining_amount);
                    }}
                    className={`w-full p-3 rounded-xl text-left border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                        : 'bg-slate-850/80 border-slate-800 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-xs">
                          #{o.order_number}
                        </span>
                        {o.status === 'ready' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Prêt
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-slate-200 mt-0.5">
                        {o.client.name}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold font-mono">
                        {o.remaining_amount > 0 ? (
                          <span className="text-rose-400">
                            Reste: {o.remaining_amount.toLocaleString('fr-FR')} {settings.currency}
                          </span>
                        ) : (
                          <span className="text-emerald-400">Soldé (0 {settings.currency})</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {o.items.reduce((s, i) => s + i.quantity, 0)} articles
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* COLONNE DROITE : CONTRÔLE SOLDE, CALCULATEUR MONNAIE & VALIDATION */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col gap-4">
        {selectedOrder ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
            
            {/* Header Commande Sélectionnée */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    #{selectedOrder.order_number}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                    selectedOrder.status === 'ready'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {selectedOrder.status === 'ready' ? 'Prêt pour retrait' : selectedOrder.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {selectedOrder.client.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedOrder.client.phone} • {selectedOrder.client.address || 'Abidjan'}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-xs text-slate-400">Totalité commande</div>
                <div className="text-lg font-extrabold text-white">
                  {selectedOrder.total_amount.toLocaleString('fr-FR')} {settings.currency}
                </div>
              </div>
            </div>

            {/* Récapitulatif Financier */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800">
                <span className="text-xs text-slate-400">Total Facturé</span>
                <div className="text-base font-bold text-white mt-1">
                  {selectedOrder.total_amount.toLocaleString('fr-FR')} {settings.currency}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800">
                <span className="text-xs text-slate-400">Acompte déjà versé</span>
                <div className="text-base font-bold text-emerald-400 mt-1">
                  - {selectedOrder.advance_amount.toLocaleString('fr-FR')} {settings.currency}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800">
                <span className="text-xs text-slate-400">SOLDE DU (À ENCAISSER)</span>
                <div className={`text-lg font-extrabold mt-1 ${remainingAmount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {remainingAmount.toLocaleString('fr-FR')} {settings.currency}
                </div>
              </div>
            </div>

            {/* Si reste à payer > 0 : Sélection Mode de paiement & Calculateur de monnaie */}
            {remainingAmount > 0 ? (
              <div className="space-y-4 pt-2">
                
                {/* Choix Mode de Paiement */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Mode d&apos;encaissement du solde :
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'cash' as PaymentMethod, label: 'Espèces', icon: Banknote },
                      { id: 'wave' as PaymentMethod, label: 'Wave (Mobile)', icon: Smartphone, color: 'text-cyan-400' },
                      { id: 'orange_money' as PaymentMethod, label: 'Orange Money', icon: Smartphone, color: 'text-orange-400' },
                      { id: 'card' as PaymentMethod, label: 'Carte Bancaire', icon: CreditCard },
                    ].map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(pm.id);
                          if (pm.id !== 'cash') {
                            setAmountReceived(remainingAmount);
                          }
                        }}
                        className={`py-3 px-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                          paymentMethod === pm.id
                            ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                            : 'bg-slate-850 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <pm.icon className={`w-5 h-5 ${pm.color || ''}`} />
                        <span className="text-xs font-semibold">{pm.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CALCULATEUR DE MONNAIE TACTILE EN CAS D'ESPÈCES */}
                {paymentMethod === 'cash' && (
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Calculator className="w-4 h-4 text-blue-400" />
                        <span>Calculateur de Monnaie à Rendre</span>
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[11px] text-slate-400 block mb-1">
                          Montant remis par le client :
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={amountReceived || ''}
                            onChange={(e) => setAmountReceived(Number(e.target.value))}
                            placeholder="Montant reçu..."
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="absolute right-3.5 top-3 text-xs text-slate-400 font-mono">
                            {settings.currency}
                          </span>
                        </div>
                      </div>

                      {/* Raccourcis coupures billets */}
                      <div className="flex flex-wrap gap-1.5 items-end">
                        {[
                          remainingAmount,
                          1000,
                          2000,
                          5000,
                          10000,
                        ].filter((v, i, a) => a.indexOf(v) === i && v >= remainingAmount).slice(0, 4).map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleQuickAmount(val)}
                            className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono font-medium text-slate-200 border border-slate-700"
                          >
                            {val.toLocaleString('fr-FR')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Résultat Monnaie à rendre */}
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-300">
                        MONNAIE À RENDRE AU CLIENT :
                      </span>
                      <span className={`text-xl font-extrabold font-mono ${
                        changeToReturn > 0 ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {changeToReturn.toLocaleString('fr-FR')} {settings.currency}
                      </span>
                    </div>

                    {/* Décomposition des coupures conseillées */}
                    {changeBreakdown.length > 0 && (
                      <div className="text-xs text-slate-400 flex flex-wrap gap-2 pt-1 items-center">
                        <span className="text-[11px] font-semibold">Coupures suggérées :</span>
                        {changeBreakdown.map((item, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px] border border-slate-700"
                          >
                            {item.count} x {item.value.toLocaleString('fr-FR')} {settings.currency}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-emerald-300 text-sm">
                    Commande Déjà Intégralement Payée
                  </div>
                  <div className="text-xs text-emerald-400/80">
                    Aucun encaissement requis. Vous pouvez remettre les vêtements directement au client.
                  </div>
                </div>
              </div>
            )}

            {/* Note d'encaissement optionnelle */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Remarque caissier au retrait (optionnel) :
              </label>
              <input
                type="text"
                value={cashierNote}
                onChange={(e) => setCashierNote(e.target.value)}
                placeholder="ex: Remis à Madame en mains propres"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* BOUTON FINAL : ENCAISSER ET VALIDER LE RETRAIT */}
            <div className="pt-2">
              <button
                onClick={handleValidateCheckout}
                disabled={remainingAmount > 0 && paymentMethod === 'cash' && amountReceived < remainingAmount}
                className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-xl ${
                  remainingAmount > 0 && paymentMethod === 'cash' && amountReceived < remainingAmount
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 hover:scale-[1.01]'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {remainingAmount > 0
                    ? `Encaisser ${remainingAmount.toLocaleString('fr-FR')} ${settings.currency} & Valider Retrait`
                    : 'Confirmer la Restitution & Clôturer Commande'}
                </span>
              </button>
            </div>

          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center justify-center h-full">
            <Receipt className="w-12 h-12 text-slate-700 mb-3" />
            <h4 className="text-base font-semibold text-slate-400">Aucune commande sélectionnée</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Scannez le ticket QR client ou sélectionnez une commande dans la liste à gauche pour procéder à l&apos;encaissement.
            </p>
          </div>
        )}
      </div>

      {/* Modal Reçu Définitif Soldé */}
      <ReceiptModal
        order={receiptModalOrder}
        settings={settings}
        onClose={() => setReceiptModalOrder(null)}
      />

    </div>
  );
}
