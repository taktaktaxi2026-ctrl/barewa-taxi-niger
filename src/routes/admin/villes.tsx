/**
 * `/admin/villes` — référentiel géographique : ouverture et fermeture du
 * service par ville, et gestion des repères et carrefours qui servent de
 * points de départ et d'arrivée.
 */

import { useState } from 'react';
import { CircleAlert, MapPinned, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import type { EntityType } from '@blocksdiy/blocks-client-sdk';
import {
  useEntityCreate,
  useEntityDelete,
  useEntityGetAll,
  useEntityUpdate,
} from '@blocksdiy/blocks-client-sdk/reactSdk';
import {
  CitiesEntity,
  LandmarksEntity,
  type CitiesEntityRegionEnum,
  type LandmarksEntityCategoryEnum,
} from '@/product-types';
import { AdminOnly } from '@/components/admin/AdminOnly';
import { FareGridSection } from '@/components/admin/FareGridSection';
import { numId } from '@/utils/Format';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';

type City = EntityType<typeof CitiesEntity>;

const REGIONS: CitiesEntityRegionEnum[] = [
  'Niamey',
  'Maradi',
  'Zinder',
  'Tahoua',
  'Agadez',
  'Dosso',
  'Diffa',
  'Tillabéri',
];

const CATEGORIES: LandmarksEntityCategoryEnum[] = [
  'Carrefour',
  'Monument',
  'Marché',
  'Mosquée',
  'Hôpital',
  'Aéroport',
  'Gare routière',
  'Université',
  'Administration',
  'Hôtel',
  'Stade',
  'Quartier',
  'Débarcadère',
];

export default function AdminCitiesPage() {
  return (
    <AdminOnly>
      <div className="flex flex-col gap-4">
        <AdminCities />
        {/* Prix planchers et grille tarifaire par ville et type de véhicule. */}
        <FareGridSection />
      </div>
    </AdminOnly>
  );
}

function AdminCities() {
  const citiesQuery = useEntityGetAll(CitiesEntity);
  const landmarksQuery = useEntityGetAll(LandmarksEntity);
  const cityUpdate = useEntityUpdate(CitiesEntity);
  const cityCreate = useEntityCreate(CitiesEntity);
  const landmarkCreate = useEntityCreate(LandmarksEntity);
  const landmarkUpdate = useEntityUpdate(LandmarksEntity);
  const landmarkDelete = useEntityDelete(LandmarksEntity);

  const [cityDialog, setCityDialog] = useState<City | 'new' | null>(null);
  const [landmarkDialog, setLandmarkDialog] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string>('');

  const cities = (citiesQuery.data ?? []).sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? ''),
  );
  const landmarks = landmarksQuery.data ?? [];
  const activeCityId = selectedCityId || (cities[0]?.id ?? '');
  const cityLandmarks = landmarks
    .filter((landmark) => landmark.cityId === numId(activeCityId))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

  const cityItems = cities.map((city) => ({
    label: `${city.name} · ${city.region}`,
    value: city.id,
  }));

  const toggleCity = async (city: City, isActive: boolean) => {
    try {
      await cityUpdate.updateFunction({ id: city.id, data: { isActive } });
      toast.add({
        title: isActive
          ? `Service ouvert à ${city.name}`
          : `Service fermé à ${city.name}`,
        type: 'success',
      });
    } catch {
      toast.add({ title: 'Changement impossible', type: 'error' });
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <Tabs defaultValue="villes">
        <TabsList>
          <TabsTrigger value="villes">Villes</TabsTrigger>
          <TabsTrigger value="reperes">Repères et carrefours</TabsTrigger>
        </TabsList>

        <TabsContent value="villes" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {cities.length} ville{cities.length > 1 ? 's' : ''} au
              référentiel
            </p>
            <Button onClick={() => setCityDialog('new')}>
              <Plus data-icon="inline-start" />
              Ajouter une ville
            </Button>
          </div>

          {citiesQuery.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Villes indisponibles</AlertTitle>
              <AlertDescription>
                Vérifiez la connexion, puis rouvrez la page.
              </AlertDescription>
            </Alert>
          )}

          {citiesQuery.isLoading && !cities.length && (
            <Skeleton className="h-32 w-full" />
          )}

          {cities.map((city) => (
            <Card key={city.id} size="sm">
              <CardContent className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {city.name}{' '}
                    <span className="text-muted-foreground">
                      · {city.region}
                    </span>
                  </p>
                  <p className="amount truncate text-xs text-muted-foreground">
                    {Number(city.latitude).toFixed(4)},{' '}
                    {Number(city.longitude).toFixed(4)} · rayon{' '}
                    {city.serviceRadiusKm ?? 0} km ·{' '}
                    {
                      landmarks.filter(
                        (landmark) => landmark.cityId === numId(city.id),
                      ).length
                    }{' '}
                    repères
                  </p>
                  {city.notes && (
                    <p className="truncate text-xs text-muted-foreground">
                      {city.notes}
                    </p>
                  )}
                </div>
                <Badge variant={city.isActive ? 'default' : 'outline'}>
                  {city.isActive ? 'Ouverte' : 'Fermée'}
                </Badge>
                <Switch
                  checked={Boolean(city.isActive)}
                  disabled={cityUpdate.isLoading}
                  aria-label={`Service à ${city.name}`}
                  onCheckedChange={(checked) =>
                    toggleCity(city, checked === true)
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Modifier ${city.name}`}
                  onClick={() => setCityDialog(city)}
                >
                  <Pencil />
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reperes" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={cityItems}
              value={activeCityId || null}
              onValueChange={(value) => setSelectedCityId(String(value ?? ''))}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name} · {city.region}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <span className="flex-1" />
            <Button
              onClick={() => setLandmarkDialog(true)}
              disabled={!activeCityId}
            >
              <Plus data-icon="inline-start" />
              Ajouter un repère
            </Button>
          </div>

          {landmarksQuery.isLoading && !landmarks.length && (
            <Skeleton className="h-32 w-full" />
          )}

          {!landmarksQuery.isLoading && !cityLandmarks.length && (
            <Empty>
              <EmptyMedia variant="icon">
                <MapPinned />
              </EmptyMedia>
              <EmptyTitle>Aucun repère dans cette ville</EmptyTitle>
              <EmptyDescription>
                Sans repère, les passagers ne peuvent pas choisir de point de
                départ dans cette ville.
              </EmptyDescription>
            </Empty>
          )}

          <div className="grid gap-2 md:grid-cols-2">
            {cityLandmarks.map((landmark) => (
              <Card key={landmark.id} size="sm">
                <CardContent className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {landmark.name}
                      {landmark.localName && (
                        <span className="text-muted-foreground">
                          {' · '}
                          {landmark.localName}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[landmark.category, landmark.district]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="amount truncate text-xs text-muted-foreground">
                      {Number(landmark.latitude).toFixed(5)},{' '}
                      {Number(landmark.longitude).toFixed(5)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Mettre en avant"
                    disabled={landmarkUpdate.isLoading}
                    onClick={() =>
                      landmarkUpdate.updateFunction({
                        id: landmark.id,
                        data: { isPopular: !landmark.isPopular },
                      })
                    }
                  >
                    <Star
                      className={
                        landmark.isPopular
                          ? 'fill-primary text-primary'
                          : 'text-muted-foreground'
                      }
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Supprimer le repère"
                    onClick={async () => {
                      try {
                        await landmarkDelete.deleteFunction({
                          id: landmark.id,
                        });
                        toast.add({ title: 'Repère supprimé', type: 'success' });
                      } catch {
                        toast.add({
                          title: 'Suppression impossible',
                          type: 'error',
                        });
                      }
                    }}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {cityDialog && (
        <CityDialog
          city={cityDialog === 'new' ? null : cityDialog}
          onClose={() => setCityDialog(null)}
          onSave={async (data) => {
            if (cityDialog === 'new') {
              await cityCreate.createFunction({ data });
            } else {
              await cityUpdate.updateFunction({ id: cityDialog.id, data });
            }
          }}
          isSaving={cityCreate.isLoading || cityUpdate.isLoading}
        />
      )}

      {landmarkDialog && (
        <LandmarkDialog
          onClose={() => setLandmarkDialog(false)}
          isSaving={landmarkCreate.isLoading}
          onSave={async (data) => {
            await landmarkCreate.createFunction({
              data: { ...data, cityId: numId(activeCityId) },
            });
          }}
        />
      )}
    </div>
  );
}

function CityDialog({
  city,
  onClose,
  onSave,
  isSaving,
}: {
  city: City | null;
  onClose: () => void;
  onSave: (data: (typeof CitiesEntity)['instanceType']) => Promise<void>;
  isSaving: boolean;
}) {
  const [name, setName] = useState(city?.name ?? '');
  const [region, setRegion] = useState<CitiesEntityRegionEnum>(
    city?.region ?? 'Niamey',
  );
  const [latitude, setLatitude] = useState(String(city?.latitude ?? ''));
  const [longitude, setLongitude] = useState(String(city?.longitude ?? ''));
  const [radius, setRadius] = useState(String(city?.serviceRadiusKm ?? '15'));
  const [notes, setNotes] = useState(city?.notes ?? '');

  const lat = Number(latitude.replace(',', '.'));
  const lng = Number(longitude.replace(',', '.'));
  const isValid =
    name.trim().length > 1 && Number.isFinite(lat) && Number.isFinite(lng);

  const submit = async () => {
    if (!isValid) return;
    try {
      await onSave({
        name: name.trim(),
        region,
        latitude: lat,
        longitude: lng,
        serviceRadiusKm: Number(radius.replace(',', '.')) || 15,
        notes: notes.trim() || undefined,
        isActive: city?.isActive ?? true,
      });
      toast.add({ title: 'Ville enregistrée', type: 'success' });
      onClose();
    } catch {
      toast.add({
        title: 'Enregistrement impossible',
        description: 'Vérifiez la connexion, puis réessayez.',
        type: 'error',
      });
    }
  };

  const regionItems = REGIONS.map((item) => ({ label: item, value: item }));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {city ? `Modifier ${city.name}` : 'Ajouter une ville'}
          </DialogTitle>
          <DialogDescription>
            Les coordonnées du centre-ville servent à centrer la carte et à
            calculer les distances.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="city-name">Nom de la ville</FieldLabel>
            <Input
              id="city-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Région</FieldLabel>
            <Select
              items={regionItems}
              value={region}
              onValueChange={(value) =>
                setRegion(String(value) as CitiesEntityRegionEnum)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {REGIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="city-lat">Latitude</FieldLabel>
              <Input
                id="city-lat"
                inputMode="decimal"
                className="amount"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="city-lng">Longitude</FieldLabel>
              <Input
                id="city-lng"
                inputMode="decimal"
                className="amount"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="city-radius">
              Rayon de couverture (km)
            </FieldLabel>
            <Input
              id="city-radius"
              inputMode="decimal"
              className="amount"
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="city-notes">
              Particularités de mobilité
            </FieldLabel>
            <Textarea
              id="city-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button disabled={!isValid || isSaving} onClick={submit}>
            {isSaving && <Spinner data-icon="inline-start" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LandmarkDialog({
  onClose,
  onSave,
  isSaving,
}: {
  onClose: () => void;
  onSave: (data: (typeof LandmarksEntity)['instanceType']) => Promise<void>;
  isSaving: boolean;
}) {
  const [name, setName] = useState('');
  const [localName, setLocalName] = useState('');
  const [category, setCategory] =
    useState<LandmarksEntityCategoryEnum>('Carrefour');
  const [district, setDistrict] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');

  const lat = Number(latitude.replace(',', '.'));
  const lng = Number(longitude.replace(',', '.'));
  const isValid =
    name.trim().length > 1 && Number.isFinite(lat) && Number.isFinite(lng);

  const categoryItems = CATEGORIES.map((item) => ({
    label: item,
    value: item,
  }));

  const submit = async () => {
    if (!isValid) return;
    try {
      await onSave({
        name: name.trim(),
        localName: localName.trim() || undefined,
        category,
        district: district.trim() || undefined,
        latitude: lat,
        longitude: lng,
        description: description.trim() || undefined,
        isPopular: false,
      });
      toast.add({ title: 'Repère ajouté', type: 'success' });
      onClose();
    } catch {
      toast.add({
        title: 'Enregistrement impossible',
        description: 'Vérifiez la connexion, puis réessayez.',
        type: 'error',
      });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un repère</DialogTitle>
          <DialogDescription>
            Le nom local haoussa ou zarma aide les passagers à retrouver le
            lieu tel qu’on l’appelle dans la rue.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="lm-name">Nom officiel</FieldLabel>
            <Input
              id="lm-name"
              value={name}
              placeholder="Ex. Rond-point Maourey"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="lm-local">Nom local</FieldLabel>
            <Input
              id="lm-local"
              value={localName}
              placeholder="Nom courant en haoussa ou zarma"
              onChange={(event) => setLocalName(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Catégorie</FieldLabel>
            <Select
              items={categoryItems}
              value={category}
              onValueChange={(value) =>
                setCategory(String(value) as LandmarksEntityCategoryEnum)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="lm-district">Quartier</FieldLabel>
            <Input
              id="lm-district"
              value={district}
              placeholder="Ex. Plateau, Yantala, Wadata"
              onChange={(event) => setDistrict(event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="lm-lat">Latitude</FieldLabel>
              <Input
                id="lm-lat"
                inputMode="decimal"
                className="amount"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="lm-lng">Longitude</FieldLabel>
              <Input
                id="lm-lng"
                inputMode="decimal"
                className="amount"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="lm-desc">
              Précision utile au chauffeur
            </FieldLabel>
            <Textarea
              id="lm-desc"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button disabled={!isValid || isSaving} onClick={submit}>
            {isSaving && <Spinner data-icon="inline-start" />}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}