# 🧺 MyPressing — PWA Tactile de Gestion Pressing & Blanchisserie

Application Web Progressive (PWA) de niveau professionnel conçue pour la gestion complète d'un pressing / blanchisserie moderne. Optimisée pour tablettes tactiles de caisse et smartphones des gérants, avec résistance totale aux coupures réseau (Offline-First).

---

## 🌟 Modules Implémentés

### 1. 🛎️ Module Réception (Guichet)
- **Recherche & Autocomplétion client** : Recherche instantanée par nom ou numéro de téléphone, ou création rapide d'un client en 1 clic.
- **Sélecteur tactile d'articles** : Grille ergonomique classée par catégories (*Hauts & Chemises, Bas & Pantalons, Costumes & Robes, Linge de Maison, Traditionnel Bazin/Pagne, Chaussures & Cuir*).
- **Choix du Service par pièce** : Lavage seul, Repassage seul, Nettoyage complet (Lavage + Repassage).
- **Service Express 24h** : Option à bascule appliquant une majoration configurable (+50%) et ajustant automatiquement la priorité et la date de retrait.
- **Calcul automatique du délai** : Date de retrait calculée par défaut à J+2 (ou J+1 en express), avec boutons de raccourcis rapides (*J+0 ce soir, J+1 demain, J+2, J+3*).
- **Encaissement de l'Acompte** : Sélection du mode de règlement (*Espèces, Wave, Orange Money, MTN MoMo, Carte*) et boutons pourcentages (*0%, 50%, 100%*).
- **Reçu Numérique avec QR Code Unique** : Ticket thermique 80mm prêt à l'impression (`window.print()`), QR code scannable par le smartphone du client et bouton direct **"Partager sur WhatsApp"**.

### 2. 🧺 Module Atelier & Suivi des États (Kanban)
- **Tableau de bord à 4 colonnes** :
  1. **À traiter** : Dépôts récents à trier et préparer.
  2. **En cours** : Nettoyage, détachage ou repassage en atelier.
  3. **Prêt pour retrait** : Linge propre sous housse protectrice.
  4. **Retiré / Archivé** : Commande soldée et restituée.
- **Déclenchement Webhook SMS / WhatsApp** : Le passage d'une commande au statut **"Prêt"** déclenche automatiquement la notification client avec le lien de suivi et le solde restant.
- **Filtres d'urgence & badges de retard** : Détection automatique des retards ou des urgences du jour.

### 3. 💳 Module Caisse & Retrait
- **Recherche par référence ou Scan QR Code** : Recherche rapide par référence (ex: `PRS-2026-0040`), nom ou scan direct.
- **Contrôle du solde restant** : Affichage clair du montant total, de l'acompte déjà perçu et du reste à payer.
- **Calculateur tactile de monnaie à rendre** : Saisie du montant reçu en espèces (avec raccourcis de coupures 1 000, 2 000, 5 000, 10 000 FCFA), calcul instantané de la monnaie à rendre et décomposition des billets/pièces suggérés.
- **Paiements mobiles** : Intégration ergonomique pour Wave et Orange Money.
- **Validation du retrait & Archivage** : Clôture de la commande avec animation confetti et édition du reçu définitif soldé.

### 4. ⚙️ Paramètres & Grilles Tarifaires
- **CRUD complet des Articles** : Ajout, modification de libellé, prix unitaire, catégorie, icône et activation/désactivation.
- **Coordonnées de l'Établissement** : Nom du pressing, téléphone de caisse, adresse, devise (*FCFA, EUR, USD*), délai standard et surcharge express.
- **Modèle de message SMS/WhatsApp** : Personnalisable avec variables dynamiques (`{{client_name}}`, `{{order_number}}`, `{{remaining_amount}}`, etc.).
- **Gestionnaire PWA & Hors-ligne** : Indicateur d'état réseau, compteur de transactions locales en attente, bouton de synchronisation manuelle et restauration des données de démo.

### 5. 📱 Page Publique de Suivi Client (`/suivi/[id]`)
- Accessible par le client en scannant le **QR Code** imprimé sur son ticket de dépôt.
- Stepper visuel en direct de l'avancement du linge (*Dépôt -> En cours -> Prêt -> Retiré*).
- Détail des pièces déposées, solde dû au guichet et bouton d'appel/WhatsApp direct vers le pressing.

---

## 🛠️ Architecture Technique

- **Framework** : Next.js 16 (App Router), React 19, TypeScript strict.
- **Styling** : Tailwind CSS v4, Lucide Icons, support d'impression pour ticket thermique (`@media print`).
- **Backend & Données** : Supabase (`@supabase/supabase-js`, `@supabase/ssr`).
- **Offline-First & PWA** :
  - `public/manifest.json` complet avec affichage `standalone`.
  - Service Worker `public/sw.js` assurant la mise en cache du shell d'application et des routes d'encaissement.
  - File d'attente locale (`offline_queue`) persistée avec synchronisation automatique au retour du réseau (`window.addEventListener('online')`).
- **Supabase Edge Function** : `supabase/functions/notify-ready/index.ts` pour notifier le client par SMS/WhatsApp lors du passage à l'état prêt.

---

## 🚀 Démarrage Rapide

### 1. Installation des dépendances
\`\`\`bash
npm install
\`\`\`

### 2. Configuration des Variables d'Environnement
Copiez le fichier `.env.example` en `.env.local` :
\`\`\`bash
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon
\`\`\`
*(En l'absence de clés Supabase réelles, l'application fonctionne immédiatement à 100% en mode démonstration et hors-ligne local).*

### 3. Exécution du Serveur de Développement
\`\`\`bash
npm run dev -- -p 3001
\`\`\`
Accédez à l'application sur : [http://localhost:3001](http://localhost:3001)

### 4. Déploiement du Schéma Supabase
Ouvrez l'éditeur SQL de votre tableau de bord Supabase et exécutez le script complet situé dans :
`supabase/schema.sql`

---

## 📱 Installation PWA sur Tablette / Mobile
1. Ouvrez l'application sur Chrome / Safari / Edge sur la tablette de caisse.
2. Cliquez sur l'icône de téléchargement dans la barre d'adresse ou dans le menu du navigateur : **"Installer MyPressing"** / **"Ajouter à l'écran d'accueil"**.
3. L'application se lance en plein écran comme une application native tactile.
