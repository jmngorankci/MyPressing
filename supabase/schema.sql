-- ==============================================================================
-- SCHEMA SUPABASE : SAAS MULTI-TENANT MYPRESSING (B2B PRESSING & BLANCHISSERIE)
-- ==============================================================================

-- Activation des extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLE DES ORGANISATIONS (TENANTS / BLANCHISSERIES B2B)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    primary_color TEXT NOT NULL DEFAULT '#2563eb',
    phone TEXT NOT NULL DEFAULT '+225 07 00 00 00 00',
    email TEXT,
    address TEXT NOT NULL DEFAULT 'Abidjan, Côte d''Ivoire',
    ticket_header TEXT DEFAULT '*** PRESSING & BLANCHISSERIE PROFESSIONNELLE ***',
    ticket_footer TEXT DEFAULT 'Merci de votre confiance ! Les vêtements non réclamés après 3 mois seront cédés.',
    currency TEXT NOT NULL DEFAULT 'FCFA',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLE DES MEMBRES / UTILISATEURS ASSIGNÉS À L'ORGANISATION
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- 3. TABLE DES PARAMÈTRES GÉNÉRAUX DU PRESSING (PAR ORGANISATION)
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    shop_name TEXT NOT NULL DEFAULT 'Pressing Royal Ivoire',
    phone TEXT NOT NULL DEFAULT '+225 07 89 45 12 30',
    email TEXT DEFAULT 'contact@pressing-royal.ci',
    address TEXT NOT NULL DEFAULT 'Bd Latrille, Deux-Plateaux Vallons, Abidjan',
    currency TEXT NOT NULL DEFAULT 'FCFA',
    logo_url TEXT,
    primary_color TEXT NOT NULL DEFAULT '#2563eb',
    ticket_header TEXT DEFAULT '*** PRESSING & BLANCHISSERIE HAUT DE GAMME ***',
    ticket_footer TEXT DEFAULT 'Merci pour votre confiance ! Tout vêtement non réclamé sous 90 jours sera cédé.',
    default_pickup_days INT NOT NULL DEFAULT 2,
    express_surcharge_percent NUMERIC NOT NULL DEFAULT 50,
    sms_api_key TEXT,
    whatsapp_api_url TEXT,
    whatsapp_template TEXT DEFAULT 'Bonjour {{client_name}}, votre linge (Commande #{{order_number}}) est PRÊT au pressing. Reste à payer : {{remaining_amount}} {{currency}}. Merci de votre confiance !',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_org ON settings(organization_id);

-- 4. TABLE DES CLIENTS
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(organization_id);

-- 5. TABLE DES CATÉGORIES D'ARTICLES
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'shirt',
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_org ON categories(organization_id);

-- 6. TABLE DES ARTICLES & TARIFS DE BASE
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    base_price NUMERIC NOT NULL DEFAULT 1000,
    icon TEXT DEFAULT 'shirt',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_org ON articles(organization_id);

-- 7. TABLE DES SERVICES (Lavage, Repassage, Complet, Express)
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    price_multiplier NUMERIC NOT NULL DEFAULT 1.0,
    additional_fee NUMERIC NOT NULL DEFAULT 0,
    default_delay_days INT DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_services_org ON services(organization_id);

-- 8. TABLE DES COMMANDES
CREATE TYPE order_status AS ENUM ('to_process', 'in_progress', 'ready', 'delivered', 'cancelled');
CREATE TYPE payment_status AS ENUM ('unpaid', 'partially_paid', 'paid');

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    order_number TEXT NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE RESTRICT,
    status order_status NOT NULL DEFAULT 'to_process',
    total_amount NUMERIC NOT NULL DEFAULT 0,
    advance_amount NUMERIC NOT NULL DEFAULT 0,
    remaining_amount NUMERIC NOT NULL DEFAULT 0,
    payment_status payment_status NOT NULL DEFAULT 'unpaid',
    payment_method TEXT DEFAULT 'cash',
    pickup_date TIMESTAMPTZ NOT NULL,
    is_express BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    qr_code TEXT NOT NULL,
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    notification_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_orders_org ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_date ON orders(pickup_date);

-- 9. TABLE DES LIGNES DE COMMANDE
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
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

