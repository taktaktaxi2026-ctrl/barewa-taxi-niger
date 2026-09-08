/**
 * Envoi de SMS et liens WhatsApp — partagés par TriggerSosAlert et
 * NotifySubscribersDeparture. Un SMS qui échoue ne fait jamais échouer l'action
 * appelante : l'échec est rapporté par destinataire.
 */
import type { BlocksClient } from './blocks/blocks-client.ts';

/** Limite imposée par l'action plateforme SendSMS. */
export const SMS_MAX_LENGTH = 319;

export interface SmsResult {
  delivered: boolean;
  failureReason: string;
}

/** Tronque proprement un corps de SMS à 319 caractères. */
export const truncateSms = (body: string): string =>
  body.length <= SMS_MAX_LENGTH
    ? body
    : `${body.slice(0, SMS_MAX_LENGTH - 1)}…`;

/**
 * Normalise un numéro nigérien vers le format E.164 attendu par SendSMS.
 * Les numéros locaux à 8 chiffres reçoivent l'indicatif +227.
 */
export const toE164 = (raw: string | null | undefined): string => {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.length === 8) return `+227${digits}`;
  if (digits.startsWith('227')) return `+${digits}`;
  return `+${digits}`;
};

/** Envoie un SMS ; ne lève jamais d'exception. */
export const sendSms = async (
  client: BlocksClient,
  phoneNumber: string | null | undefined,
  body: string,
): Promise<SmsResult> => {
  const sendTo = toE164(phoneNumber);
  if (!sendTo) {
    return { delivered: false, failureReason: 'Numéro de téléphone manquant' };
  }
  try {
    await client.invokeAction('SendSMS', {
      sendTo,
      body: truncateSms(body),
    });
    return { delivered: true, failureReason: '' };
  } catch (error) {
    const reason =
      error instanceof Error && error.message
        ? error.message
        : "Échec de l'envoi du SMS";
    return { delivered: false, failureReason: reason };
  }
};

/** Lien WhatsApp pré-rempli : numéro sans « + » ni espaces, message encodé. */
export const buildWhatsappUrl = (
  phoneNumber: string | null | undefined,
  message: string,
): string => {
  const digits = toE164(phoneNumber).replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

/** Lien Google Maps vers une position figée. */
export const buildMapsUrl = (latitude: number, longitude: number): string =>
  `https://maps.google.com/?q=${latitude},${longitude}`;
