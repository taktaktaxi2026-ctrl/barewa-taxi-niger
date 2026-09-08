/**
 * `/chauffeur` — Cockpit : interrupteur En ligne / Hors ligne (la position GPS
 * est remontée sur DriverProfile), compteurs clés du jour, et carte radar des
 * demandes de passagers dans un rayon de 5 km.
 *
 * Les courses sont lues sur la table Rides (jamais sur une vue) pour que le
 * statut soit à jour à la seconde. Les courses de simulation sont écartées de
 * tous les compteurs.
 */

import {
  CircleAlert,
  Inbox,
  MapPin,
  Radar,
  Star,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router';
import {
  useEntityGetAll,
  useEntityUpdate,
} from '@blocksdiy/blocks-client-sdk/reactSdk';
import {
  DriverEarningsEntity,
  DriverProfileEntity,
  RidesEntity,
} from '@/product-types';
import { asViewRows, type DriverEarningsRow } from '@/utils/ViewRows';
import { useCurrentProfiles } from '@/hooks/useCurrentProfiles';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ProfileSetup } from '@/components/ProfileSetup';
import { RideMap, type MapPoint } from '@/components/RideMap';
import {
  formatFcfa,
  formatNigerTime,
  nigerDayKey,
  nigerToday,
  numId,
} from '@/utils/Format';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';

const RADAR_RADIUS_KM = 5;

