/**
 * `/course/carte` — Carte & taxis disponibles.
 *
 * Les chauffeurs en ligne sont lus sur la table DriverProfile (et non sur une
 * vue) pour que le statut « en ligne » et les positions soient à jour à la
 * seconde. Un clic sur une pastille ouvre la fiche du chauffeur, avec son
 * véhicule en 3D et sa photo réelle.
 *
 * Le trafic en direct n'est pas disponible en fond de carte libre : le bouton
 * « Trafic » ouvre la couche trafic de Google Maps sur la ville, qui est le
 * seul trafic réel accessible.
 */

import { useState } from 'react';
import {
  CarTaxiFront,
  CircleAlert,
  Crosshair,
  ExternalLink,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Snowflake,
  Star,
} from 'lucide-react';
import { useEntityGetAll } from '@blocksdiy/blocks-client-sdk/reactSdk';
import type { EntityType } from '@blocksdiy/blocks-client-sdk';
import {
  CitiesEntity,
  DriverProfileEntity,
  VehicleTypesEntity,
} from '@/product-types';
import { useAppContext } from '@/components/AppProvider';
import { useCurrentProfiles } from '@/hooks/useCurrentProfiles';
import { useGeolocation } from '@/hooks/useGeolocation';
import { RideMap, type MapPoint } from '@/components/RideMap';
import {
  DEFAULT_VEHICLE_3D_CONFIG,
  toModelKey,
} from '@/components/widgets/vehicle3d/types';
import { formatPhone, numId, telHref, whatsappHref } from '@/utils/Format';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type Driver = EntityType<typeof DriverProfileEntity>;

