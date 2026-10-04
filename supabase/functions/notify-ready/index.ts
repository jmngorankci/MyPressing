// ==============================================================================
// SUPABASE EDGE FUNCTION : NOTIFICATION SMS / WHATSAPP CLIENT (COMMANDE PRÊTE)
// ==============================================================================
// Déployable avec : supabase functions deploy notify-ready
// Déclenchée via Supabase Database Webhook sur UPDATE `orders.status = 'ready'`

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: {
    id: string;
    order_number: string;
    client_id: string;
    status: string;
    remaining_amount: number;
    pickup_date: string;
  };
  order_id?: string;
  order_number?: string;
}

serve(async (req: Request) => {
  // Gestion pré-vol CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: WebhookPayload = await req.json();
    const orderId = body.order_id || body.record?.id;

    if (!orderId) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Récupérer la commande avec les informations du client et les paramètres du pressing
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        remaining_amount,
        pickup_date,
        notification_sent,
        clients ( id, name, phone )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    if (order.notification_sent) {
      return new Response(
        JSON.stringify({ message: "Notification already sent for this order", order_number: order.order_number }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer les paramètres du pressing
    const { data: settings } = await supabase
      .from("settings")
      .select("shop_name, phone, currency, whatsapp_template")
      .single();

    const client = (order as any).clients;
    if (!client || !client.phone) {
      throw new Error("Client phone number is missing");
    }

    const shopName = settings?.shop_name || "Pressing Royal";
    const currency = settings?.currency || "FCFA";
    const template =
      settings?.whatsapp_template ||
      "Bonjour {{client_name}}, votre linge (Commande #{{order_number}}) est PRÊT au pressing {{shop_name}}. Reste à payer : {{remaining_amount}} {{currency}}. Merci !";

    const messageText = template
      .replace("{{client_name}}", client.name)
      .replace("{{order_number}}", order.order_number)
      .replace("{{shop_name}}", shopName)
      .replace("{{remaining_amount}}", order.remaining_amount.toLocaleString("fr-FR"))
      .replace("{{currency}}", currency);

    console.log(`[NOTIFY-READY] Envoi notification à ${client.phone}: "${messageText}"`);

    // Intégration API WhatsApp / SMS (Exemple Twilio / Infobip / Webhook Provider)
    const smsApiKey = Deno.env.get("SMS_API_KEY");
    let externalApiResponse = null;

    if (smsApiKey) {
      // Exemple avec endpoint générique de passerelle SMS/WhatsApp
      const gatewayUrl = Deno.env.get("SMS_GATEWAY_URL") || "https://api.sms-provider.com/v1/messages";
      try {
        const response = await fetch(gatewayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${smsApiKey}`,
          },
          body: JSON.stringify({
            to: client.phone,
            message: messageText,
            sender: "PRESSING",
          }),
        });
        externalApiResponse = await response.json();
      } catch (smsErr) {
        console.warn("SMS Gateway dispatch warning:", smsErr);
      }
    }

    // Mettre à jour la commande pour marquer la notification comme envoyée
    await supabase
      .from("orders")
      .update({
        notification_sent: true,
        notification_sent_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({
        success: true,
        order_number: order.order_number,
        recipient: client.phone,
        message: messageText,
        gateway_response: externalApiResponse,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-ready edge function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