/** Distance orthodromique en kilomètres. */
function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export default function ChauffeurCockpitPage() {
  const { driver, isLoading, error } = useCurrentProfiles();
  const profileUpdate = useEntityUpdate(DriverProfileEntity);
  const geo = useGeolocation();

  const driverId = driver ? numId(driver.id) : undefined;

  const myRidesQuery = useEntityGetAll(
    RidesEntity,
    { driverId },
    { enabled: Boolean(driverId) },
  );
  const requestsQuery = useEntityGetAll(
    RidesEntity,
    { status: 'Recherche', cityId: driver?.cityId },
    { enabled: Boolean(driver?.cityId) },
  );
  const earningsQuery = useEntityGetAll(
    DriverEarningsEntity,
    { driverId },
    { enabled: Boolean(driverId) },
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 sm:p-4">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Impossible de charger votre profil</AlertTitle>
          <AlertDescription>
            Vérifiez votre connexion, puis rouvrez la page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!driver) return <ProfileSetup kind="driver" />;

  const myRides = (myRidesQuery.data ?? []).filter(
    (ride) => !ride.isSimulation,
  );
  const today = nigerToday();
  const todayRides = myRides.filter(
    (ride) =>
      ride.status === 'Terminée' && nigerDayKey(ride.completedAt) === today,
  );
  const todayEarnings = todayRides.reduce(
    (sum, ride) => sum + (ride.driverPayout ?? 0),
    0,
  );
  const earnings = asViewRows<DriverEarningsRow>(earningsQuery.data)[0];

  const isVerified = driver.verificationStatus === 'Vérifié';

  // Radar : demandes du même type de véhicule dans un rayon de 5 km.
  const hasPosition =
    typeof driver.currentLatitude === 'number' &&
    typeof driver.currentLongitude === 'number';
  const nearbyRequests = (requestsQuery.data ?? [])
    .filter(
      (ride) =>
        !ride.isSimulation &&
        ride.vehicleTypeId === driver.vehicleTypeId &&
        typeof ride.pickupLatitude === 'number' &&
        typeof ride.pickupLongitude === 'number',
    )
    .filter(
      (ride) =>
        !hasPosition ||
        distanceKm(
          driver.currentLatitude as number,
          driver.currentLongitude as number,
          ride.pickupLatitude as number,
          ride.pickupLongitude as number,
        ) <= RADAR_RADIUS_KM,
    );

  const beacons: MapPoint[] = nearbyRequests.map((ride) => ({
    latitude: ride.pickupLatitude as number,
    longitude: ride.pickupLongitude as number,
    label: `${ride.pickupLabel} → ${ride.dropoffLabel}`,
  }));

  const toggleOnline = async (nextOnline: boolean) => {
    try {
      if (nextOnline) {
        const point = await geo.request();
        if (!point) {
          toast.add({
            title: 'Position requise',
            description:
              'Les passagers doivent voir où vous êtes pour vous envoyer une course.',
            type: 'error',
          });
          return;
        }
        await profileUpdate.updateFunction({
          id: driver.id,
          data: {
            isOnline: true,
            currentLatitude: point.latitude,
            currentLongitude: point.longitude,
            lastSeenAt: new Date().toISOString(),
          },
        });
        toast.add({ title: 'Vous êtes en ligne', type: 'success' });
      } else {
        await profileUpdate.updateFunction({
          id: driver.id,
          data: { isOnline: false, lastSeenAt: new Date().toISOString() },
        });
        toast.add({ title: 'Vous êtes hors ligne', type: 'success' });
      }
    } catch {
      toast.add({
        title: 'Changement impossible',
        description: 'Vérifiez votre connexion, puis réessayez.',
        type: 'error',
      });
    }
  };

  const refreshPosition = async () => {
    const point = await geo.request();
    if (!point) return;
    try {
      await profileUpdate.updateFunction({
        id: driver.id,
        data: {
          currentLatitude: point.latitude,
          currentLongitude: point.longitude,
          lastSeenAt: new Date().toISOString(),
        },
      });
      toast.add({ title: 'Position mise à jour', type: 'success' });
    } catch {
      toast.add({ title: 'Position non enregistrée', type: 'error' });
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      {/* Interrupteur principal En ligne / Hors ligne */}
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <div
            className={
              driver.isOnline
                ? 'flex items-center gap-3 rounded-lg border border-primary/50 bg-primary/10 p-3'
                : 'flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3'
            }
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">
                {driver.isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {driver.fullName} · {driver.plateNumber}
                {driver.lastSeenAt
                  ? ` · vu à ${formatNigerTime(driver.lastSeenAt)}`
                  : ''}
              </p>
            </div>
            <Switch
              checked={Boolean(driver.isOnline)}
              disabled={!isVerified || profileUpdate.isLoading || geo.isLoading}
              onCheckedChange={(checked) => toggleOnline(checked === true)}
              aria-label="En ligne"
            />
          </div>

          {!isVerified && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>
                Pièces à valider — {driver.verificationStatus}
              </AlertTitle>
              <AlertDescription>
                Vous recevrez des courses dès que vos pièces seront au statut
                « Vérifié ». Déposez-les dans l’onglet « Mon taxi ».
              </AlertDescription>
            </Alert>
          )}

          {geo.error && (
            <Alert variant="destructive">
              <MapPin />
              <AlertTitle>Localisation indisponible</AlertTitle>
              <AlertDescription>{geo.error}</AlertDescription>
            </Alert>
          )}

          {driver.isOnline && (
            <Button
              variant="secondary"
              onClick={refreshPosition}
              disabled={geo.isLoading || profileUpdate.isLoading}
            >
              {geo.isLoading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <MapPin data-icon="inline-start" />
              )}
              Actualiser ma position
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Compteurs clés du jour */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={<Wallet className="size-4" />}
          label="Gains du jour"
          value={formatFcfa(todayEarnings)}
          hint="100 % pour vous"
        />
        <StatTile
          icon={<Inbox className="size-4" />}
          label="Courses du jour"
          value={String(todayRides.length)}
          hint="terminées aujourd’hui"
        />
        <StatTile
          icon={<Star className="size-4" />}
          label="Satisfaction"
          value={(driver.rating ?? 0).toFixed(1)}
          hint="sur 5"
        />
        <StatTile
          icon={<TrendingUp className="size-4" />}
          label="Gains cumulés"
          value={formatFcfa(earnings?.netEarnings ?? driver.totalEarnings)}
          hint={earningsQuery.isLoading ? 'Calcul…' : 'net chauffeur'}
        />
      </div>

      {/* Radar des demandes autour de soi */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="size-4 text-primary" />
            Radar des demandes
          </CardTitle>
          <CardDescription>
            Passagers en attente dans un rayon de {RADAR_RADIUS_KM} km, pour
            votre type de véhicule.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {requestsQuery.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Demandes indisponibles</AlertTitle>
              <AlertDescription>
                Vérifiez votre connexion, puis rouvrez la page.
              </AlertDescription>
            </Alert>
          )}

          {!hasPosition && (
            <Alert>
              <MapPin />
              <AlertTitle>Position inconnue</AlertTitle>
              <AlertDescription>
                Passez en ligne pour remonter votre position : le radar se
                centrera alors sur vous.
              </AlertDescription>
            </Alert>
          )}

          <RideMap
            driver={
              hasPosition
                ? {
                    latitude: driver.currentLatitude as number,
                    longitude: driver.currentLongitude as number,
                    label: 'Ma position',
                  }
                : null
            }
            fleet={beacons}
            className="h-64 w-full"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="amount">
              {nearbyRequests.length} demande
              {nearbyRequests.length > 1 ? 's' : ''} autour de vous
            </Badge>
            <Button
              size="sm"
              variant="secondary"
              render={<Link to="/chauffeur/courses" />}
            >
              <Inbox data-icon="inline-start" />
              Voir les courses disponibles
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="amount text-lg font-bold text-primary">{value}</span>
        {hint && (
          <span className="text-[11px] text-muted-foreground">{hint}</span>
        )}
      </CardContent>
    </Card>
  );
}
