/**
 * `/course/profil` — langue d'interface, moyen de paiement préféré,
 * coordonnées et contact d'urgence du passager.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import {
  CircleAlert,
  Gauge,
  MessageCircle,
  ShieldAlert,
  User,
} from 'lucide-react';
import {
  useEntityGetAll,
  useEntityUpdate,
} from '@blocksdiy/blocks-client-sdk/reactSdk';
import {
  PassengerProfileEntity,
  PaymentProvidersEntity,
  type PassengerProfileEntityPreferredLanguageEnum,
} from '@/product-types';
import { useCurrentProfiles } from '@/hooks/useCurrentProfiles';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { ProfileSetup } from '@/components/ProfileSetup';
import { useAppContext } from '@/components/AppProvider';
import { SavedPlacesSection } from '@/components/course/SavedPlacesSection';
import { VehicleShowroom } from '@/components/course/VehicleShowroom';
import { LandmarkStreetViewSection } from '@/components/course/LandmarkStreetViewSection';
import { DriverApplicationDialog } from '@/components/course/DriverApplicationDialog';
import { formatFcfa, numId, whatsappHref } from '@/utils/Format';
import { LANGUAGES, type Language } from '@/utils/Translations';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export default function ProfilPage() {
  const { t, language, setLanguage, cityId } = useAppContext();
  const { user, passenger, driver, isAdmin, isLoading } = useCurrentProfiles();
  const { supportWhatsappNumber } = useCompanySettings();
  const update = useEntityUpdate(PassengerProfileEntity);
  const providersQuery = useEntityGetAll(PaymentProvidersEntity);

  const [fullName, setFullName] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [emergencyName, setEmergencyName] = useState<string | null>(null);
  const [emergencyPhone, setEmergencyPhone] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!passenger) return <ProfileSetup kind="passenger" />;

  const providers = (providersQuery.data ?? [])
    .filter((provider) => provider.isActive)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const nameValue = fullName ?? passenger.fullName ?? '';
  const phoneValue = phoneNumber ?? passenger.phoneNumber ?? '';
  const emergencyNameValue =
    emergencyName ?? passenger.emergencyContactName ?? '';
  const emergencyPhoneValue =
    emergencyPhone ?? passenger.emergencyContactPhone ?? '';
  const providerValue =
    providerId ?? passenger.preferredPaymentProviderId ?? null;

  const save = async () => {
    try {
      await update.updateFunction({
        id: passenger.id,
        data: {
          fullName: nameValue.trim() || undefined,
          phoneNumber: phoneValue.replace(/\s/g, '') || undefined,
          preferredLanguage:
            language as PassengerProfileEntityPreferredLanguageEnum,
          preferredPaymentProviderId: providerValue ?? undefined,
          emergencyContactName: emergencyNameValue.trim() || undefined,
          emergencyContactPhone:
            emergencyPhoneValue.replace(/\s/g, '') || undefined,
        },
      });
      toast.add({ title: t('saved'), type: 'success' });
    } catch {
      toast.add({
        title: 'Enregistrement impossible',
        description: t('errorHint'),
        type: 'error',
      });
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <Card size="sm">
        <CardContent className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
            <User className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{passenger.fullName}</p>
            <p className="amount text-xs text-muted-foreground">
              {passenger.totalRides ?? 0} courses ·{' '}
              {formatFcfa(passenger.totalSpent)} dépensés
            </p>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base">{t('language')}</CardTitle>
          <CardDescription>
            La langue choisie est enregistrée sur votre profil et retenue sur ce
            téléphone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            value={[language]}
            onValueChange={(value) => {
              const next = value[value.length - 1];
              if (typeof next === 'string') setLanguage(next as Language);
            }}
          >
            {LANGUAGES.map((item) => (
              <ToggleGroupItem key={item} value={item}>
                {item}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base">{t('choosePayment')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {providersQuery.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Moyens de paiement indisponibles</AlertTitle>
              <AlertDescription>{t('errorHint')}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-2">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => setProviderId(numId(provider.id))}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-2.5 text-start transition-colors',
                  providerValue === numId(provider.id)
                    ? 'border-primary bg-primary/10'
                    : 'hover:bg-accent',
                )}
              >
                <span
                  className="size-5 shrink-0 rounded-full border border-white/20"
                  style= background: provider.brandColor || 'var(--muted)' 
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {provider.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {provider.kind}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base">Mes coordonnées</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="p-name">{t('fullName')}</FieldLabel>
              <Input
                id="p-name"
                value={nameValue}
                onChange={(event) => setFullName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="p-phone">{t('phone')}</FieldLabel>
              <Input
                id="p-phone"
                inputMode="tel"
                value={phoneValue}
                onChange={(event) => setPhoneNumber(event.target.value)}
              />
              <FieldDescription>
                Format international : +227 suivi de 8 chiffres.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="e-name">
                {t('emergencyContact')} — nom
              </FieldLabel>
              <Input
                id="e-name"
                value={emergencyNameValue}
                onChange={(event) => setEmergencyName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="e-phone">
                {t('emergencyContact')} — téléphone
              </FieldLabel>
              <Input
                id="e-phone"
                inputMode="tel"
                value={emergencyPhoneValue}
                onChange={(event) => setEmergencyPhone(event.target.value)}
              />
              <FieldDescription>
                Prévenu par vos proches en cas de problème pendant une course.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2">
          <Button
            className="h-12"
            disabled={update.isLoading}
            onClick={save}
          >
            {update.isLoading && <Spinner data-icon="inline-start" />}
            {t('save')}
          </Button>
          <Alert>
            <ShieldAlert />
            <AlertTitle>Sécurité</AlertTitle>
            <AlertDescription>
              Vos coordonnées ne sont montrées qu’au chauffeur affecté à votre
              course.
            </AlertDescription>
          </Alert>
        </CardFooter>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base">Raccourcis</CardTitle>
          <CardDescription>
            Tout ce qui sert avant de monter dans le véhicule.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {driver || isAdmin ? (
            <Button
              variant="secondary"
              className="h-12 justify-start"
              render={<Link to="/chauffeur" />}
            >
              <Gauge data-icon="inline-start" />
              Basculer vers mon espace chauffeur
            </Button>
          ) : (
            <DriverApplicationDialog
              passenger={passenger}
              email={user.email}
            />
          )}

          {supportWhatsappNumber ? (
            <Button
              variant="secondary"
              className="h-12 justify-start"
              render={
                <a
                  href={whatsappHref(
                    supportWhatsappNumber,
                    'Bonjour BAREWA, j’ai besoin d’aide au sujet de mon compte.',
                  )}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <MessageCircle data-icon="inline-start" />
              Support client WhatsApp 7j/7
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Le numéro WhatsApp du support n’est pas encore renseigné par
              l’administration.
            </p>
          )}
        </CardContent>
      </Card>

      <VehicleShowroom />

      <LandmarkStreetViewSection cityId={cityId ?? passenger.cityId ?? null} />

      <SavedPlacesSection />
    </div>
  );
}