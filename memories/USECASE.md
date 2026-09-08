# Le métier : VTC et taxi urbain en Afrique de l'Ouest sahélienne

## Comment le transport de personnes fonctionne réellement

Le marché est **informel avant d'être numérique**. Le chauffeur est propriétaire ou locataire de son
véhicule, travaille à la journée et vit de sa recette du jour ; la plateforme n'est pas son employeur
mais son apporteur de courses. Il continuera à prendre des clients dans la rue en parallèle de
l'application : toute plateforme qui suppose une exclusivité se trompe.

Trois modes de course coexistent, et il faut savoir lequel on vend :

- **Course partagée** (« taxi-ville ») — le taxi ramasse plusieurs clients sur un axe, chacun paie un
  tarif de zone fixe et modique. C'est le mode dominant en volume.
- **Course exclusive** (« déposé ») — le client privatise le véhicule, à un tarif plusieurs fois
  supérieur. C'est ce mode que les plateformes numérisent, parce qu'il est le seul où l'origine, la
  destination et le prix sont attribuables à une seule personne.
- **Transfert** — aéroport, gare routière, interurbain : prix négocié ou forfaitaire, réservé à
  l'avance.

Le parc est **segmenté par région**, pas seulement par confort. Les grandes villes ont des berlines
et des compactes ; les villes secondaires sont dominées par le **tricycle motorisé bâché** (moto-taxi
à trois roues, cabine ouverte), moins cher, plus maniable sur piste et sable, mais sans climatisation
ni coffre. Un catalogue de véhicules pertinent porte donc, par type : nombre de places, présence de
climatisation (déterminante d'avril à juin), capacité de bagages, et disponibilité par ville.

## L'adressage : le problème structurel du secteur

**Les rues n'ont pas d'adresse utilisable.** Personne ne dit « 14 rue X » : on se repère aux
**ronds-points, marchés, mosquées, hôpitaux, palais coutumiers, quartiers et débarcadères**. Toute
plateforme locale doit donc porter un **référentiel de repères géolocalisés**, et non un moteur
d'adresses postales. Deux conséquences de conception :

- Chaque repère a un **nom officiel** (souvent en français, langue administrative) et un **nom
  courant en langue véhiculaire** que chauffeurs et clients emploient réellement. La recherche doit
  trouver les deux, plus le quartier.
- Le point de rendez-vous exact reste ambigu même avec des coordonnées : il faut un **champ de
  consigne libre** (« portail vert après la pharmacie ») et un moyen de **voir le lieu** — vue de rue
  ou satellite — avant de partir. C'est ce qui supprime les appels de recherche mutuelle, principal
  motif d'annulation.
- Les lieux favoris du client (domicile, travail, école) sont un raccourci à forte valeur, puisqu'ils
  figent une fois pour toutes une description que le client ne sait pas formuler.

## Tarification

Le prix se construit localement : **une grille par ville et par type de véhicule**, jamais un tarif
national. Structure standard du secteur : prise en charge fixe + prix au kilomètre + prix à la minute,
avec un **prix plancher** qui rend les courses très courtes viables, et des frais d'annulation après
acceptation. S'y ajoutent des majorations de **nuit** et d'**heure de pointe**, exprimées en
pourcentage.

Deux invariants souvent manqués :

- **Arrondir le prix à la coupure monétaire en circulation.** En zone franc CFA, les petites pièces
  courantes imposent des prix ronds ; un montant qui ne peut pas être rendu en espèces est un
  montant qui se négocie à la baisse dans la rue.
- **Les vitesses moyennes de circulation diffèrent fortement entre la capitale et les villes
  secondaires**, et la distance à vol d'oiseau sous-estime lourdement la distance routière. Un
  facteur de sinuosité est indispensable au chiffrage.

La plateforme se rémunère par une **commission en pourcentage de la course**, ventilée à la clôture
en part plateforme et net chauffeur. Cette ventilation doit être figée sur la course et sur le
règlement, car elle fonde le décompte des versements et les contestations.

## Le paiement : mobile money par USSD, et l'espèce reste reine

L'espèce domine et le restera : elle doit être un moyen de paiement de premier rang, pas un repli.
Après elle vient le **mobile money**, opéré par les opérateurs télécoms et des établissements
financiers locaux — plusieurs par pays, chacun avec sa base de clientèle.

Le point technique décisif : **le mobile money se règle par code USSD composé sur le téléphone**, pas
par redirection web. Le parcours réel est : la plateforme calcule le code de transfert marchand
(numéro marchand + montant), le client le compose, valide avec son code secret, reçoit une
**référence de transaction par SMS**, et cette référence sert de preuve. Une plateforme sans contrat
marchand ni accès API chez chaque opérateur doit donc concevoir un **rapprochement par référence** :
saisie de la référence, contrôle d'unicité, passage du règlement à confirmé. C'est un flux honnête et
opérationnel, mais il faut savoir qu'il exige un contrôle humain ou un rapprochement bancaire en
aval, et que l'automatisation complète est bloquée par le contrat, pas par la technique.

Les versements aux chauffeurs suivent leur propre cycle (à verser → versé), distinct du règlement du
client, puisqu'un chauffeur payé en espèces a déjà encaissé et doit au contraire la commission.

## Conformité et confiance

Le contrôle documentaire est l'obligation la plus lourde : **permis de conduire, pièce d'identité,
carte grise, attestation d'assurance, visite technique**. Chacune a une date d'expiration, et un
chauffeur dont une pièce est périmée doit cesser de recevoir des courses — c'est le point où la
responsabilité de la plateforme est engagée. Les pièces arrivent **photographiées au téléphone**, de
biais, froissées, mal éclairées : la lecture automatique fait gagner du temps mais doit rendre un
indice de confiance, signaler les divergences avec le profil déclaré, et **toujours laisser la
correction humaine avant enregistrement**. Ne jamais fabriquer une valeur non lue.

S'y ajoutent, côté confiance : notation réciproque client/chauffeur, contact d'urgence, et
identification visible du véhicule (immatriculation, couleur, photo) pour que le client monte dans le
bon véhicule.

## Cycle de vie d'une course

`recherche de chauffeur → acceptée → chauffeur en route → chauffeur arrivé → en course → terminée`,
avec `annulée` possible à tout moment avant le départ et un responsable d'annulation identifié
(client, chauffeur, plateforme) — l'attribution conditionne les frais. Le prix est **verrouillé à la
commande**, puis un montant final est arrêté à la clôture sur la distance et la durée réelles ; l'écart
entre les deux est la source de litige la plus fréquente, d'où l'intérêt de conserver les deux
montants.

Les états qui comptent pour la mise en relation sont, côté chauffeur : **en ligne**, position
récente, pièces valides, type de véhicule, ville. Un chauffeur est sollicité par proximité et délai
d'arrivée, pas par ancienneté.

## Vocabulaire et contraintes d'usage

Plurilinguisme structurel : la langue administrative (français) coexiste avec plusieurs langues
véhiculaires, et une partie des chauffeurs lit mal la langue administrative. L'interface doit être
traduite, et **aucun terme ne doit être inventé** : mieux vaut retomber sur la langue administrative
qu'afficher un mot que personne n'emploie.

Contraintes matérielles à intégrer dès la conception, pas après :

- Téléphones Android d'entrée de gamme, WebGL parfois absent → tout rendu graphique avancé doit avoir
  un repli.
- Données mobiles chères et intermittentes, coupures d'électricité → charges légères, tolérance à la
  perte de réseau.
- **Le SMS est le canal de notification fiable**, y compris là où la couverture données ne passe pas :
  un chauffeur doit pouvoir être prévenu d'une course sans internet.
- Écrans consultés en plein soleil → contraste élevé, cibles tactiles larges.
