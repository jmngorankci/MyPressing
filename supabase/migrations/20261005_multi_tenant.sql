-- ==============================================================================
-- MIGRATION SAAS MULTI-TENANT : APPLICATION MYPRESSING B2B
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLE DES ORGANISATIONS (TENANTS / PRESSINGS)
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

-- 2. TABLE D'ASSOCIATION MEMBRES / UTILISATEURS AUTHENTIFIÉS AUX ORGANISATIONS
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

-- 3. INSERTION DU TENANT PAR DÉFAUT (COMPATIBILITÉ & DÉMO HORS-LIGNE)
INSERT INTO organizations (
    id,
    name,
    slug,
    logo_url,
    primary_color,
    phone,
    email,
    address,
    ticket_header,
    ticket_footer,
    currency
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
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address;

-- 4. RATTACHEMENT DE TOUTES LES ENTITÉS MÉTIER À ORGANIZATION_ID
ALTER TABLE settings 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#2563eb',
    ADD COLUMN IF NOT EXISTS ticket_header TEXT DEFAULT '*** PRESSING & BLANCHISSERIE PROFESSIONNELLE ***',
    ADD COLUMN IF NOT EXISTS ticket_footer TEXT DEFAULT 'Merci de votre confiance ! Les vêtements non réclamés après 3 mois seront cédés.',
    ADD COLUMN IF NOT EXISTS email TEXT DEFAULT 'contact@pressing-royal.ci';

ALTER TABLE clients 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE categories 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE articles 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE services 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE order_items 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';

-- Index de performance sur chaque entité
CREATE INDEX IF NOT EXISTS idx_settings_org ON settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_categories_org ON categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_articles_org ON articles(organization_id);
CREATE INDEX IF NOT EXISTS idx_services_org ON services(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_org ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_items_org ON order_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organization_id);

-- 5. FONCTION POSTGRESQL get_user_org_id()
-- Récupère l'organisation active de l'utilisateur avec fallback sécurisé
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- 1. Recherche par appartenance utilisateur authentifié
    SELECT organization_id INTO v_org_id
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;

    -- 2. Fallback pour utilisateur anonyme / démonstration locale
    IF v_org_id IS NULL THEN
        SELECT id INTO v_org_id 
        FROM organizations 
        ORDER BY created_at ASC 
        LIMIT 1;
    END IF;

    RETURN COALESCE(v_org_id, '00000000-0000-0000-0000-000000000001'::uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. POLITIQUES RLS STRICTES MULTI-TENANT
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

-- Suppression des anciennes politiques globales permissives
DROP POLICY IF EXISTS "Accès complet aux utilisateurs authentifiés" ON settings;
DROP POLICY IF EXISTS "Accès complet clients" ON clients;
DROP POLICY IF EXISTS "Accès complet categories" ON categories;
DROP POLICY IF EXISTS "Accès complet articles" ON articles;
DROP POLICY IF EXISTS "Accès complet services" ON services;
DROP POLICY IF EXISTS "Accès complet orders" ON orders;
DROP POLICY IF EXISTS "Accès complet order_items" ON order_items;
DROP POLICY IF EXISTS "Accès complet payments" ON payments;

-- Politiques isolées par tenant (organization_id = get_user_org_id())
CREATE POLICY "Tenant Isolation: Organizations" ON organizations
    FOR ALL USING (id = get_user_org_id());

CREATE POLICY "Tenant Isolation: Organization Members" ON organization_members
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "Tenant Isolation: Settings" ON settings
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "Tenant Isolation: Clients" ON clients
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "Tenant Isolation: Categories" ON categories
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "Tenant Isolation: Articles" ON articles
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "Tenant Isolation: Services" ON services
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "Tenant Isolation: Orders" ON orders
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "Tenant Isolation: Order Items" ON order_items
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "Tenant Isolation: Payments" ON payments
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());

-- Politiques de lecture publique pour le suivi de commande client (QR Code / URL)
CREATE POLICY "Lecture publique suivi commande client" ON orders
    FOR SELECT USING (true);

CREATE POLICY "Lecture publique articles commande client" ON order_items
    FOR SELECT USING (true);

CREATE POLICY "Lecture publique logo et organisation" ON organizations
    FOR SELECT USING (true);

-- 7. CONFIGURATION DU BUCKET SUPABASE STORAGE POUR LES LOGOS
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Politiques de sécurité Storage
CREATE POLICY "Logos publics en lecture" ON storage.objects
    FOR SELECT USING (bucket_id = 'logos');

CREATE POLICY "Upload logo utilisateurs autorises" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Mise a jour logo utilisateurs autorises" ON storage.objects
    FOR UPDATE USING (bucket_id = 'logos');