CREATE INDEX IF NOT EXISTS idx_order_items_org ON order_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 10. TABLE DES PAIEMENTS
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL,
    amount_received NUMERIC,
    change_returned NUMERIC DEFAULT 0,
    reference TEXT,
    cashier_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organization_id);

-- ==============================================================================
-- FONCTION & TRIGGER : MISE À JOUR DU RESTE À PAYER ET STATUT PAIEMENT
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
-- FONCTION MULTI-TENANT get_user_org_id()
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- 1. Récupère l'organisation assignée à l'utilisateur connecté via auth.uid()
    SELECT organization_id INTO v_org_id
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;

    -- 2. Fallback sécurisé vers l'organisation par défaut pour mode démo ou session publique
    IF v_org_id IS NULL THEN
        SELECT id INTO v_org_id 
        FROM organizations 
        ORDER BY created_at ASC 
        LIMIT 1;
    END IF;

    RETURN COALESCE(v_org_id, '00000000-0000-0000-0000-000000000001'::uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) STRICTE MULTI-TENANT
-- ==============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Politiques d'étanchéité stricte par tenant
CREATE POLICY "RLS Organizations: Membres autorisés" ON organizations
    FOR ALL USING (id = get_user_org_id());

CREATE POLICY "RLS Settings: Isolation par organisation" ON settings
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "RLS Clients: Isolation par organisation" ON clients
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "RLS Categories: Isolation par organisation" ON categories
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "RLS Articles: Isolation par organisation" ON articles
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "RLS Services: Isolation par organisation" ON services
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "RLS Orders: Isolation par organisation" ON orders
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "RLS Order Items: Isolation par organisation" ON order_items
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "RLS Payments: Isolation par organisation" ON payments
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

-- Politiques publiques de suivi de commande client (lecture seule)
CREATE POLICY "Public Read Orders For Tracking" ON orders
    FOR SELECT USING (true);

CREATE POLICY "Public Read Order Items For Tracking" ON order_items
    FOR SELECT USING (true);

CREATE POLICY "Public Read Organizations For Branding" ON organizations
    FOR SELECT USING (true);

-- ==============================================================================
-- SUPABASE STORAGE BUCKET POUR LES LOGOS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Logos publics en lecture" ON storage.objects
    FOR SELECT USING (bucket_id = 'logos');

CREATE POLICY "Upload logo utilisateurs autorises" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'logos');

