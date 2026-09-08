/**
 * Dictionnaire typé de l'app passager : Français (référence), Haoussa, Zarma,
 * Tamajaq. Le français est la langue par défaut et sert de repli clé par clé :
 * une entrée absente d'une langue s'affiche en français plutôt que d'être
 * inventée. Seuls des termes courants et attestés sont utilisés.
 */

export const LANGUAGES = ['Français', 'Haoussa', 'Zarma', 'Tamajaq'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_SHORT_LABELS: Record<Language, string> = {
  Français: 'FR',
  Haoussa: 'HA',
  Zarma: 'ZA',
  Tamajaq: 'TM',
};

const fr = {
  appTagline: 'Le taxi du Niger, à portée de main',
  navOrder: 'Commander',
  navHistory: 'Mes courses',
  navPlaces: 'Mes lieux',
  navProfile: 'Profil',
  navDriver: 'Chauffeur',
  navAdmin: 'Administration',

  /* Onglets passager */
  navHome: 'Accueil',
  navMap: 'Carte',
  navCurrentRide: 'En cours',
  /* Onglets chauffeur */
  navCockpit: 'Cockpit',
  navRides: 'Courses',
  navRevenue: 'Revenus',
  navSubscribers: 'Abonnés',
  navMyTaxi: 'Mon taxi',
  /* Onglets administration */
  navOverview: 'Vue globale',
  navFleet: 'Flotte',
  navCities: 'Villes',
  navAccounting: 'Comptabilité',
  navBrain: 'Cerveau IA',

  city: 'Ville',
  chooseCity: 'Choisir la ville',
  pickup: 'Départ',
  dropoff: 'Arrivée',
  choosePickup: 'Où êtes-vous ?',
  chooseDropoff: 'Où allez-vous ?',
  myPosition: 'Ma position',
  popularPlaces: 'Repères populaires',
  savedPlaces: 'Mes lieux',
  searchPlace: 'Chercher un repère, un quartier…',
  scoutPlace: 'Repérer le lieu',

  vehicle: 'Véhicule',
  chooseVehicle: 'Choisir un véhicule',
  seats: 'places',
  airConditioned: 'Climatisé',
  driversOnline: 'chauffeurs en ligne',
  noDriverOnline: 'Aucun chauffeur en ligne',
  unavailable: 'Indisponible',
  estimating: 'Calcul du prix…',
  eta: 'Arrivée dans',

  promoCode: 'Code promo',
  applyPromo: 'Appliquer',
  payment: 'Paiement',
  choosePayment: 'Moyen de paiement',
  cash: 'Espèces',
  mobileMoney: 'Mobile money',
  pay: 'Payer',
  ussdInstructions: 'Composez ce code sur votre téléphone',
  copyCode: 'Copier le code',
  copied: 'Code copié',
  smsReference: 'Référence du SMS',
  confirmPayment: 'Confirmer le paiement',
  cashDueTitle: 'À remettre au chauffeur',
  cashDueHint: 'Réglez ce montant en espèces à la fin de la course.',

  orderRide: 'Commander la course',
  ordering: 'Commande en cours…',
  cancelRide: 'Annuler la course',
  note: 'Consigne pour le chauffeur',
  passengers: 'Passagers',

  statusRecherche: 'Recherche',
  statusAcceptee: 'Acceptée',
  statusEnRoute: 'Chauffeur en route',
  statusArrive: 'Chauffeur arrivé',
  statusEnCourse: 'En course',
  statusTerminee: 'Terminée',
  statusAnnulee: 'Annulée',
  statusSimulation: 'Simulation terminée',

  searchingDriver: 'Recherche d’un chauffeur',
  candidateDrivers: 'Chauffeurs disponibles',
  notifyBySms: 'Prévenir par SMS',
  smsSent: 'SMS envoyé',
  call: 'Appeler',
  whatsapp: 'WhatsApp',
  streetView: 'Street View',
  inspect3D: 'Inspecter en 3D',
  driver: 'Chauffeur',
  plate: 'Immatriculation',
  spokenLanguages: 'Langues parlées',
  rating: 'Note',

  rateRide: 'Noter la course',
  rateSubmit: 'Envoyer ma note',
  reviewPlaceholder: 'Un mot sur la course (facultatif)',
  thanks: 'Merci !',

  history: 'Historique',
  noRideYet: 'Aucune course pour l’instant',
  price: 'Prix',
  total: 'Total',
  distance: 'Distance',
  duration: 'Durée',
  reference: 'Référence',

  language: 'Langue',
  save: 'Enregistrer',
  saved: 'Enregistré',
  cancel: 'Annuler',
  close: 'Fermer',
  retry: 'Réessayer',
  loading: 'Chargement…',
  errorTitle: 'Impossible de charger',
  errorHint: 'Vérifiez votre connexion, puis réessayez.',
  emergencyContact: 'Contact d’urgence',
  fullName: 'Nom et prénom',
  phone: 'Téléphone',
} as const;

export type TranslationKey = keyof typeof fr;
type Dict = Partial<Record<TranslationKey, string>>;

/* Haoussa — mota (véhicule), kudi (argent), tafiya (trajet), direba (chauffeur). */
const ha: Dict = {
  appTagline: 'Taxi na Nijar, a hannunka',
  navOrder: 'Nemi mota',
  navHistory: 'Tafiye-tafiyena',
  navPlaces: 'Wuraren da na fi so',
  navProfile: 'Bayanaina',
  navHome: 'Gida',
  navMap: 'Taswira',
  navRides: 'Tafiye-tafiye',
  navCities: 'Birane',
  city: 'Birni',
  chooseCity: 'Zaɓi birni',
  pickup: 'Tashi',
  dropoff: 'Zuwa',
  choosePickup: 'Ina kake yanzu?',
  chooseDropoff: 'Ina za ka?',
  myPosition: 'Wurin da nake',
  popularPlaces: 'Sanannun wurare',
  savedPlaces: 'Wuraren da na fi so',
  searchPlace: 'Nemi wuri ko unguwa…',
  vehicle: 'Mota',
  chooseVehicle: 'Zaɓi mota',
  seats: 'wurare',
  driversOnline: 'direbobi a shirye',
  noDriverOnline: 'Babu direba a shirye',
  unavailable: 'Babu',
  eta: 'Zai zo cikin',
  promoCode: 'Lambar rangwame',
  payment: 'Biyan kuɗi',
  choosePayment: 'Yadda za ka biya',
  cash: 'Kuɗi a hannu',
  pay: 'Biya',
  orderRide: 'Nemi mota yanzu',
  cancelRide: 'Soke tafiya',
  statusRecherche: 'Ana nema',
  statusAcceptee: 'An karɓa',
  statusEnRoute: 'Direba na kan hanya',
  statusArrive: 'Direba ya iso',
  statusEnCourse: 'Muna tafiya',
  statusTerminee: 'An gama',
  statusAnnulee: 'An soke',
  searchingDriver: 'Ana neman direba',
  candidateDrivers: 'Direbobi a shirye',
  call: 'Kira',
  driver: 'Direba',
  rating: 'Kima',
  price: 'Kuɗi',
  total: 'Duka',
  distance: 'Nisa',
  duration: 'Lokaci',
  history: 'Tarihi',
  language: 'Harshe',
  save: 'Ajiye',
  cancel: 'Soke',
  close: 'Rufe',
  retry: 'Sake gwadawa',
  loading: 'Ana ɗaukowa…',
  fullName: 'Suna',
  phone: 'Waya',
  thanks: 'Na gode!',
};

/* Zarma — mobili (véhicule), nooru (argent), dirawo (trajet). */
const za: Dict = {
  appTagline: 'Nijar taxi, ni kambe ra',
  navOrder: 'Mobili ceeci',
  navHistory: 'Ay dirawey',
  navProfile: 'Ay bayan',
  city: 'Kwaara',
  chooseCity: 'Kwaara suuba',
  pickup: 'Tunyan do',
  dropoff: 'Koyyan do',
  choosePickup: 'Man no ni go?',
  chooseDropoff: 'Man no ni ga koy?',
  myPosition: 'Ay gorodo',
  searchPlace: 'Nangu wala kurey ceeci…',
  vehicle: 'Mobili',
  chooseVehicle: 'Mobili suuba',
  driversOnline: 'direbey go soolante',
  noDriverOnline: 'Direba si no',
  unavailable: 'Si no',
  promoCode: 'Rangwame lambar',
  payment: 'Nooru bana',
  cash: 'Nooru kambe ra',
  pay: 'Bana',
  orderRide: 'Mobili ceeci sohõ',
  cancelRide: 'Dirawo naanay',
  statusRecherche: 'Ceeciyan ga koy',
  statusAcceptee: 'I ta',
  statusEnRoute: 'Direba go fondo ra',
  statusArrive: 'Direba to',
  statusEnCourse: 'Iri go dirawo ra',
  statusTerminee: 'A ban',
  statusAnnulee: 'I naanay',
  searchingDriver: 'Direba ceeciyan',
  call: 'Ce',
  driver: 'Direba',
  price: 'Nooru',
  total: 'Kulu',
  distance: 'Mooray',
  history: 'Tarihi',
  language: 'Sanni',
  save: 'Gaabu',
  cancel: 'Naanay',
  close: 'Daabu',
  loading: 'Zumandi…',
  fullName: 'Maa',
  phone: 'Telefon',
};

/* Tamajaq — vocabulaire restreint aux termes sûrs ; le reste reste en français. */
const tm: Dict = {
  navOrder: 'Ăgmăy takasi',
  city: 'Ăɵrəm',
  chooseCity: 'Săfrăn ăɵrəm',
  pickup: 'Edăg n əkkəy',
  dropoff: 'Edăg n əwəd',
  vehicle: 'Takarrəyt',
  call: 'Ăɵăr',
  driver: 'Anaxdam n takarrəyt',
  price: 'Ălqiman',
  language: 'Awal',
  save: 'Ăhrəs',
  close: 'Ărməs',
  thanks: 'Tănămmərt!',
};

const DICTIONARIES: Record<Language, Dict> = {
  Français: fr,
  Haoussa: ha,
  Zarma: za,
  Tamajaq: tm,
};

/** Traduit une clé, avec repli sur le français si la langue ne la couvre pas. */
export function translate(language: Language, key: TranslationKey): string {
  return DICTIONARIES[language][key] ?? fr[key];
}

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
  );
}

/** Statut de course (valeur stockée) → clé de traduction. */
export const RIDE_STATUS_KEYS: Record<string, TranslationKey> = {
  Recherche: 'statusRecherche',
  Acceptée: 'statusAcceptee',
  'Chauffeur en route': 'statusEnRoute',
  'Chauffeur arrivé': 'statusArrive',
  'En course': 'statusEnCourse',
  Terminée: 'statusTerminee',
  Annulée: 'statusAnnulee',
  'Simulation terminée': 'statusSimulation',
};

/** Statuts d'une course encore en vie, du plus jeune au plus avancé. */
export const OPEN_RIDE_STATUSES = [
  'Recherche',
  'Acceptée',
  'Chauffeur en route',
  'Chauffeur arrivé',
  'En course',
] as const;