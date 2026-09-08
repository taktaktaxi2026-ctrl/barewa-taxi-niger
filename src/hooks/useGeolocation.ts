/**
 * Géolocalisation du navigateur, à la demande.
 *
 * Jamais déclenchée au chargement : la demande d'autorisation part d'un geste
 * explicite (« Ma position », passage En ligne du chauffeur). Les messages
 * d'erreur sont en français et immédiatement compréhensibles.
 */

import { useState } from 'react';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracyM: number;
}

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = (): Promise<GeoPoint | null> => {
    if (!('geolocation' in navigator)) {
      setError('Ce téléphone ne permet pas la géolocalisation.');
      return Promise.resolve(null);
    }
    setIsLoading(true);
    setError(null);
    return new Promise<GeoPoint | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (result) => {
          const point: GeoPoint = {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
            accuracyM: Math.round(result.coords.accuracy || 0),
          };
          setPosition(point);
          setIsLoading(false);
          resolve(point);
        },
        (failure) => {
          const messages: Record<number, string> = {
            1: 'Autorisation refusée. Activez la localisation pour ce site.',
            2: 'Position indisponible. Sortez à découvert et réessayez.',
            3: 'La localisation a pris trop de temps. Réessayez.',
          };
          setError(messages[failure.code] ?? 'Localisation impossible.');
          setIsLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
      );
    });
  };

  return { position, request, isLoading, error };
}