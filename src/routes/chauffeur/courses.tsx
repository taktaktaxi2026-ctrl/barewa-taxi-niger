/**
 * `/chauffeur/courses` — Courses disponibles.
 *
 * Flux en temps réel des demandes de la ville, pour le type de véhicule du
 * chauffeur, lu sur la table Rides. Trois décisions : accepter, contre-proposer
 * un prix (action SubmitRideOffer), ou écarter la demande.
 *
 * « Écarter » n'agit que sur cet écran et pour cette session : une demande
 * appartient au passager, pas au chauffeur — elle reste proposée aux autres
 * chauffeurs de la ville.
 */

import { useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  EyeOff,
  HandCoins,
  Inbox,
  MessageCircle,
  Navigation,
  Phone,
} from 'lucide-react';
import {
  useEntityGetAll,
  useEntityUpdate,
  useExecuteAction,
} from '@blocksdiy/blocks-client-sdk/reactSdk';
import {
  PassengerProfileEntity,
  RidesEntity,
  SubmitRideOfferAction,
} from '@/product-types';
import { useCurrentProfiles } from '@/hooks/useCurrentProfiles';
import { ProfileSetup } from '@/components/ProfileSetup';
import { DriverActiveRide } from '@/components/chauffeur/DriverActiveRide';
import { NegotiationPanel } from '@/components/course/NegotiationPanel';
import {
  formatDistanceKm,
  formatFcfa,
  formatMinutes,
  formatNigerTime,
  numId,
  telHref,
  whatsappHref,
} from '@/utils/Format';
import { OPEN_RIDE_STATUSES } from '@/utils/Translations';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';

const COUNTER_REASONS = [
  'Embouteillage sur l’itinéraire',
  'Pluie',
  'Retour à vide',
  'Course de nuit',
];

