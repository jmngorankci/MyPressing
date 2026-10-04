// ==============================================================================
// TYPES TYPESCRIPT STRICTS GÉNÉRÉS DEPUIS LA BASE DE DONNÉES SUPABASE MULTI-TENANT
// ==============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatus = 'to_process' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';
export type PaymentMethod = 'cash' | 'wave' | 'orange_money' | 'mtn_momo' | 'card';
export type ServiceCode = 'wash' | 'iron' | 'full' | 'express';
export type MemberRole = 'owner' | 'admin' | 'member';

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          primary_color: string;
          phone: string;
          email: string | null;
          address: string;
          ticket_header: string | null;
          ticket_footer: string | null;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          primary_color?: string;
          phone?: string;
          email?: string | null;
          address?: string;
          ticket_header?: string | null;
          ticket_footer?: string | null;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo_url?: string | null;
          primary_color?: string;
          phone?: string;
          email?: string | null;
          address?: string;
          ticket_header?: string | null;
          ticket_footer?: string | null;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: MemberRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: MemberRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: MemberRole;
          created_at?: string;
        };
      };
      settings: {
        Row: {
          id: string;
          organization_id: string;
          shop_name: string;
          phone: string;
          email: string | null;
          address: string;
          currency: string;
          logo_url: string | null;
          primary_color: string;
          ticket_header: string | null;
          ticket_footer: string | null;
          default_pickup_days: number;
          express_surcharge_percent: number;
          sms_api_key: string | null;
          whatsapp_api_url: string | null;
          whatsapp_template: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          shop_name?: string;
          phone?: string;
          email?: string | null;
          address?: string;
          currency?: string;
          logo_url?: string | null;
          primary_color?: string;
          ticket_header?: string | null;
          ticket_footer?: string | null;
          default_pickup_days?: number;
          express_surcharge_percent?: number;
          sms_api_key?: string | null;
          whatsapp_api_url?: string | null;
          whatsapp_template?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          shop_name?: string;
          phone?: string;
          email?: string | null;
          address?: string;
          currency?: string;
          logo_url?: string | null;
          primary_color?: string;
          ticket_header?: string | null;
          ticket_footer?: string | null;
          default_pickup_days?: number;
          express_surcharge_percent?: number;
          sms_api_key?: string | null;
          whatsapp_api_url?: string | null;
          whatsapp_template?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          phone: string;
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          name: string;
          phone: string;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          phone?: string;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          icon: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          name: string;
          icon?: string;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          icon?: string;
          display_order?: number;
          created_at?: string;
        };
      };
      articles: {
        Row: {
          id: string;
          organization_id: string;
          category_id: string;
          name: string;
          base_price: number;
          icon: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          category_id: string;
          name: string;
          base_price?: number;
          icon?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          category_id?: string;
          name?: string;
          base_price?: number;
          icon?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      services: {
        Row: {
          id: string;
          organization_id: string;
          code: ServiceCode;
          name: string;
          price_multiplier: number;
          additional_fee: number;
          default_delay_days: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          code: ServiceCode;
          name: string;
          price_multiplier?: number;
          additional_fee?: number;
          default_delay_days?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          code?: ServiceCode;
          name?: string;
          price_multiplier?: number;
          additional_fee?: number;
          default_delay_days?: number;
          created_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          organization_id: string;
          order_number: string;
          client_id: string;
          status: OrderStatus;
          total_amount: number;
          advance_amount: number;
          remaining_amount: number;
          payment_status: PaymentStatus;
          payment_method: PaymentMethod;
          pickup_date: string;
          is_express: boolean;
          notes: string | null;
          qr_code: string;
          notification_sent: boolean;
          notification_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          order_number: string;
          client_id: string;
          status?: OrderStatus;
          total_amount?: number;
          advance_amount?: number;
          remaining_amount?: number;
          payment_status?: PaymentStatus;
          payment_method?: PaymentMethod;
          pickup_date: string;
          is_express?: boolean;
          notes?: string | null;
          qr_code: string;
          notification_sent?: boolean;
          notification_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          order_number?: string;
          client_id?: string;
          status?: OrderStatus;
          total_amount?: number;
          advance_amount?: number;
          remaining_amount?: number;
          payment_status?: PaymentStatus;
          payment_method?: PaymentMethod;
          pickup_date?: string;
          is_express?: boolean;
          notes?: string | null;
          qr_code?: string;
          notification_sent?: boolean;
          notification_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          organization_id: string;
          order_id: string;
          article_id: string | null;
          article_name: string;
          service_code: ServiceCode;
          quantity: number;
          unit_price: number;
          total_price: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          order_id: string;
          article_id?: string | null;
          article_name: string;
          service_code?: ServiceCode;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          order_id?: string;
          article_id?: string | null;
          article_name?: string;
          service_code?: ServiceCode;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          notes?: string | null;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          organization_id: string;
          order_id: string;
          amount: number;
          payment_method: PaymentMethod;
          amount_received: number | null;
          change_returned: number | null;
          reference: string | null;
          cashier_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          order_id: string;
          amount: number;
          payment_method: PaymentMethod;
          amount_received?: number | null;
          change_returned?: number | null;
          reference?: string | null;
          cashier_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          order_id?: string;
          amount?: number;
          payment_method?: PaymentMethod;
          amount_received?: number | null;
          change_returned?: number | null;
          reference?: string | null;
          cashier_note?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {
      get_user_org_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      order_status: OrderStatus;
      payment_status: PaymentStatus;
    };
  };
}

// Types déduits pour l'application SaaS Multi-Tenant
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type OrganizationMember = Database['public']['Tables']['organization_members']['Row'];
export type Client = Database['public']['Tables']['clients']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Article = Database['public']['Tables']['articles']['Row'];
export type Service = Database['public']['Tables']['services']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type Settings = Database['public']['Tables']['settings']['Row'];

// Type enrichi d'une commande avec son client et ses articles
export interface OrderWithDetails extends Order {
  client: Client;
  items: OrderItem[];
  payments?: Payment[];
}
