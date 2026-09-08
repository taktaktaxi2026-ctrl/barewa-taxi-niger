/**
 * `/course/en-cours` — la course du moment : statut, négociation du prix,
 * fiche du chauffeur, inspection 3D du véhicule, paiement et reçu officiel.
 *
 * La course est lue sur la table Rides (jamais sur la vue) pour suivre le
 * statut à la seconde. Les courses de simulation sont écartées de cet onglet.
 */

import { CircleAlert, Navigation, ReceiptText } from 'lucide-react';
import { Link } from 'react-router';
import { useEntityGetAll } from '@blocksdiy/blocks-client-sdk/reactSdk';
import { RidesEntity } from '@/product-types';
import { useCurrentProfiles } from '@/hooks/useCurrentProfiles';
import { useAppContext } from '@/components/AppProvider';
import { numId } from '@/utils/Format';
import { OPEN_RIDE_STATUSES } from '@/utils/Translations';
import { ProfileSetup } from '@/components/ProfileSetup';
import { ActiveRide } from '@/components/course/ActiveRide';
import { NegotiationPanel } from '@/components/course/NegotiationPanel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

const NEGOTIABLE_STATUSES = ['Recherche', 'Acceptée'];

export default function CourseCurrentPage() {
  const { t, openReceipt } = useAppContext();
  const { passenger, isLoading, error } = useCurrentProfiles();

  const ridesQuery = useEntityGetAll(
    RidesEntity,
    { passengerId: passenger ? numId(passenger.id) : undefined },
    { enabled: Boolean(passenger?.id) },
  );

  if (isLoading || (ridesQuery.isLoading && !ridesQuery.data?.length)) {
    return (
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (error || ridesQuery.error) {
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

  if (!passenger) return <ProfileSetup kind="passenger" />;

  const rides = (ridesQuery.data ?? []).filter((ride) => !ride.isSimulation);

  // Une course « en attente d'action » : en cours, ou terminée mais pas encore
  // réglée ou pas encore notée.
  const currentRide = [...rides]
    .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''))
    .find((ride) => {
      if ((OPEN_RIDE_STATUSES as readonly string[]).includes(ride.status ?? ''))
        return true;
      if (ride.status !== 'Terminée') return false;
      return ride.paymentStatus !== 'Payé' || !ride.ratingByPassenger;
    });

  if (!currentRide) {
    return (
      <div className="p-3 sm:p-4">
        <Empty>
          <EmptyMedia variant="icon">
            <Navigation />
          </EmptyMedia>
          <EmptyTitle>Aucune course en cours</EmptyTitle>
          <EmptyDescription>
            Dès que vous commandez, cet onglet suit votre course : approche du
            chauffeur, prix négocié, paiement et reçu.
          </EmptyDescription>
          <EmptyContent>
            <Button render={<Link to="/course" />}>Commander une course</Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const showNegotiation = NEGOTIABLE_STATUSES.includes(
    currentRide.status ?? '',
  );
  const isSettled =
    currentRide.status === 'Terminée' && currentRide.paymentStatus === 'Payé';

  return (
    <div className="flex flex-col gap-3">
      {showNegotiation && (
        <div className="px-3 pt-3 sm:px-4">
          <NegotiationPanel
            ride={currentRide as typeof currentRide & { id: string }}
            side="Passager"
          />
        </div>
      )}

      <ActiveRide ride={currentRide} />

      {isSettled && (
        <div className="px-3 pb-3 sm:px-4">
          <Button
            className="h-12 w-full"
            variant="secondary"
            onClick={() => openReceipt(numId(currentRide.id))}
          >
            <ReceiptText data-icon="inline-start" />
            {currentRide.receiptUrl
              ? 'Voir le reçu officiel BAREWA'
              : 'Télécharger le reçu officiel BAREWA'}
          </Button>
        </div>
      )}
    </div>
  );
}
