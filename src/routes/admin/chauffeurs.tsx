/**
 * `/admin/chauffeurs` — annuaire et carte des chauffeurs, fiche détaillée et
 * changement du statut de vérification.
 *
 * Le statut et la position sont lus sur la table DriverProfile (live) pour que
 * les changements apparaissent immédiatement ; la vue DriversOverview ne
 * fournit que les libellés joints (ville, type de véhicule, modèle 3D).
 */

import { useState } from 'react';
import { Box, CircleAlert, Search, Users } from 'lucide-react';
import type { EntityType } from '@blocksdiy/blocks-client-sdk';
import {
  useEntityGetAll,
  useEntityUpdate,
} from '@blocksdiy/blocks-client-sdk/reactSdk';
import {
  DriverProfileEntity,
  DriversOverviewEntity,
  type DriverProfileEntityVerificationStatusEnum,
} from '@/product-types';
import { asViewRows, type DriverOverviewRow } from '@/utils/ViewRows';
import { AdminOnly } from '@/components/admin/AdminOnly';
import { DriverDocumentsSection } from '@/components/admin/DriverDocumentsSection';
import { useAppContext } from '@/components/AppProvider';
import { RideMap } from '@/components/RideMap';
import {
  formatFcfa,
  formatNigerDateTime,
  formatPhone,
  initialsOf,
} from '@/utils/Format';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toast';

type Driver = EntityType<typeof DriverProfileEntity>;

const STATUSES: DriverProfileEntityVerificationStatusEnum[] = [
  'En attente',
  'Documents à fournir',
  'Vérifié',
  'Suspendu',
  'Rejeté',
];

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  Vérifié: 'default',
  'En attente': 'outline',
  'Documents à fournir': 'secondary',
  Suspendu: 'destructive',
  Rejeté: 'destructive',
};

export default function AdminDriversPage() {
  return (
    <AdminOnly>
      <div className="flex flex-col gap-4">
        <AdminDrivers />
        {/* Inspection des pièces justificatives des chauffeurs. */}
        <DriverDocumentsSection />
      </div>
    </AdminOnly>
  );
}

