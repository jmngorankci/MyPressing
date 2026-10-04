'use client';

import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  Share2,
  X,
  CheckCircle2,
  Calendar,
  Phone,
  User,
  Clock,
  Sparkles,
  CreditCard,
  QrCode,
  Flame,
} from 'lucide-react';
import { OrderWithDetails, Settings } from '@/types/database';

interface ReceiptModalProps {
  order: OrderWithDetails | null;
  settings: Settings;
  onClose: () => void;
}

export function ReceiptModal({ order, settings, onClose }: ReceiptModalProps) {
  if (!order) return null;

  const receiptRef = useRef<HTMLDivElement>(null);

  const formattedCreated = new Date(order.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedPickup = new Date(order.pickup_date).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  // Préparation du message WhatsApp
  const cleanPhone = order.client.phone.replace(/[^0-9]/g, '');
  const itemsSummary = order.items
    .map((item) => `• ${item.quantity}x ${item.article_name} (${item.total_price.toLocaleString('fr-FR')} ${settings.currency})`)
    .join('\n');

  const trackingUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/suivi/${order.id}` 
    : `http://localhost:3000/suivi/${order.id}`;

  const whatsappMessage = `*${settings.shop_name}* 🧺\n\nCher(e) *${order.client.name}*,\nVotre dépôt est bien enregistré !\n\n📋 *Commande :* #${order.order_number}\n📅 *Retrait prévu :* ${formattedPickup}\n\n*Articles déposés :*\n${itemsSummary}\n\n💰 *Total :* ${order.total_amount.toLocaleString('fr-FR')} ${settings.currency}\n💳 *Acompte :* ${order.advance_amount.toLocaleString('fr-FR')} ${settings.currency}\n⚠️ *Reste à payer :* ${order.remaining_amount.toLocaleString('fr-FR')} ${settings.currency}\n\n📱 *Suivre votre commande en direct :*\n${trackingUrl}\n\nMerci de votre confiance !`;

  const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-850 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Reçu de Dépôt Numérique</h3>
              <p className="text-xs text-slate-400">Réf : {order.order_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Aperçu du Ticket (Style Ticket de Caisse / Carte Thermique) */}
          <div
            id="thermal-receipt"
            ref={receiptRef}
            className="bg-white text-slate-900 p-5 rounded-xl border border-slate-200 shadow-md font-mono text-xs space-y-3"
          >
            {/* Entête Pressing */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <h2 suppressHydrationWarning className="text-base font-extrabold uppercase tracking-tight text-slate-900">
                {settings.shop_name}
              </h2>
              <p className="text-[11px] text-slate-600">{settings.address}</p>
              <p className="text-[11px] font-semibold text-slate-700">Tél : {settings.phone}</p>
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 font-bold text-[11px]">
                TICKET DE DÉPÔT : #{order.order_number}
              </div>
            </div>

            {/* Infos Client & Dates */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Client :</span>
                <span className="font-bold text-slate-900">{order.client.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Téléphone :</span>
                <span className="font-medium text-slate-800">{order.client.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date dépôt :</span>
                <span>{formattedCreated}</span>
              </div>
              <div className="flex justify-between font-bold text-blue-700">
                <span>Date retrait :</span>
                <span>{formattedPickup}</span>
              </div>
              {order.is_express && (
                <div className="text-center font-bold text-amber-700 bg-amber-50 py-0.5 rounded mt-1">
                  ⚡ SERVICE EXPRESS 24H
                </div>
              )}
            </div>

            {/* Détail des articles */}
            <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between font-bold text-slate-700 text-[10px] uppercase pb-1">
                <span>Article / Service</span>
                <span>Qté x P.U</span>
                <span>Total</span>
              </div>
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-[11px]">
                  <div className="truncate max-w-[150px]">
                    <div className="font-semibold text-slate-800">{item.article_name}</div>
                    <div className="text-[10px] text-slate-500">
                      {item.service_code === 'wash'
                        ? 'Lavage seul'
                        : item.service_code === 'iron'
                        ? 'Repassage seul'
                        : item.service_code === 'express'
                        ? 'Express'
                        : 'Lavage + Repassage'}
                    </div>
                  </div>
                  <div className="text-slate-600">
                    {item.quantity} x {item.unit_price.toLocaleString('fr-FR')}
                  </div>
                  <div className="font-semibold text-slate-900">
                    {item.total_price.toLocaleString('fr-FR')}
                  </div>
                </div>
              ))}
            </div>

            {/* Totaux & Règlements */}
            <div className="space-y-1.5 pt-1 text-[12px]">
              <div className="flex justify-between text-slate-600">
                <span>TOTAL COMMANDE :</span>
                <span className="font-bold text-slate-900">
                  {order.total_amount.toLocaleString('fr-FR')} {settings.currency}
                </span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Acompte versé ({order.payment_method}) :</span>
                <span className="font-bold">
                  - {order.advance_amount.toLocaleString('fr-FR')} {settings.currency}
                </span>
              </div>
              <div className="flex justify-between text-sm font-extrabold border-t border-slate-300 pt-1.5">
                <span className="text-slate-900">RESTE À PAYER :</span>
                <span className={order.remaining_amount > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {order.remaining_amount.toLocaleString('fr-FR')} {settings.currency}
                </span>
              </div>
            </div>

            {/* QR Code de Suivi Unique */}
            <div className="pt-3 pb-2 text-center flex flex-col items-center justify-center">
              <div className="p-2 bg-white border border-slate-300 rounded-lg inline-block shadow-sm">
                <QRCodeSVG
                  value={trackingUrl}
                  size={120}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">
                Scannez pour suivre l&apos;état de votre linge
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">
                Les vêtements non réclamés après 3 mois seront cédés.
              </p>
            </div>
          </div>
        </div>

        {/* Actions au bas du Modal */}
        <div className="p-4 bg-slate-850 border-t border-slate-800 flex flex-wrap gap-2 justify-between">
          <button
            onClick={handlePrint}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-colors border border-slate-700 shadow-sm"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            <span>Imprimer Reçu</span>
          </button>

          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[160px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-600/30"
          >
            <Share2 className="w-4 h-4" />
            <span>Envoyer WhatsApp</span>
          </a>

          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