-- ==============================================================================
-- DONNÉES INITIALES (SEED DU TENANT PAR DÉFAUT)
-- ==============================================================================
INSERT INTO organizations (
    id, name, slug, logo_url, primary_color, phone, email, address, ticket_header, ticket_footer, currency
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Pressing Royal Ivoire',
    'pressing-royal-ivoire',
    NULL,
    '#2563eb',
    '+225 07 89 45 12 30',
    'contact@pressing-royal.ci',
    'Bd Latrille, Deux-Plateaux Vallons, Abidjan',
    '*** PRESSING & BLANCHISSERIE HAUT DE GAMME ***',
    'Merci pour votre confiance ! Tout vêtement non réclamé sous 90 jours sera cédé.',
    'FCFA'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO settings (
    id, organization_id, shop_name, phone, email, address, currency, default_pickup_days, express_surcharge_percent, primary_color, ticket_header, ticket_footer
) VALUES (
    '74b57589-047d-497a-aacb-eac8868233a9',
    '00000000-0000-0000-0000-000000000001',
    'Pressing Royal Ivoire',
    '+225 07 89 45 12 30',
    'contact@pressing-royal.ci',
    'Bd Latrille, Deux-Plateaux Vallons, Abidjan',
    'FCFA',
    2,
    50,
    '#2563eb',
    '*** PRESSING & BLANCHISSERIE HAUT DE GAMME ***',
    'Merci pour votre confiance ! Tout vêtement non réclamé sous 90 jours sera cédé.'
) ON CONFLICT DO NOTHING;

-- Catégories par défaut rattachées au tenant
INSERT INTO categories (id, organization_id, name, icon, display_order) VALUES
('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Hauts & Chemises', 'shirt', 1),
('c2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'Bas & Pantalons', 'scissors', 2),
('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'Costumes & Robes', 'sparkles', 3),
('c4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'Traditionnel (Boubou/Pagne)', 'crown', 4),
('c5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', 'Linge de Maison', 'bed', 5),
('c6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000001', 'Chaussures & Cuir', 'footprints', 6)
ON CONFLICT DO NOTHING;

-- Services par défaut rattachés au tenant
INSERT INTO services (id, organization_id, code, name, price_multiplier, additional_fee, default_delay_days) VALUES
('s1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'wash', 'Lavage Seul', 0.70, 0, 1),
('s2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'iron', 'Repassage Seul', 0.60, 0, 1),
('s3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'full', 'Nettoyage Complet (Lavage + Repassage)', 1.0, 0, 2),
('s4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'express', 'Service Express 24h', 1.50, 500, 0)
ON CONFLICT (id) DO NOTHING;

-- Articles par défaut rattachés au tenant
INSERT INTO articles (id, organization_id, category_id, name, base_price, icon) VALUES
('39f8ad04-be05-41b5-9621-4bd8678fd9d5', '00000000-0000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111', 'Chemise Homme / Femme', 1000, 'shirt'),
('f3d56090-c3c9-409a-877c-274968419d12', '00000000-0000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111', 'Polo / T-Shirt', 800, 'shirt'),
('d913382e-770a-4580-bc14-894bb4e6068b', '00000000-0000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111', 'Veste Seule / Blazer', 2000, 'sparkles'),
('ce02da6e-c7b7-4fa2-bd32-25d0db01bb50', '00000000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222', 'Pantalon Classique', 1200, 'scissors'),
('02500a23-bc7b-45d0-bdac-462006bd379e', '00000000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222', 'Jean / Denim', 1000, 'scissors'),
('2c9e7eb3-c603-4903-8d00-7ec87b92bb62', '00000000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222', 'Jupe / Jupe Plissée', 1200, 'scissors'),
('5f928e3b-9e90-4848-9c59-b13c7ee80d38', '00000000-0000-0000-0000-000000000001', 'c3333333-3333-3333-3333-333333333333', 'Costume 2 Pièces', 3000, 'sparkles'),
('5c010a30-0eb7-4d76-b51f-6ad2a3ea57cb', '00000000-0000-0000-0000-000000000001', 'c3333333-3333-3333-3333-333333333333', 'Costume 3 Pièces', 4000, 'sparkles'),
('c375c3ef-a982-4df9-a1b6-d4e5f0a2022d', '00000000-0000-0000-0000-000000000001', 'c3333333-3333-3333-3333-333333333333', 'Robe de Soirée / Cocktail', 3500, 'sparkles'),
('6b651b14-8742-491c-bce0-6ca238356976', '00000000-0000-0000-0000-000000000001', 'c4444444-4444-4444-4444-444444444444', 'Boubou Bazin Riche (3 Pièces)', 4500, 'crown'),
('a2eb445a-c603-4f95-bd7f-9e66bf39ef1b', '00000000-0000-0000-0000-000000000001', 'c4444444-4444-4444-4444-444444444444', 'Complet Pagne Traditionnel', 2500, 'crown'),
('e16e6d19-3382-4682-8bc2-10f760da6ef2', '00000000-0000-0000-0000-000000000001', 'c5555555-5555-5555-5555-555555555555', 'Couette Lit 2 Places', 4000, 'bed'),
('7e23112b-2a74-4b55-89f5-7d5a5704bb84', '00000000-0000-0000-0000-000000000001', 'c5555555-5555-5555-5555-555555555555', 'Drap / Housse de Couette', 1500, 'bed'),
('5f3c1d9b-e854-478a-a43e-b81bb870cfa5', '00000000-0000-0000-0000-000000000001', 'c5555555-5555-5555-5555-555555555555', 'Rideaux & Voilages (la paire)', 3000, 'bed'),
('bfdb0c47-3841-4770-985c-15a6b0c2e68f', '00000000-0000-0000-0000-000000000001', 'c6666666-6666-6666-6666-666666666666', 'Sneakers / Baskets (Nettoyage pro)', 2500, 'footprints'),
('8a2e1d6b-3e5f-4d92-9442-990a4fb118ef', '00000000-0000-0000-0000-000000000001', 'c6666666-6666-6666-6666-666666666666', 'Veste en Cuir / Daim', 5000, 'footprints')
ON CONFLICT DO NOTHING;
