-- ==============================================================================
-- SCHEMA SUPABASE : PWA GESTION PRESSING / BLANCHISSERIE PROFESSIONNELLE
-- ==============================================================================

-- Activation des extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLE DES PARAMÈTRES GÉNÉRAUX DU PRESSING
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_name TEXT NOT NULL DEFAULT 'Pressing Royal Ivoire',
    phone TEXT NOT NULL DEFAULT '+225 07 00 00 00 00',
    address TEXT NOT NULL DEFAULT 'Cocody Angré 8ème Tranche, Abidjan',
    currency TEXT NOT NULL DEFAULT 'FCFA',
    default_pickup_days INT NOT NULL DEFAULT 2,
    express_surcharge_percent NUMERIC NOT NULL DEFAULT 50,
    sms_api_key TEXT,
    whatsapp_api_url TEXT,
    whatsapp_template TEXT DEFAULT 'Bonjour {{client_name}}, votre linge (Commande #{{order_number}}) est PRÊT au pressing. Reste à payer : {{remaining_amount}} {{currency}}. Merci de votre confiance !',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLE DES CLIENTS
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide au guichet
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- 3. TABLE DES CATÉGORIES D'ARTICLES
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'shirt',
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLE DES ARTICLES & TARIFS DE BASE
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    base_price NUMERIC NOT NULL DEFAULT 1000,
    icon TEXT DEFAULT 'shirt',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLE DES SERVICES (Lavage, Repassage, Complet, Express)
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE, -- 'wash', 'iron', 'full', 'express'
    name TEXT NOT NULL,
    price_multiplier NUMERIC NOT NULL DEFAULT 1.0,
    additional_fee NUMERIC NOT NULL DEFAULT 0,
    default_delay_days INT DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLE DES COMMANDES
CREATE TYPE order_status AS ENUM ('to_process', 'in_progress', 'ready', 'delivered', 'cancelled');
CREATE TYPE payment_status AS ENUM ('unpaid', 'partially_paid', 'paid');

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT NOT NULL UNIQUE,
    client_id UUID REFERENCES clients(id) ON DELETE RESTRICT,
    status order_status NOT NULL DEFAULT 'to_process',
    total_amount NUMERIC NOT NULL DEFAULT 0,
    advance_amount NUMERIC NOT NULL DEFAULT 0,
    remaining_amount NUMERIC NOT NULL DEFAULT 0,
    payment_status payment_status NOT NULL DEFAULT 'unpaid',
    payment_method TEXT DEFAULT 'cash', -- 'cash', 'wave', 'orange_money', 'mtn_momo', 'card'
    pickup_date TIMESTAMPTZ NOT NULL,
    is_express BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    qr_code TEXT NOT NULL,
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    notification_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_date ON orders(pickup_date);

-- 7. TABLE DES LIGNES DE COMMANDE (ARTICLES DÉPOSÉS)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
    article_name TEXT NOT NULL,
    service_code TEXT NOT NULL DEFAULT 'full',
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 8. TABLE DES PAIEMENTS / TRANSACTIONS D'ENCAISSEMENT
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL, -- 'cash', 'wave', 'orange_money', 'mtn_momo', 'card'
    amount_received NUMERIC,
    change_returned NUMERIC DEFAULT 0,
    reference TEXT,
    cashier_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- FONCTION & TRIGGER : MISE À JOUR AUTOMATIQUE DU RESTE À PAYER ET STATUT PAIEMENT
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    NEW.remaining_amount := GREATEST(0, NEW.total_amount - NEW.advance_amount);
    
    IF NEW.remaining_amount <= 0 THEN
        NEW.payment_status := 'paid';
    ELSIF NEW.advance_amount > 0 THEN
        NEW.payment_status := 'partially_paid';
    ELSE
        NEW.payment_status := 'unpaid';
    END IF;
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_order_payment_status ON orders;
CREATE TRIGGER trg_update_order_payment_status
BEFORE INSERT OR UPDATE OF total_amount, advance_amount ON orders
FOR EACH ROW EXECUTE FUNCTION update_order_payment_status();

