/**
 * `/chauffeur/abonnes` — Abonnés & trajets réguliers.
 *
 * La clientèle fidélisée est lue et écrite sur la table Subscribers pour que
 * l'ajout et la notification se voient immédiatement. « Notifier mon départ »
 * appelle NotifySubscribersDeparture, qui envoie les SMS et renvoie pour chaque
 * abonné un lien WhatsApp prêt à ouvrir si le chauffeur préfère écrire.
 */

import { useState } from 'react';
import {
  CircleAlert,
  Clock,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Users,
} from 'lucide-react';
import {
  useEntityCreate,
  useEntityGetAll,
  useEntityUpdate,
  useExecuteAction,
} from '@blocksdiy/blocks-client-sdk/reactSdk';
import type { EntityType } from '@blocksdiy/blocks-client-sdk';
import {
  NotifySubscribersDepartureAction,
  SubscribersEntity,
  type INotifySubscribersDepartureActionOutput,
  type SubscribersEntityTripKindEnum,
} from '@/product-types';
import { useCurrentProfiles } from '@/hooks/useCurrentProfiles';
import { ProfileSetup } from '@/components/ProfileSetup';
import {
  formatFcfa,
  formatNigerDateTime,
  numId,
  telHref,
  whatsappHref,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';

type Subscriber = EntityType<typeof SubscribersEntity> & { id: string };

const DAYS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const;

const TRIP_KINDS: SubscribersEntityTripKindEnum[] = [
  'Domicile - Bureau',
  'Navette scolaire',
  'Marché',
  'Lieu de culte',
  'Autre',
];

/** Jour de la semaine courant, en heure du Niger. */
function nigerDayName(): string {
  const label = new Date().toLocaleDateString('fr-FR', {
    timeZone: 'Africa/Niamey',
    weekday: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function ChauffeurSubscribersPage() {
  const { driver, isLoading } = useCurrentProfiles();
  const notifyAction = useExecuteAction(NotifySubscribersDepartureAction);
  const update = useEntityUpdate(SubscribersEntity);

  const [departureTime, setDepartureTime] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [todayOnly, setTodayOnly] = useState(true);
  const [notifyResult, setNotifyResult] =
    useState<INotifySubscribersDepartureActionOutput | null>(null);

  const driverId = driver ? numId(driver.id) : undefined;
  const subscribersQuery = useEntityGetAll(
    SubscribersEntity,
    { driverId },
    { enabled: Boolean(driverId) },
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!driver) return <ProfileSetup kind="driver" />;

  const subscribers = [...((subscribersQuery.data ?? []) as Subscriber[])].sort(
    (a, b) => (a.pickupTime ?? '').localeCompare(b.pickupTime ?? ''),
  );
  const activeCount = subscribers.filter(
    (subscriber) => subscriber.isActive,
  ).length;

  const notify = async () => {
    if (departureTime && !/^\d{2}:\d{2}$/.test(departureTime)) {
      toast.add({
        title: 'Heure invalide',
        description: 'Indiquez l’heure au format HH:MM.',
        type: 'error',
      });
      return;
    }
    try {
      const result = await notifyAction.executeFunction({
        driverId: numId(driver.id),
        dayOfWeek: todayOnly ? nigerDayName() : undefined,
        departureTime: departureTime || undefined,
        customMessage: customMessage.trim() || undefined,
      });
      setNotifyResult(result);
      toast.add({
        title: result.success
          ? `${result.notifiedCount ?? 0} abonné(s) prévenu(s)`
          : 'Notification refusée',
        description: result.message,
        type: result.success ? 'success' : 'error',
      });
    } catch {
      toast.add({
        title: 'Notification impossible',
        description: 'Vérifiez votre connexion, puis réessayez.',
        type: 'error',
      });
    }
  };

  const toggleActive = async (subscriber: Subscriber, next: boolean) => {
    try {
      await update.updateFunction({
        id: subscriber.id,
        data: { isActive: next },
      });
    } catch {
      toast.add({ title: 'Modification non enregistrée', type: 'error' });
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" />
            Notifier mon départ
          </CardTitle>
          <CardDescription>
            Un SMS partira à chacun de vos abonnés actifs, avec l’heure de
            passage et le point de ramassage.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <span className="min-w-0 flex-1 text-sm">
              Ne prévenir que les abonnés du {nigerDayName().toLowerCase()}
            </span>
            <Switch
              checked={todayOnly}
              onCheckedChange={(checked) => setTodayOnly(checked === true)}
              aria-label="Limiter aux abonnés du jour"
            />
          </div>

          <Field>
            <FieldLabel htmlFor="departure-time">
              Heure de passage annoncée
            </FieldLabel>
            <Input
              id="departure-time"
              type="time"
              value={departureTime}
              onChange={(event) => setDepartureTime(event.target.value)}
            />
          </Field>

          <Textarea
            placeholder="Message libre (retard, changement d’itinéraire…)"
            value={customMessage}
            onChange={(event) => setCustomMessage(event.target.value)}
          />

          {notifyResult?.subscribers?.length ? (
            <div className="flex flex-col gap-1.5 rounded-lg border p-3">
              <p className="text-sm font-semibold">Résultat de l’envoi</p>
              {notifyResult.subscribers.map((entry) => (
                <div
                  key={entry.subscriberId}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {entry.contactName}
                  </span>
                  <Badge
                    variant={entry.smsDelivered ? 'secondary' : 'destructive'}
                  >
                    {entry.smsDelivered
                      ? 'SMS envoyé'
                      : (entry.failureReason ?? 'SMS non parti')}
                  </Badge>
                  {entry.whatsappUrl && (
                    <Button
                      size="sm"
                      variant="secondary"
                      render={
                        <a
                          href={entry.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <MessageCircle data-icon="inline-start" />
                      WhatsApp
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2 sm:flex-row">
          <Button
            className="h-12"
            disabled={notifyAction.isLoading || !activeCount}
            onClick={notify}
          >
            {notifyAction.isLoading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            Notifier mon départ sur WhatsApp et SMS
          </Button>
          <SubscriberDialog driverId={numId(driver.id)} cityId={driver.cityId} />
        </CardFooter>
      </Card>

      {subscribersQuery.error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Abonnés indisponibles</AlertTitle>
          <AlertDescription>
            Vérifiez votre connexion, puis rouvrez l’onglet.
          </AlertDescription>
        </Alert>
      )}

      {subscribersQuery.isLoading && !subscribers.length && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-24 w-full" />
          ))}
        </div>
      )}

      {!subscribersQuery.isLoading && !subscribers.length && (
        <Empty>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>Aucun abonné pour l’instant</EmptyTitle>
          <EmptyDescription>
            Ajoutez les passagers que vous transportez chaque jour : vous les
            prévenez ensuite de votre départ en une seule fois.
          </EmptyDescription>
        </Empty>
      )}

      {subscribers.map((subscriber) => (
        <Card key={subscriber.id} size="sm">
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {subscriber.contactName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {subscriber.pickupLabel} → {subscriber.dropoffLabel}
                </p>
              </div>
              <Switch
                checked={Boolean(subscriber.isActive)}
                disabled={update.isLoading}
                onCheckedChange={(checked) =>
                  toggleActive(subscriber, checked === true)
                }
                aria-label="Abonnement actif"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {subscriber.tripKind && (
                <Badge variant="outline">{subscriber.tripKind}</Badge>
              )}
              {subscriber.pickupTime && (
                <Badge variant="secondary" className="amount">
                  <Clock data-icon="inline-start" />
                  {subscriber.pickupTime}
                </Badge>
              )}
              {subscriber.agreedFare ? (
                <Badge variant="secondary" className="amount">
                  {formatFcfa(subscriber.agreedFare)}
                </Badge>
              ) : null}
              {subscriber.activeDays && <span>{subscriber.activeDays}</span>}
            </div>

            {subscriber.notes && (
              <p className="text-xs text-muted-foreground">
                {subscriber.notes}
              </p>
            )}

            {subscriber.lastNotifiedAt && (
              <p className="text-[11px] text-muted-foreground">
                Dernière notification : {formatNigerDateTime(subscriber.lastNotifiedAt)}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {subscriber.phoneNumber && (
                <Button
                  size="sm"
                  variant="secondary"
                  render={<a href={telHref(subscriber.phoneNumber)} />}
                >
                  <Phone data-icon="inline-start" />
                  Appeler
                </Button>
              )}
              {(subscriber.whatsappNumber || subscriber.phoneNumber) && (
                <Button
                  size="sm"
                  variant="secondary"
                  render={
                    <a
                      href={whatsappHref(
                        subscriber.whatsappNumber || subscriber.phoneNumber,
                        `Bonjour ${subscriber.contactName ?? ''}, je prends la route pour ${subscriber.pickupLabel ?? 'votre point de ramassage'}.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <MessageCircle data-icon="inline-start" />
                  WhatsApp
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SubscriberDialog({
  driverId,
  cityId,
}: {
  driverId: number;
  cityId?: number;
}) {
  const [open, setOpen] = useState(false);
  const create = useEntityCreate(SubscribersEntity);

  const [contactName, setContactName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pickupLabel, setPickupLabel] = useState('');
  const [dropoffLabel, setDropoffLabel] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [agreedFare, setAgreedFare] = useState('');
  const [tripKind, setTripKind] =
    useState<SubscribersEntityTripKindEnum>('Domicile - Bureau');
  const [days, setDays] = useState<string[]>([
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
  ]);

  const tripKindItems = TRIP_KINDS.map((item) => ({
    label: item,
    value: item,
  }));

  const ready =
    contactName.trim().length > 1 &&
    phoneNumber.trim().length > 5 &&
    pickupLabel.trim().length > 1 &&
    dropoffLabel.trim().length > 1;

  const submit = async () => {
    try {
      await create.createFunction({
        data: {
          driverId,
          cityId,
          contactName: contactName.trim(),
          phoneNumber: phoneNumber.replace(/\s/g, ''),
          pickupLabel: pickupLabel.trim(),
          dropoffLabel: dropoffLabel.trim(),
          pickupTime: pickupTime || undefined,
          agreedFare: agreedFare ? Number(agreedFare) : undefined,
          tripKind,
          activeDays: days.join(', '),
          isActive: true,
        },
      });
      setOpen(false);
      setContactName('');
      setPhoneNumber('');
      setPickupLabel('');
      setDropoffLabel('');
      setPickupTime('');
      setAgreedFare('');
      toast.add({ title: 'Abonné ajouté', type: 'success' });
    } catch {
      toast.add({
        title: 'Abonné non enregistré',
        description: 'Vérifiez votre connexion, puis réessayez.',
        type: 'error',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" />}>
        <Plus data-icon="inline-start" />
        Ajouter un abonné
      </DialogTrigger>
      <DialogContent className="max-h-[88svh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvel abonné</DialogTitle>
          <DialogDescription>
            Un trajet régulier convenu de gré à gré avec votre passager.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="sub-name">Nom de l’abonné</FieldLabel>
            <Input
              id="sub-name"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sub-phone">Téléphone</FieldLabel>
            <Input
              id="sub-phone"
              inputMode="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sub-pickup">Point de ramassage</FieldLabel>
            <Input
              id="sub-pickup"
              value={pickupLabel}
              onChange={(event) => setPickupLabel(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sub-dropoff">Destination</FieldLabel>
            <Input
              id="sub-dropoff"
              value={dropoffLabel}
              onChange={(event) => setDropoffLabel(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sub-kind">Nature du trajet</FieldLabel>
            <Select
              items={tripKindItems}
              value={tripKind}
              onValueChange={(value) =>
                setTripKind(value as SubscribersEntityTripKindEnum)
              }
            >
              <SelectTrigger id="sub-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {tripKindItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="sub-time">Heure habituelle</FieldLabel>
            <Input
              id="sub-time"
              type="time"
              value={pickupTime}
              onChange={(event) => setPickupTime(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sub-fare">Prix convenu (FCFA)</FieldLabel>
            <Input
              id="sub-fare"
              inputMode="numeric"
              value={agreedFare}
              onChange={(event) =>
                setAgreedFare(event.target.value.replace(/\D/g, ''))
              }
            />
          </Field>
          <FieldSet>
            <FieldLegend>Jours concernés</FieldLegend>
            <div className="grid grid-cols-2 gap-2">
              {DAYS.map((day) => (
                <Field key={day} orientation="horizontal">
                  <Checkbox
                    id={`day-${day}`}
                    checked={days.includes(day)}
                    onCheckedChange={(checked) =>
                      setDays((current) =>
                        checked === true
                          ? [...current, day]
                          : current.filter((item) => item !== day),
                      )
                    }
                  />
                  <FieldLabel htmlFor={`day-${day}`}>{day}</FieldLabel>
                </Field>
              ))}
            </div>
          </FieldSet>
        </FieldGroup>

        <DialogFooter>
          <Button
            className="h-12"
            disabled={!ready || create.isLoading}
            onClick={submit}
          >
            {create.isLoading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            Enregistrer l’abonné
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
