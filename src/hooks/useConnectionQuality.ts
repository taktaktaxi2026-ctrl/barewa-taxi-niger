/**
 * Qualité de connexion du terminal courant, telle que le navigateur l'expose
 * (`navigator.connection`). C'est une mesure locale et réelle : elle décrit ce
 * téléphone-ci, pas l'état du réseau national. Renvoie `null` quand le
 * navigateur ne l'expose pas — aucun indicateur n'est alors affiché.
 */

import { useEffect, useState } from 'react';

export interface ConnectionQuality {
  /** « 4g », « 3g », « 2g », « slow-2g » */
  effectiveType: string;
  /** Débit descendant estimé en Mb/s */
  downlinkMbps: number | null;
  saveData: boolean;
}

interface NetworkInformationLike extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
}

function readConnection(): ConnectionQuality | null {
  const connection = (
    navigator as unknown as { connection?: NetworkInformationLike }
  ).connection;
  if (!connection?.effectiveType) return null;
  return {
    effectiveType: connection.effectiveType,
    downlinkMbps:
      typeof connection.downlink === 'number' ? connection.downlink : null,
    saveData: connection.saveData === true,
  };
}

export function useConnectionQuality(): ConnectionQuality | null {
  const [quality, setQuality] = useState<ConnectionQuality | null>(
    readConnection,
  );

  useEffect(() => {
    const connection = (
      navigator as unknown as { connection?: NetworkInformationLike }
    ).connection;
    if (!connection) return;
    const onChange = () => setQuality(readConnection());
    connection.addEventListener('change', onChange);
    return () => connection.removeEventListener('change', onChange);
  }, []);

  return quality;
}
