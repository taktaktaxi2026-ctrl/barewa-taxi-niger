/**
 * `/course` — Accueil passager : bannière météo et heures de prière, cockpit
 * de bienvenue avec annonce vocale, et widget de commande rapide. Quand une
 * course est déjà en cours, l'accueil la met en avant et renvoie vers l'onglet
 * « En cours » plutôt que de proposer une seconde commande.
 */

import { CircleAlert, Navigation } from 'lucide-react';
import { Link } from 'react-router';
import { useEntityGetAll } from '@blocksdiy/blocks-client-sdk/reactSdk';
import { CitiesEntity, RidesEntity } from '@/product-types';
import { useCurrentProfiles } from '@/hooks/useCurrentProfiles';
import { useAppContext } from '@/components/AppProvider';
import { formatFcfa, numId } from '@/utils/Format';
import { OPEN_RIDE_STATUSES, RIDE_STATUS_KEYS } from '@/utils/Translations';
import { ProfileSetup } from '@/components/ProfileSetup';
import { OrderForm } from '@/components/course/OrderForm';
import { WeatherBanner } from '@/components/course/WeatherBanner';
import { WelcomeCockpit } from '@/components/course/WelcomeCockpit';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function CourseHomePage() {
  const { t, cityId } = useAppContext();
  const { passenger, isLoading, error } = useCurrentProfiles();

  const citiesQuery = useEntityGetAll(CitiesEntity);
  const ridesQuery = useEntityGetAll(
    RidesEntity,
    { passengerId: passenger ? numId(passenger.id) : undefined },
    { enabled: Boolean(passenger?.id) },
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 sm:p-4">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Impossible de charger votre profil</AlertTitle>
          <AlertDescription>{t('errorHint')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!passenger) return <ProfileSetup kind="passenger" />;

  const effectiveCityId = cityId ?? passenger.cityId ?? null;
  const city = (citiesQuery.data ?? []).find(
    (item) => numId(item.id) === effectiveCityId,
  );

  const rides = ridesQuery.data ?? [];
  const activeRide = [...rides]
    .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''))
    .find((ride) =>
      (OPEN_RIDE_STATUSES as readonly string[]).includes(ride.status ?? ''),
    );

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <WeatherBanner
        cityName={city?.name}
        latitude={city?.latitude}
        longitude={city?.longitude}
      />

      <WelcomeCockpit
        passengerName={passenger.fullName ?? 'cher client'}
        cityId={effectiveCityId}
        cityName={city?.name ?? 'votre ville'}
      />

      {ridesQuery.error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Vos courses n’ont pas pu être lues</AlertTitle>
          <AlertDescription>
            Vous pouvez tout de même commander une nouvelle course.
          </AlertDescription>
        </Alert>
      )}

      {activeRide ? (
        <Card size="sm">
          <CardContent className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                {t(RIDE_STATUS_KEYS[activeRide.status ?? ''] ?? 'statusRecherche')}
              </Badge>
              <Badge variant="outline" className="amount">
                {activeRide.reference}
              </Badge>
              <span className="amount ms-auto font-bold text-primary">
                {formatFcfa(activeRide.finalFare ?? activeRide.estimatedFare)}
              </span>
            </div>
            <p className="truncate text-sm">
              {activeRide.pickupLabel} → {activeRide.dropoffLabel}
            </p>
            <Button
              className="h-12"
              render={<Link to="/course/en-cours" />}
            >
              <Navigation data-icon="inline-start" />
              Suivre ma course en cours
            </Button>
          </CardContent>
        </Card>
      ) : (
        <OrderForm passenger={passenger} />
      )}
    </div>
  );
}
