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

---

## 4. MODULE DE CRÉATION & GESTION DES TENANTS (IMPLÉMENTÉ)

### A. Création d'un Tenant & Provisioning Automatique (`CreateTenantModal.tsx`, `store.ts`)
Le module de création permet d'embarquer un nouveau pressing client en moins de 30 secondes :
1. **Formulaire d'Onboarding** :
   - Nom commercial de la blanchisserie
   - Identifiant unique (`slug`) généré automatiquement (normalisé en kebab-case)
   - Numéro de contact guichet & WhatsApp
   - Adresse physique de la boutique
   - Choix de la devise monétaire (FCFA, EUR, USD, GNF, MAD, XOF)
   - Palette de couleur principale de marque (8 presets prestige + sélecteur HEX libre)
   - Textes personnalisés du ticket thermique (en-tête & pied de page)
2. **Provisioning Automatique du Catalogue ("Seeding")** :
   - Génération instantanée des 6 catégories standard de blanchisserie (Hauts, Bas, Costumes, Traditionnel, Linge de maison, Chaussures).
   - Génération des 4 modes de traitement (Lavage seul, Repassage seul, Nettoyage complet, Express 24h).
   - Création des 14 articles de base avec tarifs initiaux associés au nouvel `organization_id`.
   - Création de l'enregistrement de configuration (`settings`) dédié.
3. **Persistance & Synchronisation Cloud** :
   - Sauvegarde locale immédiate (LocalStorage) pour disponibilité hors-ligne instantanée.
   - Insertion dans Supabase (`organizations`, `settings`, `categories`, `services`, `articles`) si en ligne.
   - Procédure stockée PostgreSQL `create_tenant_with_catalog()` disponible dans `supabase/migrations/20261011_tenant_onboarding.sql`.

### B. Sélecteur de Pressing Dynamique (`TenantSwitcher.tsx`)
Accessible directement depuis la barre de navigation supérieure (`Navbar.tsx`) :
- Affiche le pressing actuellement actif, sa pastille de couleur et sa devise.
- Menu déroulant avec la liste complète des pressings enregistrés.
- Bascule instantanée en 1-clic : toute l'application (Guichet, Atelier Kanban, Caisse, Paramètres, Tickets) bascule sur l'environnement étanche du pressing sélectionné.
- Bouton direct d'action **"+ Créer un nouveau Pressing"**.

### C. Console d'Administration Multi-Tenant (`/parametres?tab=tenants`)
Accessible depuis l'onglet **"🏢 Établissements"** de la page paramètres :
- Vue d'ensemble sous forme de cartes modernes pour chaque blanchisserie.
- Statuts visuels : badge "Actif actuellement" vs "Inactif".
- Statistiques en temps réel par établissement : nombre de commandes guichet et nombre de clients.
- Actions directes : "Basculer sur ce Pressing", "Paramètres de ce Pressing", "Supprimer le tenant".
- Synthèse des garanties d'architecture SaaS (Isolation RLS, Whitelabel, Résilience hybride).

---

## 5. GESTION DES ACCÈS, RÔLES & FACTURATION SAAS (SUPER ADMIN & PAYWALL)

### A. Recommandation d'Architecture de Connexion Multi-Tenant
Pour un SaaS B2B destiné aux pressings et blanchisseries en Afrique et à l'international :
1. **Authentification Unifiée (`/login`)** :
   - Un identifiant email/mot de passe ou Magic Link Supabase Auth.
   - Les caisses de guichet tactile peuvent être équipées d'un déverrouillage rapide par Code PIN à 4 chiffres (sans ressaisir le mot de passe complet à chaque changement d'employé).
2. **Résolution Automatique du Tenant & Rôles (RBAC)** :
   - À la connexion, la table `organization_members` associe `auth.uid()` à son `organization_id` et son rôle.
   - Si l'utilisateur possède plusieurs pressings : un sélecteur s'affiche à la connexion.
   - Si l'utilisateur est `super_admin` : il accède à la console globale de la plateforme SaaS (`/admin`).
3. **Matrice des Rôles & Permissions** :
   - **`super_admin`** : Gestionnaire de la plateforme SaaS MyPressing. Vue transversale, activation/suspension des tenants, suivi du MRR et relances d'impayés.
   - **`owner` / `admin`** : Gérant du pressing. Accès complet à son pressing (prix, équipe, statistiques, personnalisation thermique).
   - **`cashier`** : Caissier guichet. Accès exclusif à la prise de commande, encaissement, remise de linge et tickets thermiques. Pas d'accès aux réglages de prix ni au chiffre d'affaires global.
   - **`workshop`** : Opérateur atelier buanderie. Accès optimisé au Kanban atelier (`/atelier`) pour faire progresser les étapes de lavage/repassage et envoyer les alertes WhatsApp "Prêt".

### B. Cycle de Vie d'Abonnement & Verrouillage Automatique (Paywall)
Chaque pressing dispose des métriques de facturation intégrées :
- `subscription_status` : `'active'` | `'trial'` | `'past_due'` | `'suspended'`
- `subscription_plan` : `'starter'` (15 000 FCFA) | `'pro'` (25 000 FCFA) | `'enterprise'` (50 000 FCFA)
- `subscription_expires_at` : Date d'échéance de l'abonnement
- `is_active` : Interrupteur général d'accès

#### Règles d'Enforcement :
1. **Échéance dépassée (`past_due`)** :
   - L'accès reste fonctionnel pendant une période de grâce (ex: 5 jours).
   - Une **bannière d'alerte permanente** s'affiche en tête d'écran : avertissement du gérant avec montant à régulariser et bouton de paiement.
2. **Compte Suspendu (`suspended` ou `is_active = false`)** :
   - **Écran de Verrouillage Dissuasif (`SubscriptionGuard.tsx`)** : bloque la caisse, la prise de commande et l'atelier.
   - Affiche le motif d'impayé, le plan, le montant dû et deux boutons directs :
     - 📲 **Régulariser par WhatsApp** : contacte le support SaaS avec le message pré-rempli et les identifiants Wave / Orange Money / MoMo.
     - 💳 **Régulariser en 1-clic** : simulation immédiate de réactivation.

### C. Console Super Admin Plateforme (`/admin`)
Interface dédiée au propriétaire de la solution MyPressing :
- **KPIs SaaS Temps Réel** : Total Pressings, Pressings Actifs, En retard d'échéance, Suspendus/Coupés, MRR global (Revenu Mensuel Récurrent), Taux de recouvrement.
- **Interrupteur 1-Clic d'Activation / Suspension** : coupe ou rétablit instantanément l'accès d'un pressing client.
- **Prolongation d'Abonnement (+30 Jours / +90 Jours)** : enregistre un paiement et repousse l'échéance.
- **Relance WhatsApp d'Impayé en 1-Clic** : génère automatiquement le message officiel avec les dates, montants et canaux Mobile Money directement envoyé au gérant.
- **Simulateur de Rôle Intégré** : permet de tester l'interface sous la casquette Super Admin, Gérant, Caissier ou Opérateur Atelier.
- **Script SQL Dédié** : disponible dans `supabase/migrations/20261012_saas_access_and_billing.sql`.


