/**
 * Formes des lignes renvoyées par les vues.
 *
 * Les vues sont décrites par leurs artefacts `artifacts/views/*.json` : les
 * colonnes projetées y sont nommées une à une, mais `product-types.ts` ne
 * génère de types que pour les colonnes calculées. Ces interfaces reprennent
 * fidèlement les alias `select` de chaque artefact, et `asViewRows` typographie
 * le tableau non typé renvoyé par `useEntityGetAll`.
 *
 * Rappel : une vue ne se rafraîchit pas après une écriture. Tout écran qui
 * modifie une course, un chauffeur ou un paiement lit et écrit la table.
 */

export function asViewRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

/** LandmarksByCity */
export interface LandmarkRow {
  id: string;
  landmarkId?: number;
  name?: string;
  localName?: string;
  category?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  isPopular?: boolean;
  cityId?: number;
  cityName?: string;
  regionName?: string;
  cityIsActive?: boolean;
  searchLabel?: string;
}

/** RidesOverview */
export interface RideOverviewRow {
  id: string;
  rideId?: number;
  reference?: string;
  status?: string;
  pickupLabel?: string;
  dropoffLabel?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  distanceKm?: number;
  durationMin?: number;
  estimatedFare?: number;
  finalFare?: number;
  discountAmount?: number;
  platformCommission?: number;
  driverPayout?: number;
  paymentStatus?: string;
  requestedAt?: string;
  completedAt?: string;
  ratingByPassenger?: number;
  passengerId?: number;
  driverId?: number;
  passengerName?: string;
  passengerPhone?: string;
  driverName?: string;
  driverPhone?: string;
  driverPlate?: string;
  driverRating?: number;
  cityName?: string;
  regionName?: string;
  vehicleTypeName?: string;
  vehicleModelKey?: string;
  paymentProviderName?: string;
  routeLabel?: string;
  billedFare?: number;
}

/** DriversOverview */
export interface DriverOverviewRow {
  id: string;
  driverId?: number;
  email?: string;
  fullName?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  profilePhotoUrl?: string;
  plateNumber?: string;
  vehicleColor?: string;
  vehicleYear?: number;
  vehiclePhotoUrl?: string;
  vehicle3DConfig?: unknown;
  verificationStatus?: string;
  spokenLanguages?: string;
  acceptedPaymentMethods?: string;
  isOnline?: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
  lastSeenAt?: string;
  rating?: number;
  totalRides?: number;
  totalEarnings?: number;
  bio?: string;
  licenseExpiryDate?: string;
  cityId?: number;
  vehicleTypeId?: number;
  cityName?: string;
  regionName?: string;
  vehicleTypeName?: string;
  vehicleLocalName?: string;
  vehicleModelKey?: string;
  vehicleSeats?: number;
  vehicleHasAirConditioning?: boolean;
  isAvailable?: boolean;
  vehicleSummary?: string;
}

/** DriverEarnings */
export interface DriverEarningsRow {
  id: string;
  driverId?: number;
  driverName?: string;
  email?: string;
  plateNumber?: string;
  cityName?: string;
  completedRides?: number;
  grossRevenue?: number;
  netEarnings?: number;
  platformCommission?: number;
  totalDistanceKm?: number;
  averageRating?: number;
  lastRideAt?: string;
  averageFare?: number;
}

/** CityRideStats */
export interface CityRideStatsRow {
  id: string;
  cityId?: number;
  cityName?: string;
  regionName?: string;
  latitude?: number;
  longitude?: number;
  completedRides?: number;
  revenue?: number;
  platformCommission?: number;
  averageDistanceKm?: number;
  averageDurationMin?: number;
  averageFare?: number;
  averageRating?: number;
}

/** FareGridOverview */
export interface FareGridOverviewRow {
  id: string;
  fareId?: number;
  label?: string;
  baseFare?: number;
  pricePerKm?: number;
  pricePerMinute?: number;
  minimumFare?: number;
  cancellationFee?: number;
  nightSurchargePercent?: number;
  peakSurchargePercent?: number;
  driverCommissionPercent?: number;
  isActive?: boolean;
  cityId?: number;
  vehicleTypeId?: number;
  cityName?: string;
  regionName?: string;
  vehicleTypeName?: string;
  vehicleLocalName?: string;
  vehicleModelKey?: string;
  vehicleSeats?: number;
  vehicleHasAirConditioning?: boolean;
  vehicleSortOrder?: number;
  exampleFare5Km?: number;
}

/** PaymentsOverview */
export interface PaymentOverviewRow {
  id: string;
  paymentId?: number;
  reference?: string;
  amount?: number;
  platformCommission?: number;
  driverPayout?: number;
  status?: string;
  payerPhoneNumber?: string;
  ussdString?: string;
  transactionReference?: string;
  initiatedAt?: string;
  confirmedAt?: string;
  payoutStatus?: string;
  failureReason?: string;
  rideId?: number;
  rideReference?: string;
  pickupLabel?: string;
  dropoffLabel?: string;
  rideStatus?: string;
  providerName?: string;
  providerKind?: string;
  providerBrandColor?: string;
  driverId?: number;
  driverName?: string;
  driverMobileMoneyNumber?: string;
}

/** RideOffersOverview */
export interface RideOfferRow {
  id: string;
  offerId?: number;
  side?: string;
  amount?: number;
  previousAmount?: number;
  status?: string;
  reason?: string;
  respondedAt?: string;
  rideId?: number;
  driverId?: number;
  rideReference?: string;
  rideStatus?: string;
  pickupLabel?: string;
  dropoffLabel?: string;
  currentFare?: number;
  distanceKm?: number;
  driverName?: string;
  driverPhone?: string;
  driverRating?: number;
  driverPlate?: string;
  deltaAmount?: number;
}

/** SosAlertsOverview */
export interface SosAlertRow {
  id: string;
  alertId?: number;
  reference?: string;
  triggeredByEmail?: string;
  triggeredByRole?: string;
  triggeredByName?: string;
  triggeredByPhone?: string;
  kind?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  notifiedContacts?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  cityId?: number;
  rideId?: number;
  cityName?: string;
  regionName?: string;
  rideReference?: string;
  pickupLabel?: string;
  dropoffLabel?: string;
  driverName?: string;
  driverPhone?: string;
  driverPlate?: string;
  isOpen?: boolean;
  mapsUrl?: string;
}

/** SubscribersOverview */
export interface SubscriberRow {
  id: string;
  subscriberId?: number;
  contactName?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  pickupLabel?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffLabel?: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  tripKind?: string;
  activeDays?: string;
  pickupTime?: string;
  agreedFare?: number;
  isActive?: boolean;
  lastNotifiedAt?: string;
  notes?: string;
  driverId?: number;
  passengerId?: number;
  cityId?: number;
  driverName?: string;
  driverPhone?: string;
  passengerName?: string;
  passengerPhotoUrl?: string;
  cityName?: string;
  routeLabel?: string;
}

/** DriverDocumentsOverview */
export interface DriverDocumentOverviewRow {
  id: string;
  documentId?: number;
  documentType?: string;
  fileUrl?: string;
  documentNumber?: string;
  holderName?: string;
  issuedOn?: string;
  expiryDate?: string;
  checkStatus?: string;
  checkConfidence?: number;
  checkNotes?: string;
  extractedData?: unknown;
  reviewedBy?: string;
  reviewedAt?: string;
  driverId?: number;
  driverName?: string;
  driverEmail?: string;
  driverPhone?: string;
  plateNumber?: string;
  driverVerificationStatus?: string;
  cityName?: string;
  needsAttention?: boolean;
}