function AdminDrivers() {
  const { openVehicle3D } = useAppContext();
  const driversQuery = useEntityGetAll(DriverProfileEntity);
  const overviewQuery = useEntityGetAll(DriversOverviewEntity);
  const driverUpdate = useEntityUpdate(DriverProfileEntity);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Tous');
  const [selected, setSelected] = useState<Driver | null>(null);

  const drivers = driversQuery.data ?? [];
  const overview = asViewRows<DriverOverviewRow>(overviewQuery.data);
  const labelsById = new Map(
    overview.map((row) => [String(row.driverId ?? row.id), row]),
  );

  const needle = query.trim().toLowerCase();
  const filtered = drivers.filter((driver) => {
    const labels = labelsById.get(driver.id);
    const matchesQuery =
      !needle ||
      [
        driver.fullName,
        driver.plateNumber,
        driver.phoneNumber,
        labels?.cityName,
        labels?.vehicleTypeName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    const matchesStatus =
      statusFilter === 'Tous' || driver.verificationStatus === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const fleet = filtered
    .filter(
      (driver) =>
        Number.isFinite(driver.currentLatitude) &&
        Number.isFinite(driver.currentLongitude),
    )
    .map((driver) => ({
      latitude: driver.currentLatitude as number,
      longitude: driver.currentLongitude as number,
      label: `${driver.fullName} · ${driver.plateNumber}`,
    }));

  const statusItems = [
    { label: 'Tous les statuts', value: 'Tous' },
    ...STATUSES.map((status) => ({ label: status, value: status })),
  ];

  const changeStatus = async (
    driver: Driver,
    status: DriverProfileEntityVerificationStatusEnum,
  ) => {
    try {
      await driverUpdate.updateFunction({
        id: driver.id,
        data: {
          verificationStatus: status,
          // Un chauffeur qui n'est plus vérifié ne doit plus recevoir de course.
          ...(status === 'Vérifié' ? {} : { isOnline: false }),
        },
      });
      toast.add({
        title: `${driver.fullName} — ${status}`,
        type: 'success',
      });
    } catch {
      toast.add({
        title: 'Changement de statut impossible',
        description: 'Vérifiez la connexion, puis réessayez.',
        type: 'error',
      });
    }
  };

  const selectedLabels = selected ? labelsById.get(selected.id) : undefined;

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="max-w-sm flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            placeholder="Nom, immatriculation, ville…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
        <Select
          items={statusItems}
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(String(value))}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="Tous">Tous les statuts</SelectItem>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {driversQuery.error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Chauffeurs indisponibles</AlertTitle>
          <AlertDescription>
            Vérifiez la connexion, puis rouvrez la page.
          </AlertDescription>
        </Alert>
      )}

      {fleet.length > 0 && <RideMap fleet={fleet} className="h-64" />}

      {driversQuery.isLoading && !drivers.length && (
        <div className="grid gap-2 md:grid-cols-2">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-24 w-full" />
          ))}
        </div>
      )}

      {!driversQuery.isLoading && !filtered.length && (
        <Empty>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>Aucun chauffeur</EmptyTitle>
          <EmptyDescription>
            {drivers.length
              ? 'Aucun chauffeur ne correspond à cette recherche.'
              : 'Les chauffeurs apparaîtront ici dès leur inscription.'}
          </EmptyDescription>
        </Empty>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        {filtered.map((driver) => {
          const labels = labelsById.get(driver.id);
          return (
            <Card key={driver.id} size="sm">
              <CardContent className="flex items-start gap-3">
                <Avatar>
                  {driver.profilePhotoUrl && (
                    <AvatarImage src={driver.profilePhotoUrl} />
                  )}
                  <AvatarFallback>{initialsOf(driver.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{driver.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      labels?.cityName,
                      labels?.vehicleTypeName,
                      driver.plateNumber,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={
                        STATUS_VARIANT[driver.verificationStatus ?? ''] ??
                        'outline'
                      }
                    >
                      {driver.verificationStatus}
                    </Badge>
                    {driver.isOnline && (
                      <Badge variant="secondary">En ligne</Badge>
                    )}
                    <span className="amount text-xs text-muted-foreground">
                      ★ {(driver.rating ?? 0).toFixed(1)} ·{' '}
                      {driver.totalRides ?? 0} courses
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(driver)}
                >
                  Fiche
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.fullName}</SheetTitle>
                <SheetDescription>
                  {[
                    selectedLabels?.cityName,
                    selectedLabels?.vehicleTypeName,
                    selected.plateNumber,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </SheetDescription>
              </SheetHeader>

              <Card size="sm">
                <CardHeader>
                  <CardTitle className="text-sm">
                    Statut de vérification
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {STATUSES.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={
                        selected.verificationStatus === status
                          ? 'default'
                          : 'outline'
                      }
                      disabled={driverUpdate.isLoading}
                      onClick={() => changeStatus(selected, status)}
                    >
                      {status}
                    </Button>
                  ))}
                </CardContent>
              </Card>

              <div className="flex flex-col gap-2 text-sm">
                <Row label="Téléphone" value={formatPhone(selected.phoneNumber)} />
                <Row label="Email" value={selected.email ?? '—'} />
                <Row
                  label="Langues parlées"
                  value={selected.spokenLanguages ?? '—'}
                />
                <Row
                  label="Moyens de paiement"
                  value={selected.acceptedPaymentMethods ?? '—'}
                />
                <Row
                  label="Mobile money"
                  value={formatPhone(selected.mobileMoneyNumber)}
                />
                <Separator />
                <Row
                  label="Gains cumulés"
                  value={formatFcfa(selected.totalEarnings)}
                />
                <Row
                  label="Courses"
                  value={String(selected.totalRides ?? 0)}
                />
                <Row
                  label="Note"
                  value={(selected.rating ?? 0).toFixed(1)}
                />
                <Row
                  label="Dernière position"
                  value={formatNigerDateTime(selected.lastSeenAt)}
                />
              </div>

              {selected.bio && (
                <p className="text-sm text-muted-foreground">{selected.bio}</p>
              )}

              <Button
                variant="secondary"
                onClick={() =>
                  openVehicle3D({
                    modelKey: selectedLabels?.vehicleModelKey,
                    config: selected.vehicle3DConfig,
                    vehiclePhotoUrl: selected.vehiclePhotoUrl,
                    vehicleTypeName: selectedLabels?.vehicleTypeName,
                    vehicleLocalName: selectedLabels?.vehicleLocalName,
                    plateNumber: selected.plateNumber,
                    driverName: selected.fullName,
                    vehicleColor: selected.vehicleColor,
                  })
                }
              >
                <Box data-icon="inline-start" />
                Inspecter le véhicule en 3D
              </Button>

              {Number.isFinite(selected.currentLatitude) &&
                Number.isFinite(selected.currentLongitude) && (
                  <RideMap
                    fleet={[
                      {
                        latitude: selected.currentLatitude as number,
                        longitude: selected.currentLongitude as number,
                        label: selected.fullName ?? 'Chauffeur',
                      },
                    ]}
                    fallbackCenter={{
                      latitude: selected.currentLatitude as number,
                      longitude: selected.currentLongitude as number,
                    }}
                    className="h-48"
                  />
                )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="amount text-end font-medium">{value}</span>
    </div>
  );
}