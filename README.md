# 🦌 BAREWA — Taxi Niger

**Barewa** veut dire « la gazelle » en haoussa : agilité, élégance, rapidité.

Plateforme VTC et taxi conçue pour les réalités du Niger — Niamey et les régions de Maradi, Zinder,
Tahoua, Agadez, Dosso, Diffa et Tillabéri. Application web et PWA en React 18 + TypeScript + Vite +
Tailwind CSS, construite sur la plateforme [Blocks](https://blocks.diy).

Monnaie : **Franc CFA (FCFA / XOF)**. Langues : **Français, Haoussa, Zarma, Tamajaq**.

---

## Ce que fait l'application

### Passager — 5 onglets

| Onglet | Contenu |
| --- | --- |
| **Accueil** | Météo locale (harmattan, indice UV) et horaires de prière calculés pour la ville, message de bienvenue lu à voix haute, compteur de véhicules disponibles, widget de commande rapide |
| **Carte & Taxis** | Carte plein écran plan/satellite, chauffeurs géolocalisés en direct, fiche chauffeur au clic, itinéraire Google Maps |
| **Course en cours** | Frise de statut et ETA, module de négociation du prix, fiche chauffeur avec appel GSM et WhatsApp, inspection 3D du véhicule, paiement, reçu officiel |
| **Historique** | Trajets passés, re-commande en un geste, reçu fiscal réaffichable |
| **Profil & Studio 3D** | Identité, langue, moyen de paiement, showroom 3D des 4 véhicules, repères en Street View 360°, candidature chauffeur, support WhatsApp |

### Chauffeur — 5 onglets

**Cockpit** (interrupteur en ligne / hors ligne, gains du jour, radar des demandes à 5 km) ·
**Courses disponibles** (accepter, contre-proposer, mode course active) ·
**Revenus & Caisse** (graphiques, ventilation espèces / mobile money, export comptable) ·
**Abonnés** (trajets réguliers, notification de départ par SMS et WhatsApp) ·
**Mon Taxi & Studio 3D** (personnalisation 3D, vraie photo du véhicule, dépôt et lecture automatique des pièces).

### Superviseur — 5 onglets

**Vue Globale** (indicateurs nationaux, alertes SOS) ·
**Flotte Chauffeurs** (annuaire, inspection des pièces, validation) ·
**Villes du Niger** (référentiel des 8 régions, repères, grille tarifaire) ·
**Comptabilité** (flux financiers, adoption du paiement digital, export CSV) ·
**Cerveau IA** (constats des cinq agents autonomes).

---

## Les partis pris techniques

### Les repères plutôt que les adresses

Au Niger, l'adressage par rue est peu utilisé : on se repère aux ronds-points, marchés, mosquées et
quartiers. Le référentiel `Landmarks` porte **33 repères authentiques** avec leur nom officiel **et**
leur nom courant en haoussa ou zarma — Rond-point Maourey, Marché Katako, Pont Kennedy, Aéroport
Diori Hamani, Sultanat de Zinder, Grande Mosquée d'Agadez, Palais du Zarmakoye, Débarcadère de
Tillabéri… La recherche de lieu interroge les trois champs. Google Street View 360° et la vue
satellite s'ouvrent sur le point choisi, **sans clé d'API**.

### Les quatre véhicules du Niger, modélisés en 3D

Le moteur `src/components/widgets/vehicle3d/` construit chaque carrosserie en géométries primitives
Three.js — aucun modèle externe à télécharger :

- **Tricycle 3 Roues** (*Adaidaita Sahu / Keke Bajaj*) — trois roues, armature tubulaire, bâche
  sahel sur arceau, phare rond central, guidon
- **Toyota Starlet** — le taxi jaune de Niamey : hayon arrière vertical, phares rectangulaires
- **Toyota Yaris** — citadine climatisée, capot et pare-brise profilés
- **Toyota Corolla** — berline trois volumes, coffre long

Le chauffeur personnalise sa livrée dans le Studio 3D (carrosserie, accents, bâche, jantes, panneau
de toit) et **photographie son véhicule réel** : la photo est plaquée en décalcomanie sur les flancs
de la carrosserie 3D, et le passager compare les deux en Double Vue HD pour reconnaître le véhicule
dans la rue. Repli visuel propre si le téléphone n'a pas WebGL.

### La tarification vient de la base, jamais du code

`FareGrid` est la source unique de vérité : une ligne par (ville, type de véhicule) avec prise en
charge, prix au kilomètre, prix à la minute, prix plancher, frais d'annulation et majorations de nuit
et d'heure de pointe. Le calcul applique :

- distance de haversine × **facteur de sinuosité routière 1,35**
- vitesses moyennes différenciées : 22 km/h à Niamey, 28 km/h dans les autres villes
- majorations nuit (≥ 22 h / < 5 h) et heure de pointe (7–9 h, 17–19 h), cumulables
- **arrondi au multiple de 25 FCFA supérieur** — un prix qui ne peut pas être rendu en espèces se
  renégocie dans la rue
- heure locale du Niger calculée explicitement en **UTC+1 sans heure d'été**

**Commission plateforme : 0 %** pendant la phase Bêta nationale. Le taux reste lu en base, il n'est
nulle part codé en dur.

### Le marchandage est une fonction, pas un contournement

Le passager propose, le chauffeur contre-propose, jusqu'à accord. Chaque tour est une ligne dans
`RideOffers` avec son émetteur, son montant et sa justification (embouteillage, pluie, retour à
vide). Les garde-fous : jamais sous le prix plancher de la ville, jamais au-delà du triple du prix
calculé, et un camp ne peut pas accepter sa propre offre. L'accord écrit le prix définitif sur la
course et affecte le chauffeur.

### Le paiement mobile money passe par l'USSD

Al Izza, Nita, Airtel Money et Moov Money (Flooz) n'exposent pas d'API publique ouverte. La table
`PaymentProviders` porte le modèle de chaîne USSD de chaque opérateur (`ussdTemplate`, jetons
`{merchant}` et `{amount}`) : l'app compose le code exact à taper, l'affiche en très gros et
cliquable en `tel:`, puis le passager reporte la **référence de transaction reçue par SMS**, dont
l'unicité est vérifiée avant de marquer la course payée. Les codes et numéros marchands sont en base
pour que l'exploitant les corrige lui-même.

> Un encaissement entièrement automatique exige un contrat marchand et des identifiants API chez
> chaque opérateur.

### Le SMS est le canal fiable

La couverture données est irrégulière hors des grandes villes. Les demandes de course, les annonces
de départ aux abonnés et les alertes SOS partent par SMS : le chauffeur est joint même sans internet.

### Sécurité

Le bouton SOS fige la position GPS et la course en cours, prévient par SMS le contact d'urgence du
passager, l'autre partie de la course et le superviseur, puis prépare l'appel au **17 (Police
Secours)** et le partage WhatsApp. L'appel reste un geste de l'utilisateur — l'application ne le
passe pas à sa place.

### Le Cerveau BAREWA

Cinq agents analysent les données réelles de l'exploitation et écrivent leurs constats chiffrés dans
`AgentInsights` : **Observateur** (santé de l'activité, fraîcheur des positions GPS), **Analyste**
(demande par tranche horaire), **Optimiseur** (couverture de flotte par ville), **Correcteur**
(anomalies de géolocalisation, pièces expirées, paiements bloqués), **Communicateur** (couverture des
langues et des moyens de paiement). Aucun constat n'est inventé : chacun cite les chiffres dont il
découle, et une ville sans données assez fournies le dit.

### Multilinguisme sans invention

Français par défaut, plus haoussa, zarma et tamajaq. Règle tenue partout : **aucun terme inventé**.
Un mot dont l'usage n'est pas attesté retombe sur le français plutôt que d'afficher une traduction
approximative. Le tamajaq est volontairement partiel.

---

## Structure du projet

```
artifacts/            le backend, en JSON — synchronisé vers la plateforme Blocks
  app.json            nom, description, destinations de l'app
  tables/             18 tables (Cities, Landmarks, VehicleTypes, FareGrid, Rides, RideOffers,
                      DriverProfile, PassengerProfile, Payments, PaymentProviders, PromoCodes,
                      SavedPlaces, DriverDocuments, Subscribers, SosAlerts, AgentInsights,
                      CompanySettings, Users)
  views/              11 vues de lecture (agrégations et jointures)
  actions/            17 actions (11 code Lambda + 6 DAG)
  agents/             l'assistante BAREWA
  agent-chats/        sa surface de conversation
  roles/              Passager, Chauffeur, Admin
code-actions/         le code TypeScript des actions Lambda
  shared/             calcul tarifaire, distances, heures de prière, météo, SMS, CSV
src/
  routes/             l'arborescence des URL EST le routage (course/, chauffeur/, admin/)
  components/         écrans, widgets, modales, moteur 3D
  utils/              formatage FCFA, dates du Niger, traductions, lignes de vues
memories/             la mémoire longue du projet (histoire de l'app, connaissance du métier)
```

## Développement

```bash
pnpm install
pnpm gen:types        # régénère src/product-types.ts depuis artifacts/
pnpm dev
pnpm lint && pnpm type-check && pnpm build
pnpm bundle:action <Nom>   # valide une action Lambda
```

`src/product-types.ts` est généré : il n'est pas versionné et se reconstruit avec `pnpm gen:types`.

## À renseigner avant l'ouverture au public

La table `CompanySettings` est livrée avec des valeurs à compléter par l'exploitant : raison sociale,
**NIF**, **RCCM**, adresse, numéros de contact et de support WhatsApp, numéro du superviseur alerté
par les SOS. Les **numéros marchands mobile money** et les **codes USSD** de `PaymentProviders`
doivent être vérifiés contre les contrats opérateurs avant tout encaissement réel.

## Licence

MIT — voir [LICENSE](./LICENSE).