-- ==============================================================================
-- TRIGGER POUR DÉCLENCHER LE WEBHOOK / EDGE FUNCTION SUR PASSAGE À 'ready'
-- ==============================================================================
-- Note : Dans Supabase Dashboard, configurer un Database Webhook sur la table 'orders'
-- Event : UPDATE (status = 'ready') -> Target : Supabase Edge Function 'notify-ready'
-- Ou via pg_net (extension Supabase) :
/*
CREATE OR REPLACE FUNCTION trigger_notify_ready()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ready' AND OLD.status != 'ready' AND NOT NEW.notification_sent THEN
        -- Déclenchement webhook asynchrone vers l'Edge function
        PERFORM net.http_post(
            url := current_setting('app.settings.edge_function_url') || '/notify-ready',
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
            body := jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
*/

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Politiques pour l'application pressing (authentifié ou anon avec clé publique)
CREATE POLICY "Accès complet aux utilisateurs authentifiés" ON settings FOR ALL USING (true);
CREATE POLICY "Accès complet clients" ON clients FOR ALL USING (true);
CREATE POLICY "Accès complet categories" ON categories FOR ALL USING (true);
CREATE POLICY "Accès complet articles" ON articles FOR ALL USING (true);
CREATE POLICY "Accès complet services" ON services FOR ALL USING (true);
CREATE POLICY "Accès complet orders" ON orders FOR ALL USING (true);
CREATE POLICY "Accès complet order_items" ON order_items FOR ALL USING (true);
CREATE POLICY "Accès complet payments" ON payments FOR ALL USING (true);

-- Politique publique pour le suivi de commande par le client via QR code (lecture seule)
CREATE POLICY "Lecture publique pour suivi commande" ON orders FOR SELECT USING (true);
CREATE POLICY "Lecture publique articles commande" ON order_items FOR SELECT USING (true);

-- ==============================================================================
-- DONNÉES INITIALES (SEED)
-- ==============================================================================
INSERT INTO settings (shop_name, phone, address, currency, default_pickup_days, express_surcharge_percent)
VALUES ('Pressing & Blanchisserie Le Majestueux', '+225 07 89 45 12 30', 'Bd Latrille, Deux-Plateaux Vallons, Abidjan', 'FCFA', 2, 50)
ON CONFLICT DO NOTHING;

-- Catégories par défaut
INSERT INTO categories (id, name, icon, display_order) VALUES
('c1111111-1111-1111-1111-111111111111', 'Hauts & Chemises', 'shirt', 1),
('c2222222-2222-2222-2222-222222222222', 'Bas & Pantalons', 'scissors', 2),
('c3333333-3333-3333-3333-333333333333', 'Costumes & Robes', 'sparkles', 3),
('c4444444-4444-4444-4444-444444444444', 'Traditionnel (Boubou/Pagne)', 'crown', 4),
('c5555555-5555-5555-5555-555555555555', 'Linge de Maison', 'bed', 5),
('c6666666-6666-6666-6666-666666666666', 'Chaussures & Cuir', 'footprints', 6)
ON CONFLICT DO NOTHING;

-- Services par défaut
INSERT INTO services (code, name, price_multiplier, additional_fee, default_delay_days) VALUES
('wash', 'Lavage Seul', 0.70, 0, 1),
('iron', 'Repassage Seul', 0.60, 0, 1),
('full', 'Nettoyage Complet (Lavage + Repassage)', 1.0, 0, 2),
('express', 'Service Express 24h', 1.50, 500, 0)
ON CONFLICT (code) DO NOTHING;

-- Articles par défaut
INSERT INTO articles (category_id, name, base_price, icon) VALUES
('c1111111-1111-1111-1111-111111111111', 'Chemise Homme / Femme', 1000, 'shirt'),
('c1111111-1111-1111-1111-111111111111', 'Polo / T-Shirt', 800, 'shirt'),
('c1111111-1111-1111-1111-111111111111', 'Veste Seule / Blazer', 2000, 'sparkles'),
('c2222222-2222-2222-2222-222222222222', 'Pantalon Classique', 1200, 'scissors'),
('c2222222-2222-2222-2222-222222222222', 'Jean / Denim', 1000, 'scissors'),
('c2222222-2222-2222-2222-222222222222', 'Jupe / Jupe Plissée', 1200, 'scissors'),
('c3333333-3333-3333-3333-333333333333', 'Costume 2 Pièces', 3000, 'sparkles'),
('c3333333-3333-3333-3333-333333333333', 'Costume 3 Pièces', 4000, 'sparkles'),
('c3333333-3333-3333-3333-333333333333', 'Robe de Soirée / Cocktail', 3500, 'sparkles'),
('c4444444-4444-4444-4444-444444444444', 'Boubou Bazin Riche (3 Pièces)', 4500, 'crown'),
('c4444444-4444-4444-4444-444444444444', 'Complet Pagne Traditionnel', 2500, 'crown'),
('c5555555-5555-5555-5555-555555555555', 'Couette Lit 2 Places', 4000, 'bed'),
('c5555555-5555-5555-5555-555555555555', 'Drap / Housse de Couette', 1500, 'bed'),
('c5555555-5555-5555-5555-555555555555', 'Rideaux & Voilages (la paire)', 3000, 'bed'),
('c6666666-6666-6666-6666-666666666666', 'Sneakers / Baskets (Nettoyage pro)', 2500, 'footprints'),
('c6666666-6666-6666-6666-666666666666', 'Veste en Cuir / Daim', 5000, 'footprints')
ON CONFLICT DO NOTHING;
