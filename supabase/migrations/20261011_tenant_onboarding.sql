-- ==============================================================================
-- MIGRATION : MODULE D'ONBOARDING & CRÉATION DE TENANT MULTI-TENANT B2B
-- ==============================================================================

-- 1. Permettre aux utilisateurs authentifiés d'insérer de nouvelles organisations
CREATE POLICY "Permettre création d'organisation par tout utilisateur" ON organizations
    FOR INSERT WITH CHECK (true);

-- 2. Permettre à un utilisateur d'insérer son adhésion 'owner' à une organisation
CREATE POLICY "Permettre auto-rattachement comme membre" ON organization_members
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- 3. Procédure PostgreSQL d'onboarding complet d'un nouveau tenant avec catalogue initial
CREATE OR REPLACE FUNCTION create_tenant_with_catalog(
    p_name TEXT,
    p_slug TEXT,
    p_phone TEXT,
    p_email TEXT DEFAULT NULL,
    p_address TEXT DEFAULT 'Abidjan',
    p_currency TEXT DEFAULT 'FCFA',
    p_primary_color TEXT DEFAULT '#2563eb',
    p_ticket_header TEXT DEFAULT NULL,
    p_ticket_footer TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org_id UUID;
    v_settings_id UUID;
    v_cat_chemises UUID;
    v_cat_pantalons UUID;
    v_cat_costumes UUID;
    v_cat_traditionnel UUID;
    v_cat_linge UUID;
    v_cat_chaussures UUID;
    v_header TEXT;
    v_footer TEXT;
BEGIN
    -- 1. Création de l'Organisation (Tenant)
    v_header := COALESCE(p_ticket_header, '*** ' || UPPER(p_name) || ' ***');
    v_footer := COALESCE(p_ticket_footer, 'Merci pour votre confiance ! Tout vêtement non réclamé sous 90 jours sera cédé.');

    INSERT INTO organizations (
        name,
        slug,
        phone,
        email,
        address,
        currency,
        primary_color,
        ticket_header,
        ticket_footer
    ) VALUES (
        p_name,
        p_slug,
        p_phone,
        p_email,
        p_address,
        p_currency,
        p_primary_color,
        v_header,
        v_footer
    )
    RETURNING id INTO v_org_id;

    -- 2. Rapprochement du créateur comme Propriétaire ('owner') si utilisateur authentifié
    IF auth.uid() IS NOT NULL THEN
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (v_org_id, auth.uid(), 'owner')
        ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;

    -- 3. Création des Paramètres du Pressing
    INSERT INTO settings (
        organization_id,
        shop_name,
        phone,
        email,
        address,
        currency,
        primary_color,
        ticket_header,
        ticket_footer,
        default_pickup_days,
        express_surcharge_percent,
        whatsapp_template
    ) VALUES (
        v_org_id,
        p_name,
        p_phone,
        p_email,
        p_address,
        p_currency,
        p_primary_color,
        v_header,
        v_footer,
        2,
        50,
        'Bonjour {{client_name}}, vos vêtements déposés sous le ticket #{{order_number}} sont PRÊTS au pressing ' || p_name || '. Reste à payer : {{remaining_amount}} {{currency}}. Merci de votre confiance !'
    )
    RETURNING id INTO v_settings_id;

    -- 4. Génération des 6 Catégories de Base
    INSERT INTO categories (organization_id, name, icon, display_order)
    VALUES (v_org_id, 'Hauts & Chemises', 'shirt', 1) RETURNING id INTO v_cat_chemises;

    INSERT INTO categories (organization_id, name, icon, display_order)
    VALUES (v_org_id, 'Bas & Pantalons', 'scissors', 2) RETURNING id INTO v_cat_pantalons;

    INSERT INTO categories (organization_id, name, icon, display_order)
    VALUES (v_org_id, 'Costumes & Robes', 'sparkles', 3) RETURNING id INTO v_cat_costumes;

    INSERT INTO categories (organization_id, name, icon, display_order)
    VALUES (v_org_id, 'Traditionnel (Boubou/Pagne)', 'crown', 4) RETURNING id INTO v_cat_traditionnel;

    INSERT INTO categories (organization_id, name, icon, display_order)
    VALUES (v_org_id, 'Linge de Maison', 'bed', 5) RETURNING id INTO v_cat_linge;

    INSERT INTO categories (organization_id, name, icon, display_order)
    VALUES (v_org_id, 'Chaussures & Cuir', 'footprints', 6) RETURNING id INTO v_cat_chaussures;

    -- 5. Génération des 4 Services de Blanchisserie
    INSERT INTO services (organization_id, code, name, price_multiplier, additional_fee, default_delay_days)
    VALUES 
        (v_org_id, 'wash', 'Lavage Seul', 0.7, 0, 1),
        (v_org_id, 'iron', 'Repassage Seul', 0.6, 0, 1),
        (v_org_id, 'full', 'Nettoyage Complet (Lavage + Repassage)', 1.0, 0, 2),
        (v_org_id, 'express', 'Service Express 24h', 1.5, 500, 0);

    -- 6. Génération des Articles Populaires de Base
    INSERT INTO articles (organization_id, category_id, name, base_price, icon, is_active)
    VALUES
        (v_org_id, v_cat_chemises, 'Chemise Homme / Femme', 1000, 'shirt', true),
        (v_org_id, v_cat_chemises, 'Polo / T-Shirt', 800, 'shirt', true),
        (v_org_id, v_cat_chemises, 'Veste Seule / Blazer', 2000, 'sparkles', true),
        (v_org_id, v_cat_pantalons, 'Pantalon Classique', 1200, 'scissors', true),
        (v_org_id, v_cat_pantalons, 'Jean / Denim', 1000, 'scissors', true),
        (v_org_id, v_cat_pantalons, 'Jupe / Jupe Plissée', 1200, 'scissors', true),
        (v_org_id, v_cat_costumes, 'Costume 2 Pièces', 3000, 'sparkles', true),
        (v_org_id, v_cat_costumes, 'Costume 3 Pièces', 4000, 'sparkles', true),
        (v_org_id, v_cat_costumes, 'Robe de Soirée / Cocktail', 3500, 'sparkles', true),
        (v_org_id, v_cat_traditionnel, 'Boubou Bazin Riche (3 Pièces)', 4500, 'crown', true),
        (v_org_id, v_cat_traditionnel, 'Complet Pagne Traditionnel', 2500, 'crown', true),
        (v_org_id, v_cat_linge, 'Couette Lit 2 Places', 4000, 'bed', true),
        (v_org_id, v_cat_linge, 'Drap / Housse de Couette', 1500, 'bed', true),
        (v_org_id, v_cat_chaussures, 'Sneakers / Baskets (Nettoyage pro)', 2500, 'footprints', true);

    -- Retourner les métadonnées de l'organisation créée
    RETURN jsonb_build_object(
        'success', true,
        'organization_id', v_org_id,
        'name', p_name,
        'slug', p_slug,
        'currency', p_currency
    );
END;
$$;
