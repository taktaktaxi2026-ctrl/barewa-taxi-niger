/**
 * `/course/historique` — les courses passées du passager, lues sur la vue
 * RidesOverview pour avoir directement le nom du chauffeur et le trajet.
 */

import { CircleAlert, Clock, ReceiptText, RotateCcw, Star } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useEntityGetAll } from '@blocksdiy/blocks-client-sdk/reactSdk';
import { RidesOverviewEntity } from '@/product-types';
import { asViewRows, type RideOverviewRow } from '@/utils/ViewRows';
import { useCurrentProfiles } from '@/hooks/useCurrentProfiles';
import { useAppContext } from '@/components/AppProvider';
import { Button } from '@/components/ui/button';
import { numId } from '@/utils/Format';
import {
  formatDistanceKm,
  formatFcfa,
  formatMinutes,
  formatNigerDateTime,
} from '@/utils/Format';
import { RIDE_STATUS_KEYS } from '@/utils/Translations';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

export default function HistoriquePage() {
  const { t, requestRebook, openReceipt } = useAppContext();
  const navigate = useNavigate();
  const { passenger, isLoading: profileLoading } = useCurrentProfiles();
  const ridesQuery = useEntityGetAll(
    RidesOverviewEntity,
    { passengerId: passenger ? numId(passenger.id) : undefined },
    { enabled: Boolean(passenger?.id) },
  );

  // Les courses de simulation ne figurent jamais dans l'historique réel.
  const rides = asViewRows<RideOverviewRow>(ridesQuery.data).filter(
    (ride) => ride.status !== 'Simulation terminée',
  );

  const rebook = (ride: RideOverviewRow) => {
    if (
      typeof ride.pickupLatitude !== 'number' ||
      typeof ride.pickupLongitude !== 'number' ||
      typeof ride.dropoffLatitude !== 'number' ||
      typeof ride.dropoffLongitude !== 'number'
    ) {
      return;
    }
    requestRebook({
      pickupLabel: ride.pickupLabel ?? 'Départ',
      pickupLatitude: ride.pickupLatitude,
      pickupLongitude: ride.pickupLongitude,
      dropoffLabel: ride.dropoffLabel ?? 'Arrivée',
      dropoffLatitude: ride.dropoffLatitude,
      dropoffLongitude: ride.dropoffLongitude,
    });
    navigate('/course');
  };

  if (profileLoading || (ridesQuery.isLoading && !rides.length)) {
    return (
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (ridesQuery.error) {
    return (
      <div className="p-3 sm:p-4">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{t('errorTitle')}</AlertTitle>
          <AlertDescription>{t('errorHint')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!rides.length) {
    return (
      <div className="p-3 sm:p-4">
        <Empty>
          <EmptyMedia variant="icon">
            <Clock />
          </EmptyMedia>
          <EmptyTitle>{t('noRideYet')}</EmptyTitle>
          <EmptyDescription>
            Vos courses terminées apparaîtront ici avec leur prix en FCFA et le
            nom de votre chauffeur.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const total = rides
    .filter((ride) => ride.status === 'Terminée')
    .reduce((sum, ride) => sum + (ride.billedFare ?? 0), 0);

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <Card size="sm">
        <CardContent className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">
            {rides.length} course{rides.length > 1 ? 's' : ''} · {t('total')}
          </span>
          <span className="amount text-xl font-bold text-primary">
            {formatFcfa(total)}
          </span>
        </CardContent>
      </Card>

      {rides.map((ride) => (
        <Card key={ride.id} size="sm">
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {ride.routeLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatNigerDateTime(ride.requestedAt)} · {ride.cityName}
                </p>
              </div>
              <span className="amount shrink-0 text-base font-bold text-primary">
                {formatFcfa(ride.billedFare)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge
                variant={ride.status === 'Terminée' ? 'secondary' : 'outline'}
              >
                {t(RIDE_STATUS_KEYS[ride.status ?? ''] ?? 'statusRecherche')}
              </Badge>
              {ride.vehicleTypeName && <span>{ride.vehicleTypeName}</span>}
              {ride.driverName && <span>· {ride.driverName}</span>}
              <span className="amount">
                · {formatDistanceKm(ride.distanceKm)}
              </span>
              <span className="amount">
                · {formatMinutes(ride.durationMin)}
              </span>
              {ride.paymentProviderName && (
                <span>· {ride.paymentProviderName}</span>
              )}
              {ride.ratingByPassenger ? (
                <span className="inline-flex items-center gap-1">
                  · <Star className="size-3 fill-primary text-primary" />
                  <span className="amount">{ride.ratingByPassenger}</span>
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={typeof ride.pickupLatitude !== 'number'}
                onClick={() => rebook(ride)}
              >
                <RotateCcw data-icon="inline-start" />
                Re-commander ce trajet
              </Button>
              {ride.status === 'Terminée' && ride.rideId !== undefined && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openReceipt(ride.rideId as number)}
                >
                  <ReceiptText data-icon="inline-start" />
                  Voir la facture
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}