export default function ChauffeurRidesPage() {
  const { driver, isLoading, error } = useCurrentProfiles();
  const rideUpdate = useEntityUpdate(RidesEntity);
  const offerAction = useExecuteAction(SubmitRideOfferAction);

  const [dismissed, setDismissed] = useState<string[]>([]);
  const [counterRideId, setCounterRideId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterReason, setCounterReason] = useState(COUNTER_REASONS[0]);

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
  const passengersQuery = useEntityGetAll(PassengerProfileEntity);

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

  const isVerified = driver.verificationStatus === 'Vérifié';

  const activeRide = (myRidesQuery.data ?? []).find((ride) =>
    (OPEN_RIDE_STATUSES as readonly string[]).includes(ride.status ?? ''),
  );

  const requests = (requestsQuery.data ?? []).filter(
    (ride) =>
      !ride.isSimulation &&
      ride.vehicleTypeId === driver.vehicleTypeId &&
      !dismissed.includes(ride.id),
  );

  const passengerOf = (passengerId: number | undefined) =>
    (passengersQuery.data ?? []).find(
      (item) => numId(item.id) === passengerId,
    );

  const counterRide = requests.find((ride) => ride.id === counterRideId);

  const accept = async (rideId: string) => {
    try {
      await rideUpdate.updateFunction({
        id: rideId,
        data: {
          driverId,
          status: 'Acceptée',
          acceptedAt: new Date().toISOString(),
        },
      });
      toast.add({ title: 'Course acceptée', type: 'success' });
    } catch {
      toast.add({
        title: 'Acceptation impossible',
        description: 'Un autre chauffeur a peut-être déjà pris cette course.',
        type: 'error',
      });
    }
  };

  const sendCounter = async () => {
    if (!counterRide) return;
    const amount = Number(counterAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.add({
        title: 'Montant invalide',
        description: 'Indiquez un prix positif en FCFA.',
        type: 'error',
      });
      return;
    }
    try {
      const result = await offerAction.executeFunction({
        rideId: numId(counterRide.id),
        side: 'Chauffeur',
        amount: Math.round(amount),
        driverId,
        reason: counterReason,
      });
      if (!result.success) {
        toast.add({
          title: 'Contre-offre refusée',
          description: result.message,
          type: 'error',
        });
        return;
      }
      setCounterRideId(null);
      setCounterAmount('');
      toast.add({
        title: `Contre-offre envoyée : ${formatFcfa(result.amount ?? amount)}`,
        description: 'Le passager peut l’accepter ou répondre.',
        type: 'success',
      });
    } catch {
      toast.add({
        title: 'Contre-offre non envoyée',
        description: 'Vérifiez votre connexion, puis réessayez.',
        type: 'error',
      });
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      {!isVerified && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Profil non vérifié</AlertTitle>
          <AlertDescription>
            Vous pouvez consulter les demandes, mais l’acceptation n’est
            ouverte qu’aux chauffeurs au statut « Vérifié ».
          </AlertDescription>
        </Alert>
      )}

      {/* Mode course active : guidage et contacts du passager */}
      {activeRide && (
        <>
          <DriverActiveRide ride={activeRide} />
          {activeRide.status === 'Acceptée' && (
            <NegotiationPanel
              ride={activeRide as typeof activeRide & { id: string }}
              side="Chauffeur"
              driverId={driverId}
            />
          )}
        </>
      )}

      {!activeRide && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-base">Demandes entrantes</CardTitle>
            <CardDescription>
              Les courses en recherche dans votre ville, pour votre type de
              véhicule.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {requestsQuery.error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Demandes indisponibles</AlertTitle>
                <AlertDescription>
                  Vérifiez votre connexion, puis rouvrez la page.
                </AlertDescription>
              </Alert>
            )}

            {requestsQuery.isLoading && !requests.length && (
              <div className="flex flex-col gap-2">
                {[0, 1].map((row) => (
                  <Skeleton key={row} className="h-28 w-full" />
                ))}
              </div>
            )}

            {!requestsQuery.isLoading && !requests.length && (
              <Empty>
                <EmptyMedia variant="icon">
                  <Inbox />
                </EmptyMedia>
                <EmptyTitle>Aucune demande pour l’instant</EmptyTitle>
                <EmptyDescription>
                  {driver.isOnline
                    ? 'Restez en ligne : les nouvelles demandes arrivent ici automatiquement.'
                    : 'Passez en ligne depuis le cockpit pour recevoir les demandes.'}
                </EmptyDescription>
              </Empty>
            )}

            {requests.map((ride) => {
              const passenger = passengerOf(ride.passengerId);
              return (
                <div
                  key={ride.id}
                  className="flex flex-col gap-2 rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {ride.pickupLabel} → {ride.dropoffLabel}
                      </p>
                      <p className="amount text-xs text-muted-foreground">
                        {formatDistanceKm(ride.distanceKm)} ·{' '}
                        {formatMinutes(ride.durationMin)} · demandée à{' '}
                        {formatNigerTime(ride.requestedAt)}
                      </p>
                    </div>
                    <span className="amount shrink-0 text-base font-bold text-primary">
                      {formatFcfa(ride.estimatedFare)}
                    </span>
                  </div>

                  {ride.passengerNote && (
                    <p className="text-xs text-muted-foreground">
                      Consigne : {ride.passengerNote}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="amount">
                      {ride.reference}
                    </Badge>
                    {passenger?.fullName && (
                      <Badge variant="secondary">{passenger.fullName}</Badge>
                    )}
                    {typeof ride.passengerCount === 'number' && (
                      <Badge variant="outline" className="amount">
                        {ride.passengerCount} passager
                        {ride.passengerCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!isVerified || rideUpdate.isLoading}
                      onClick={() => accept(ride.id)}
                    >
                      <CheckCircle2 data-icon="inline-start" />
                      Accepter la course
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!isVerified}
                      onClick={() => {
                        setCounterRideId(ride.id);
                        setCounterAmount(
                          String((ride.estimatedFare ?? 0) + 300),
                        );
                      }}
                    >
                      <HandCoins data-icon="inline-start" />
                      Contre-proposer
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDismissed((current) => [...current, ride.id])
                      }
                    >
                      <EyeOff data-icon="inline-start" />
                      Écarter
                    </Button>
                  </div>

                  {passenger?.phoneNumber && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        render={<a href={telHref(passenger.phoneNumber)} />}
                      >
                        <Phone data-icon="inline-start" />
                        Appeler
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        render={
                          <a
                            href={whatsappHref(
                              passenger.phoneNumber,
                              `Bonjour, je suis votre chauffeur BAREWA pour la course ${ride.reference ?? ''}.`,
                            )}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        <MessageCircle data-icon="inline-start" />
                        WhatsApp
                      </Button>
                      {typeof ride.pickupLatitude === 'number' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          render={
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${ride.pickupLatitude},${ride.pickupLongitude}&travelmode=driving`}
                              target="_blank"
                              rel="noreferrer"
                            />
                          }
                        >
                          <Navigation data-icon="inline-start" />
                          Guidage
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {dismissed.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissed([])}
              >
                Réafficher les {dismissed.length} demande(s) écartée(s)
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={counterRide !== undefined}
        onOpenChange={(next) => !next && setCounterRideId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Contre-proposer un prix</DialogTitle>
            <DialogDescription>
              Prix demandé par le passager :{' '}
              {formatFcfa(counterRide?.estimatedFare)}.
            </DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor="counter-amount">Mon prix (FCFA)</FieldLabel>
            <Input
              id="counter-amount"
              inputMode="numeric"
              className="h-14 text-center text-2xl font-bold"
              value={counterAmount}
              onChange={(event) =>
                setCounterAmount(event.target.value.replace(/\D/g, ''))
              }
            />
            <FieldDescription>
              Un montant sous le prix plancher de la ville ou au-delà du triple
              du prix calculé est refusé.
            </FieldDescription>
          </Field>

          <div className="flex flex-wrap gap-2">
            {[100, 200, 300, 500].map((step) => (
              <Button
                key={step}
                size="sm"
                variant="secondary"
                onClick={() =>
                  setCounterAmount(String((Number(counterAmount) || 0) + step))
                }
              >
                +{step}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {COUNTER_REASONS.map((reason) => (
              <Button
                key={reason}
                size="sm"
                variant={counterReason === reason ? 'default' : 'outline'}
                onClick={() => setCounterReason(reason)}
              >
                {reason}
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button
              className="h-12"
              disabled={offerAction.isLoading || !counterAmount}
              onClick={sendCounter}
            >
              {offerAction.isLoading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <HandCoins data-icon="inline-start" />
              )}
              Envoyer ma contre-offre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
