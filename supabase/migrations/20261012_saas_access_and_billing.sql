-- ==============================================================================
-- MIGRATION SAAS MULTI-TENANT CONSOLIDÉE & AUTONOME : GESTION DES ACCÈS & FACTURATION
-- À COPIER DIRECTEMENT DANS LE SQL EDITOR DE VOTRE DASHBOARD SUPABASE :
-- https://supabase.com/dashboard/project/fpwzdwgjmigdniyzydnw/sql/new
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CRÉATION OU MISE À JOUR DE LA TABLE DES ORGANISATIONS (TENANTS / PRESSINGS)
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
    is_active BOOLEAN NOT NULL DEFAULT true,
    subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'trial', 'past_due', 'suspended')),
    subscription_plan TEXT NOT NULL DEFAULT 'pro' CHECK (subscription_plan IN ('starter', 'pro', 'enterprise')),
    subscription_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    monthly_fee NUMERIC NOT NULL DEFAULT 25000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la table existait déjà avec un schéma antérieur, ajout sécurisé des colonnes de facturation SaaS
ALTER TABLE organizations 
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'pro',
    ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC NOT NULL DEFAULT 25000;

-- Index pour requêtes rapides sur les tenants actifs / impayés
CREATE INDEX IF NOT EXISTS idx_org_subscription ON organizations(subscription_status, is_active);

-- 2. CRÉATION OU MISE À JOUR DE LA TABLE DES MEMBRES & RÔLES
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('super_admin', 'owner', 'admin', 'cashier', 'workshop', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- Mise à jour sécurisée de la contrainte de rôle si la table existait déjà
DO $$
BEGIN
    ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
    ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check 
        CHECK (role IN ('super_admin', 'owner', 'admin', 'cashier', 'workshop', 'member'));
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 3. INSERTION DU TENANT PAR DÉFAUT & INITIALISATION SAAS
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
    currency,
    is_active,
    subscription_status,
    subscription_plan,
    subscription_expires_at,
    monthly_fee
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
    'FCFA',
    true,
    'active',
    'pro',
    NOW() + INTERVAL '30 days',
    25000
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    is_active = COALESCE(organizations.is_active, true),
    subscription_status = COALESCE(organizations.subscription_status, 'active');

-- 4. INSERTION D'EXEMPLES DE TENANTS POUR LA DÉMO SUPER ADMIN
INSERT INTO organizations (
    id, name, slug, primary_color, phone, email, address, currency, is_active, subscription_status, subscription_plan, subscription_expires_at, monthly_fee
) VALUES 
(
    '00000000-0000-0000-0000-000000000002',
    'Pressing Élite Plateau',
    'pressing-elite-plateau',
    '#059669',
    '+225 05 12 34 56 78',
    'direction@elite-pressing.ci',
    'Avenue Chardy, Immeuble Alpha, Plateau, Abidjan',
    'FCFA',
    true,
    'active',
    'enterprise',
    NOW() + INTERVAL '45 days',
    50000
),
(
    '00000000-0000-0000-0000-000000000003',
    'Lavoir Express Cocody',
    'lavoir-express-cocody',
    '#d97706',
    '+225 07 44 55 66 77',
    'contact@lavoirexpress.ci',
    'Angré 8ème Tranche, Carrefour Duncan, Abidjan',
    'FCFA',
    true,
    'past_due',
    'starter',
    NOW() - INTERVAL '4 days',
    15000
),
(
    '00000000-0000-0000-0000-000000000004',
    'AquaNet Yopougon',
    'aquanet-yopougon',
    '#e11d48',
    '+225 01 22 33 44 55',
    'gerance@aquanet-pressing.ci',
    'Yopougon Maroc, Face Pharmacie du Soleil, Abidjan',
    'FCFA',
    false,
    'suspended',
    'starter',
    NOW() - INTERVAL '18 days',
    15000
)
ON CONFLICT (id) DO NOTHING;

-- 5. RATTACHEMENT SÉCURISÉ DES TABLES MÉTIER EXISTANTES (SI PRÉSENTES)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'settings') THEN
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';
        UPDATE settings SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clients') THEN
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';
        UPDATE clients SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories') THEN
        ALTER TABLE categories ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';
        UPDATE categories SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'articles') THEN
        ALTER TABLE articles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';
        UPDATE articles SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'services') THEN
        ALTER TABLE services ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';
        UPDATE services SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';
        UPDATE orders SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_items') THEN
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';
        UPDATE order_items SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
        ALTER TABLE payments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';
        UPDATE payments SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
    END IF;
END $$;

-- 6. FONCTIONS DE SÉCURITÉ SAAS & VÉRIFICATION D'ABONNEMENT
CREATE OR REPLACE FUNCTION is_tenant_active(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_active BOOLEAN;
BEGIN
    SELECT (is_active AND subscription_status != 'suspended') INTO v_is_active
    FROM organizations
    WHERE id = org_id;

    RETURN COALESCE(v_is_active, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM organization_members 
        WHERE user_id = auth.uid() 
          AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT organization_id INTO v_org_id
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF v_org_id IS NULL THEN
        SELECT id INTO v_org_id 
        FROM organizations 
        ORDER BY created_at ASC 
        LIMIT 1;
    END IF;

    RETURN COALESCE(v_org_id, '00000000-0000-0000-0000-000000000001'::uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 7. ACTIVATION RLS ET POLITIQUES D'ACCÈS PERMISSIVES / SAAS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accès multi-tenant organizations" ON organizations;
CREATE POLICY "Accès multi-tenant organizations" ON organizations FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organization_members') THEN
        ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Accès members" ON organization_members;
        CREATE POLICY "Accès members" ON organization_members FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
        ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Accès multi-tenant orders" ON orders;
        CREATE POLICY "Accès multi-tenant orders" ON orders FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
