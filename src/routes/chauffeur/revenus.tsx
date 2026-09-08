/**
 * `/chauffeur/revenus` — Revenus & caisse.
 *
 * Le graphique des recettes et les cumuls viennent de la section existante.
 * S'y ajoutent la transparence sur la commission (lue dans les paramètres de
 * la société, jamais écrite en dur), la ventilation espèces / mobile money, et
 * l'export du journal comptable.
 *
 * L'export est construit ici à partir des seules courses du chauffeur : l'export
 * d'exploitation global est réservé au superviseur, un chauffeur ne doit pas
 * télécharger les données de ses confrères.
 */

import { CircleAlert, Download, HandCoins, Info } from 'lucide-react';
import Papa from 'papaparse';
import { useEntityGetAll } from '@blocksdiy/blocks-client-sdk/reactSdk';
import {
  PaymentsOverviewEntity,
  RidesEntity,
} from '@/product-types';
import { asViewRows, type PaymentOverviewRow } from '@/utils/ViewRows';
import { useCurrentProfiles } from '@/hooks/useCurrentProfiles';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { ProfileSetup } from '@/components/ProfileSetup';
import { RevenueSection } from '@/components/chauffeur/RevenueSection';
import {
  formatFcfa,
  formatNigerDateTime,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';

export default function ChauffeurRevenuePage() {
  const { driver, isLoading } = useCurrentProfiles();
  const { settings } = useCompanySettings();

  const driverId = driver ? numId(driver.id) : undefined;
  const paymentsQuery = useEntityGetAll(
    PaymentsOverviewEntity,
    { driverId },
    { enabled: Boolean(driverId) },
  );
  const ridesQuery = useEntityGetAll(
    RidesEntity,
    { driverId },
    { enabled: Boolean(driverId) },
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!driver) return <ProfileSetup kind="driver" />;

  const payments = asViewRows<PaymentOverviewRow>(paymentsQuery.data).filter(
    (payment) => payment.rideStatus !== 'Simulation terminée',
  );
  const cashTotal = payments
    .filter((payment) => payment.providerKind === 'Espèces')
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
  const mobileByProvider = new Map<string, number>();
  for (const payment of payments) {
    if (payment.providerKind === 'Espèces') continue;
    const name = payment.providerName ?? 'Mobile money';
    mobileByProvider.set(
      name,
      (mobileByProvider.get(name) ?? 0) + (payment.amount ?? 0),
    );
  }
  const mobileTotal = [...mobileByProvider.values()].reduce(
    (sum, value) => sum + value,
    0,
  );

  const exportJournal = () => {
    const rides = (ridesQuery.data ?? []).filter(
      (ride) => !ride.isSimulation && ride.status === 'Terminée',
    );
    if (!rides.length) {
      toast.add({
        title: 'Aucune course à exporter',
        description: 'Votre journal comptable est encore vide.',
      });
      return;
    }
    const csv = Papa.unparse(
      rides.map((ride) => ({
        Référence: ride.reference ?? '',
        'Terminée le': formatNigerDateTime(ride.completedAt),
        Départ: ride.pickupLabel ?? '',
        Arrivée: ride.dropoffLabel ?? '',
        'Distance (km)': ride.distanceKm ?? '',
        'Durée (min)': ride.durationMin ?? '',
        'Montant facturé (FCFA)': ride.finalFare ?? ride.estimatedFare ?? 0,
        'Commission plateforme (FCFA)': ride.platformCommission ?? 0,
        'Net chauffeur (FCFA)': ride.driverPayout ?? 0,
        'État du règlement': ride.paymentStatus ?? '',
      })),
    );
    const url = URL.createObjectURL(
      new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `journal-barewa-${driver.plateNumber ?? 'chauffeur'}-${nigerToday()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.add({
      title: `${rides.length} course(s) exportée(s)`,
      type: 'success',
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <RevenueSection />

      <div className="flex flex-col gap-3 px-3 pb-3 sm:px-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="size-4 text-primary" />
              Commission BAREWA
            </CardTitle>
            <CardDescription>
              {settings?.platformCommissionNotice ??
                'La politique de commission en vigueur n’a pas encore été publiée par l’administration.'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="size-4 text-primary" />
              Règlements reçus
            </CardTitle>
            <CardDescription>
              Ventilation entre espèces et mobile money sur vos courses.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {paymentsQuery.error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Règlements indisponibles</AlertTitle>
                <AlertDescription>
                  Vérifiez votre connexion, puis rouvrez l’onglet.
                </AlertDescription>
              </Alert>
            )}

            {paymentsQuery.isLoading && !payments.length && (
              <Skeleton className="h-20 w-full" />
            )}

            {!paymentsQuery.isLoading && !payments.length && (
              <p className="text-sm text-muted-foreground">
                Aucun règlement enregistré pour l’instant.
              </p>
            )}

            {payments.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-0.5 rounded-lg border p-3">
                    <span className="text-xs text-muted-foreground">
                      Total espèces
                    </span>
                    <span className="amount text-lg font-bold text-primary">
                      {formatFcfa(cashTotal)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 rounded-lg border p-3">
                    <span className="text-xs text-muted-foreground">
                      Total mobile money
                    </span>
                    <span className="amount text-lg font-bold text-primary">
                      {formatFcfa(mobileTotal)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[...mobileByProvider.entries()].map(([name, amount]) => (
                    <Badge key={name} variant="secondary" className="amount">
                      {name} · {formatFcfa(amount)}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="secondary" onClick={exportJournal}>
              <Download data-icon="inline-start" />
              Exporter le journal comptable
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
