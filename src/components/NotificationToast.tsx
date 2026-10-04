'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  X,
  ExternalLink,
  CheckCircle2,
  Send,
  Sparkles,
  Smartphone,
} from 'lucide-react';

interface NotificationPayload {
  order: any;
  client: any;
  message: string;
  directWhatsAppUrl: string;
}

export function NotificationToast() {
  const [notification, setNotification] = useState<NotificationPayload | null>(null);

  useEffect(() => {
    const handleNotify = (e: any) => {
      if (e.detail) {
        setNotification(e.detail);
      }
    };

    window.addEventListener('pressing:notify-ready', handleNotify);
    return () => {
      window.removeEventListener('pressing:notify-ready', handleNotify);
    };
  }, []);

  if (!notification) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full p-4 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900/95 border border-emerald-500/40 rounded-2xl shadow-2xl shadow-emerald-500/10 backdrop-blur-xl p-4 text-white">
        
        {/* Header notification */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                  Notification Client Déclenchée
                </span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <h4 className="text-sm font-semibold text-white">
                Commande #{notification.order.order_number} est PRÊTE !
              </h4>
            </div>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Détails du message */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="text-slate-400">Destinataire :</span>
            <span className="font-semibold text-emerald-300">
              {notification.client.name} ({notification.client.phone})
            </span>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono leading-relaxed">
            {notification.message}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Webhook Supabase Edge Function &amp; passerelle SMS simulés</span>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="mt-4 flex gap-2">
          <a
            href={notification.directWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setNotification(null)}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-600/30"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Ouvrir WhatsApp</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={() => setNotification(null)}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Compris
          </button>
        </div>

      </div>
    </div>
  );
}
