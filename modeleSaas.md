# MODÈLE SAAS MULTI-TENANT : PLATEFORME MYPRESSING B2B

Ce document décrit l'architecture multi-tenant B2B intégrée à l'application MyPressing pour permettre l'hébergement et la gestion étanche de plusieurs blanchisseries et pressings indépendants sur une même infrastructure.

---

## 1. MODÈLE DE DONNÉES & SÉCURITÉ MULTI-TENANT

### A. Table des Organisations (`organizations`)
Chaque pressing / blanchisserie cliente dispose de son propre tenant avec son identité de marque :
- `id` : UUID identifiant unique de l'organisation
- `name` : Nom commercial de la blanchisserie (ex: *Pressing Royal Ivoire*)
- `slug` : Identifiant textuel unique (ex: *pressing-royal-ivoire*)
- `logo_url` : URL publique du logo (stocké dans le bucket Supabase Storage `logos`)
- `primary_color` : Couleur hexadécimale de la marque (ex: `#2563eb`)
- `phone` : Numéro de téléphone guichet / WhatsApp
- `email` : Adresse email professionnelle
- `address` : Localisation physique du magasin
- `ticket_header` : Texte d'en-tête personnalisé pour les tickets thermiques
- `ticket_footer` : Texte de pied de page (conditions de garde, mentions légales)
- `currency` : Devise monétaire (FCFA, EUR, USD, GNF)

### B. Table d'Association Membres (`organization_members`)
Associe les utilisateurs authentifiés Supabase Auth (`auth.users`) à leur organisation :
- `organization_id` : Référence vers `organizations(id)`
- `user_id` : Référence vers `auth.users(id)`
- `role` : Rôle du membre (`owner`, `admin`, `member`)

### C. Rattachement de toutes les Entités Métier
Toutes les tables sont partitionnées par `organization_id` avec index dédié :
- `settings.organization_id`
- `clients.organization_id`
- `categories.organization_id`
- `articles.organization_id`
- `services.organization_id`
- `orders.organization_id`
- `order_items.organization_id`
- `payments.organization_id`

Tenant par défaut pour l'offline et la compatibilité :
`00000000-0000-0000-0000-000000000001`

### D. Fonction PostgreSQL `get_user_org_id()` & RLS
```sql
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
```

Toutes les requêtes applicatives sont filtrées automatiquement par Row-Level Security (RLS) :
```sql
CREATE POLICY "Tenant Isolation" ON orders
    FOR ALL USING (organization_id = get_user_org_id())
    WITH CHECK (organization_id = get_user_org_id());
```

---

## 2. ONBOARDING & PARAMÈTRES DE LA BLANCHISSERIE

### A. Écran de Paramétrage (`/parametres`)
Accessible depuis l'onglet **"Paramètres Blanchisserie"**, il regroupe :
1. **Logo de la Blanchisserie** :
   - Upload direct vers le bucket Supabase Storage `logos`
   - Fallback automatique en Base64 (Data URL) pour un fonctionnement 100% hors-ligne
   - Aperçu immédiat et bouton de suppression
2. **Couleur Principale de la Blanchisserie** :
   - 8 palettes de prestige en 1-clic (Bleu Royal, Vert Émeraude, Violet Impérial, Ambre Chaud, Rouge Rubis, Indigo, Cyan, Ardoise)
   - Sélecteur natif HTML5 pour n'importe quel code HEX sur mesure
3. **Coordonnées & Emplacement** :
   - Nom, Téléphone, Email, Adresse physique, Devise, Délai standard de retrait, Majoration express
4. **Textes du Ticket Thermique (80mm)** :
   - Texte d'en-tête (slogan, registre de commerce)
   - Texte de pied de page (conditions de garde 90 jours, clause de non-responsabilité)
   - Modèle de relance WhatsApp avec balises dynamiques

### B. Aperçu Live du Ticket Thermique
Un simulateur de ticket de caisse POS 80mm est affiché en direct sur la droite :
- Intègre le logo, l'en-tête, les coordonnées, la couleur d'accentuation, les totaux dans la devise choisie et le QR Code de suivi.

### C. Branding Dynamique de l'Application
- **Barre de Navigation (`Navbar.tsx`)** : Affiche le logo du pressing ou son badge stylisé avec la couleur choisie, le nom et l'adresse.
- **Ticket Thermique (`ReceiptModal.tsx`)** : Imprime le logo, l'en-tête, la couleur d'accent et les mentions de pied de page.
- **Suivi Client Public (`/suivi/[id]`)** : Le client final retrouve l'identité visuelle (logo et couleur) de sa blanchisserie.

---

## 3. OPTIMISATION DES COÛTS : RELANCES WHATSAPP "1-CLICK"

Pour éliminer les coûts récurrents d'abonnements SMS ou d'API tierces payantes (Twilio, Infobip, Meta Cloud API) :
- Implémentation du module `src/lib/whatsapp.ts`.
- Formatage automatique des numéros locaux et internationaux (ex: `07 47 12 34 56` -> `2250747123456`).
- Génération d'URLs directes `https://wa.me/{telephone}?text={message}` avec message pré-rempli :
  > *"Bonjour [Nom], vos vêtements déposés sous le ticket #[Ref] sont prêts au pressing [ShopName] ! Reste à payer : [Montant] [Devise]..."*
- Déclencheurs "1-Click" intégrés :
  - **Atelier Kanban (`/atelier`)** : Bouton sur chaque carte pour notifier le client instantanément dès que son linge est repassé et ensaché.
  - **Caisse & Retrait (`/caisse`)** : Bouton dans la fiche client et dans la liste des commandes prêtes pour envoyer un rappel avant retrait.
  - **Reçu Numérique (`ReceiptModal.tsx`)** : Bouton d'envoi immédiat du ticket au dépôt.
