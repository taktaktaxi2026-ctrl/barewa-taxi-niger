# BAREWA — l'histoire de l'app

## Nom

**BAREWA** = « la gazelle » en haoussa. Le client a renommé l'app le 2026-09-07 (elle s'appelait
TAK TAK TAXI le temps de la construction initiale). Nom court : *Barewa*. Le sens haoussa est
rappelé une seule fois, discrètement, sous le logo (« Barewa — la gazelle · Niger »). Le préfixe des
références de course est passé de `TTX-` à **`BRW-`** ; les courses créées avant gardent `TTX-`, et
rien dans le code ne teste le préfixe — ne pas en réintroduire.

## Intention

Plateforme VTC et taxi pour **tout le Niger** — Niamey plus Maradi, Zinder, Tahoua, Agadez, Dosso,
Diffa, Tillabéri. Trois personas dans une seule app : passager, chauffeur, exploitant. Le client
s'adresse à nous comme à son « architecte logiciel et lead developer » et rédige des briefs très
détaillés, en français, avec une architecture de fichiers précise. **Tout le produit est en
français** ; le code et les commentaires aussi côté libellés.

## Ce qui fait l'identité du produit

- **Design sombre premium** : `#0A0D14` fond, `#141824` cartes, `#1C1C1C` surfaces enfoncées, accent
  **Or Jaune Sahel `#F5B000`** — la couleur des taxis jaunes de Niamey. Mobile-first, PWA, gros
  boutons, fort contraste (usage en plein soleil, Android d'entrée de gamme, réseau faible).
- **Les quatre véhicules du Niger**, modélisés en 3D Three.js à partir de géométries primitives (aucun
  modèle externe) : tricycle *Adaidaita Sahu / Keke Bajaj*, Toyota Starlet (le taxi jaune à hayon
  vertical), Yaris, Corolla. `VehicleTypes.modelKey` (`tricycle|starlet|yaris|corolla`) pilote la
  construction.
- **Studio 3D chauffeur** : personnalisation persistée dans `DriverProfile.vehicle3DConfig`, plus la
  **vraie photo du véhicule** (`vehiclePhotoUrl`) projetée en décalcomanie sur la carrosserie et
  visible en Double Vue HD par le passager.
- **Street View 360° sans clé API** : iframes `output=svembed` (360°) et `t=k&output=embed`
  (satellite), sur le départ et l'arrivée — indispensable là où l'adressage par rue n'existe pas.
- **Repères plutôt qu'adresses** : 33 repères authentiques en base avec leur **nom local haoussa/zarma**
  (Maourey, Katako, Pont Kennedy, Sultanat de Zinder, Palais du Zarmakoye…). La recherche de lieu
  cherche dans le nom officiel, le nom local et le quartier.
- **Quatre langues** : Français (défaut), Haoussa, Zarma, Tamajaq. Règle tenue : **ne jamais inventer
  de vocabulaire** — un terme non sûr retombe en français. Le Tamajaq est volontairement partiel.

## Décisions d'architecture propres à cette app

- Le brief demandait des données en dur dans `src/data/niameyData.ts` et un `AppContext.tsx`
  monolithique : **écarté** au profit des conventions Blocks. Données en base (tables + vues), état
  serveur via les hooks d'entités, et `src/components/AppProvider.tsx` réduit à l'état d'UI global
  (langue, ville sélectionnée, ouverture des modales Street View / 3D).
- **`FareGrid` est la source unique de vérité tarifaire** — une ligne par (ville, type de véhicule).
  Aucun tarif, commission ou code USSD en dur, nulle part.
- Calculs figés dans `code-actions/shared/barewa-fare.ts` : haversine × **facteur route 1,35**,
  vitesses 22 km/h à Niamey et 28 km/h ailleurs, +2 min de prise en charge, **arrondi au multiple de
  25 FCFA supérieur** (les pièces courantes), majorations nuit (≥22h / <5h) et pointe (7–9h, 17–19h)
  cumulées. **Heure du Niger = UTC+1 calculé explicitement**, jamais l'heure du serveur Lambda.
- **Mobile money par USSD, pas par API.** Al Izza, Nita, Airtel Money, Moov Money (Flooz) n'ont pas
  d'API publique ouverte : `PaymentProviders.ussdTemplate` (jetons `{merchant}`/`{amount}`) produit la
  chaîne à composer, puis le passager reporte la référence SMS que
  `ConfirmMobileMoneyPayment` contrôle (unicité incluse). Les codes USSD sont en base pour que
  l'exploitant les corrige lui-même. **Une vraie intégration exigerait un contrat marchand et des
  identifiants API par opérateur — c'est le seul point du produit qui n'est pas automatisable en l'état.**
- **`row.id` est une chaîne, les colonnes de référence sont numériques** : le seul pont est `numId()`
  dans `src/utils/Format.ts`.
- Les vues n'ont presque pas de types générés → alias `select` reconstitués dans
  `src/utils/ViewRows.ts` avec `asViewRows<T>()`. **Si un artefact de vue change ses `select`, mettre
  ce fichier à jour.**
- Rien de modifiable n'est lu depuis une vue (les vues ne se rafraîchissent pas après écriture) :
  suivi de course, statut chauffeur, verdict de pièce, tarifs et paiements lisent la table.

## Structure

Destinations : `/course` (passager), `/chauffeur`, `/admin`. `src/routes/index.tsx` redirige selon le
rôle (`Passager` / `Chauffeur` / `Admin`). Profils créés paresseusement au premier enregistrement,
jamais d'impasse pour un utilisateur sans profil.

## Évolution

- **2026-09-07** — Construction initiale complète : 13 tables, 8 vues, 8 actions (6 code + 2 DAG),
  3 rôles, thème sombre, moteur 3D, Street View, i18n 4 langues, et les trois espaces
  passager / chauffeur / administration.

## Limites connues

- La progression affichée pendant la lecture OCR d'une pièce est une estimation temporelle
  (0→95 % sur 60 s) : l'action ne renvoie pas de progression réelle.
- Un chauffeur sans course terminée n'apparaît pas dans `DriverEarnings` (agrégation).
