// ==============================================================================
// UTILITAIRE WHATSAPP "1-CLICK" : RELANCES & NOTIFICATIONS SANS FRAIS D'API
// ==============================================================================

import { OrderWithDetails, Settings } from '@/types/database';

/**
 * Nettoie et formate un numéro de téléphone pour l'API WhatsApp wa.me.
 * Prend en charge les formats internationaux, les espaces, tirets et indicatifs ouest-africains.
 * Exemple CI : "07 47 12 34 56" -> "2250747123456"
 * Exemple Int : "+225 05 85 99 22 11" -> "2250585992211"
 */
export function formatWhatsAppPhoneNumber(phone: string): string {
  if (!phone) return '';

  // Supprime tout sauf les chiffres
  let digits = phone.replace(/[^0-9]/g, '');

  // Format ivoirien standard à 10 chiffres commençant par 0 (01, 05, 07)
  if (digits.length === 10 && digits.startsWith('0')) {
    digits = `225${digits.substring(1)}`;
  } else if (digits.length === 8 && (digits.startsWith('0') || digits.startsWith('4') || digits.startsWith('5') || digits.startsWith('7'))) {
    // Ancien format 8 chiffres CI si rencontré
    digits = `2250${digits}`;
  }

  return digits;
}

/**
 * Génère le message WhatsApp personnalisé et convivial pour notifier le client
 * que son linge est prêt pour le retrait.
 */
export function generateOrderReadyWhatsAppMessage(
  order: OrderWithDetails,
  settings: Settings
): string {
  const shopName = settings.shop_name || 'MyPressing Blanchisserie';
  const currency = settings.currency || 'FCFA';
  const totalItems = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || order.items?.length || 1;
  
  const remaining = order.remaining_amount > 0 
    ? `${order.remaining_amount.toLocaleString('fr-FR')} ${currency}` 
    : 'Soldé (0 FCFA)';

  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://mypressing.ci';
  const trackingUrl = `${baseUrl}/suivi/${order.id || order.order_number}`;

  return `Bonjour *${order.client.name}*,\n\nVos vêtements déposés sous le ticket *#${order.order_number}* sont prêts au pressing *${shopName}* ! 🧺✨\n\n📋 *Articles :* ${totalItems} pièce(s)\n💰 *Reste à payer :* ${remaining}\n📍 *Lieu de retrait :* ${settings.address || 'Au guichet'}\n📞 *Contact :* ${settings.phone || ''}\n\n📱 *Suivez votre commande en direct :*\n${trackingUrl}\n\nMerci de votre confiance et à très vite !`;
}

/**
 * Construit l'URL universelle WhatsApp 1-Click
 */
export function getWhatsAppOrderReadyUrl(
  order: OrderWithDetails,
  settings: Settings
): string {
  const phone = formatWhatsAppPhoneNumber(order.client.phone);
  const message = generateOrderReadyWhatsAppMessage(order, settings);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Déclencheur direct 1-Click pour ouvrir WhatsApp sur Desktop ou Mobile
 */
export function openWhatsAppOrderReady(
  order: OrderWithDetails,
  settings: Settings
): void {
  if (typeof window === 'undefined') return;
  const url = getWhatsAppOrderReadyUrl(order, settings);
  window.open(url, '_blank', 'noopener,noreferrer');
}