export default function CourseMapPage() {
  const { cityId, openVehicle3D, t } = useAppContext();
  const { passenger } = useCurrentProfiles();
  const geo = useGeolocation();

  const [layer, setLayer] = useState<'plan' | 'satellite'>('plan');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const effectiveCityId = cityId ?? passenger?.cityId ?? null;

  const citiesQuery = useEntityGetAll(CitiesEntity);
  const driversQuery = useEntityGetAll(
    DriverProfileEntity,
    { cityId: effectiveCityId ?? undefined, isOnline: true },
    { enabled: effectiveCityId !== null },
  );
  const vehicleTypesQuery = useEntityGetAll(VehicleTypesEntity);

  const city = (citiesQuery.data ?? []).find(
    (item) => numId(item.id) === effectiveCityId,
  );
  const vehicleTypes = vehicleTypesQuery.data ?? [];
  const vehicleTypeOf = (driver: Driver) =>
    vehicleTypes.find((type) => numId(type.id) === driver.vehicleTypeId);

  const drivers = (driversQuery.data ?? []).filter(
    (driver) =>
      driver.verificationStatus === 'Vérifié' &&
      typeof driver.currentLatitude === 'number' &&
      typeof driver.currentLongitude === 'number',
  );

  const fleet: MapPoint[] = drivers.map((driver) => ({
    latitude: driver.currentLatitude as number,
    longitude: driver.currentLongitude as number,
    label: `${driver.fullName ?? 'Chauffeur'} · ${vehicleTypeOf(driver)?.name ?? ''} · ${driver.plateNumber ?? ''}`,
  }));

  const selected = selectedIndex !== null ? drivers[selectedIndex] : undefined;
  const selectedType = selected ? vehicleTypeOf(selected) : undefined;

  const myPosition: MapPoint | null = geo.position
    ? {
        latitude: geo.position.latitude,
        longitude: geo.position.longitude,
        label: t('myPosition'),
      }
    : null;

  const mapsCityUrl = city
    ? `https://www.google.com/maps/@${city.latitude},${city.longitude},14z/data=!5m1!1e1`
    : 'https://www.google.com/maps';

  const mapsRouteUrl = (driver: Driver) =>
    `https://www.google.com/maps/dir/?api=1&destination=${driver.currentLatitude},${driver.currentLongitude}&travelmode=driving`;

  if (!effectiveCityId) {
    return (
      <div className="p-3 sm:p-4">
        <Empty>
          <EmptyMedia variant="icon">
            <MapPin />
          </EmptyMedia>
          <EmptyTitle>{t('chooseCity')}</EmptyTitle>
          <EmptyDescription>
            Choisissez votre ville dans la barre du haut pour voir les taxis et
            tricycles disponibles autour de vous.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          value={[layer]}
          onValueChange={(value) => {
            const next = value[value.length - 1];
            if (next === 'plan' || next === 'satellite') setLayer(next);
          }}
        >
          <ToggleGroupItem value="plan">Plan</ToggleGroupItem>
          <ToggleGroupItem value="satellite">Satellite</ToggleGroupItem>
        </ToggleGroup>
        <Button
          variant="secondary"
          size="sm"
          render={<a href={mapsCityUrl} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink data-icon="inline-start" />
          Trafic
        </Button>
        <Badge variant="secondary" className="amount ms-auto">
          <CarTaxiFront data-icon="inline-start" />
          {drivers.length} disponible{drivers.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {driversQuery.error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Chauffeurs indisponibles</AlertTitle>
          <AlertDescription>{t('errorHint')}</AlertDescription>
        </Alert>
      )}

      {geo.error && (
        <Alert variant="destructive">
          <MapPin />
          <AlertTitle>Localisation indisponible</AlertTitle>
          <AlertDescription>{geo.error}</AlertDescription>
        </Alert>
      )}

      {driversQuery.isLoading && !drivers.length ? (
        <Skeleton className="h-[60vh] w-full" />
      ) : (
        <div className="relative">
          <RideMap
            pickup={myPosition}
            fleet={fleet}
            layer={layer}
            scrollWheelZoom
            onFleetClick={setSelectedIndex}
            fallbackCenter={
              city && typeof city.latitude === 'number'
                ? { latitude: city.latitude, longitude: city.longitude ?? 0 }
                : undefined
            }
            className="h-[60vh] w-full"
          />
          <Button
            size="icon"
            className="absolute end-3 top-3 z-[400] shadow-lg"
            aria-label="Centrer sur ma position"
            disabled={geo.isLoading}
            onClick={() => void geo.request()}
          >
            {geo.isLoading ? <Spinner /> : <Crosshair />}
          </Button>
        </div>
      )}

      {!driversQuery.isLoading && !drivers.length && (
        <Empty>
          <EmptyMedia variant="icon">
            <CarTaxiFront />
          </EmptyMedia>
          <EmptyTitle>{t('noDriverOnline')}</EmptyTitle>
          <EmptyDescription>
            Aucun chauffeur vérifié n’est en ligne à{' '}
            {city?.name ?? 'cette ville'} pour l’instant. Commandez tout de
            même : votre demande partira dès qu’un chauffeur se connecte.
          </EmptyDescription>
        </Empty>
      )}

      <Sheet
        open={selected !== undefined}
        onOpenChange={(next) => !next && setSelectedIndex(null)}
      >
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{selected?.fullName ?? t('driver')}</SheetTitle>
            <SheetDescription>
              {selectedType?.name}
              {selectedType?.localName ? ` · ${selectedType.localName}` : ''}
            </SheetDescription>
          </SheetHeader>

          {selected && (
            <div className="flex flex-col gap-3 px-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="amount">
                  {selected.plateNumber}
                </Badge>
                <Badge variant="secondary" className="amount">
                  <Star data-icon="inline-start" />
                  {(selected.rating ?? 0).toFixed(1)}
                </Badge>
                {selectedType?.hasAirConditioning && (
                  <Badge variant="secondary">
                    <Snowflake data-icon="inline-start" />
                    {t('airConditioned')}
                  </Badge>
                )}
                {selected.vehicleColor && (
                  <Badge variant="outline">{selected.vehicleColor}</Badge>
                )}
              </div>

              {selected.spokenLanguages && (
                <p className="text-xs text-muted-foreground">
                  {t('spokenLanguages')} : {selected.spokenLanguages}
                </p>
              )}

              <Button
                variant="secondary"
                onClick={() =>
                  openVehicle3D({
                    modelKey: toModelKey(selectedType?.modelKey),
                    config: selected.vehicle3DConfig ?? DEFAULT_VEHICLE_3D_CONFIG,
                    vehiclePhotoUrl: selected.vehiclePhotoUrl,
                    vehicleTypeName: selectedType?.name,
                    vehicleLocalName: selectedType?.localName,
                    plateNumber: selected.plateNumber,
                    driverName: selected.fullName,
                    vehicleColor: selected.vehicleColor,
                  })
                }
              >
                <CarTaxiFront data-icon="inline-start" />
                3D & photo réelle
              </Button>
            </div>
          )}

          <SheetFooter>
            {selected?.phoneNumber && (
              <Button render={<a href={telHref(selected.phoneNumber)} />}>
                <Phone data-icon="inline-start" />
                {formatPhone(selected.phoneNumber)}
              </Button>
            )}
            {selected && (selected.whatsappNumber || selected.phoneNumber) && (
              <Button
                variant="secondary"
                render={
                  <a
                    href={whatsappHref(
                      selected.whatsappNumber || selected.phoneNumber,
                      `Bonjour, je vous contacte depuis BAREWA à propos d’une course à ${city?.name ?? ''}.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <MessageCircle data-icon="inline-start" />
                {t('whatsapp')}
              </Button>
            )}
            {selected && (
              <Button
                variant="outline"
                render={
                  <a
                    href={mapsRouteUrl(selected)}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <Navigation data-icon="inline-start" />
                Itinéraire dans Google Maps
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
