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

## Structure du projet

```
artifacts/            le backend, en JSON — synchronisé vers la plateforme Blocks
code-actions/         le code TypeScript des actions Lambda
src/                  routes/, components/, utils/
memories/             la mémoire longue du projet
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

## Licence

MIT — voir [LICENSE](./LICENSE).
