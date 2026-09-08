/**
 * État global d'interface de BAREWA — et rien de plus.
 *
 * L'état serveur (villes, repères, chauffeurs, courses) vient des hooks
 * d'entités, qui gèrent déjà cache et synchronisation live. Ce contexte ne
 * porte que ce qui est vraiment global à l'UI : la langue choisie, la ville
 * sélectionnée, la demande de re-commande d'un trajet, et l'ouverture des
 * modales et surcouches — toutes rendues ici une seule fois pour toute
 * l'application, puisqu'elles sont déclenchées depuis la barre supérieure, le
 * bouton flottant et n'importe quel écran.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  StreetViewModal,
  type StreetViewTarget,
} from '@/components/modals/StreetViewModal';
import {
  Vehicle3DModal,
  type Vehicle3DTarget,
} from '@/components/modals/Vehicle3DModal';
import { VersionUpdateModal } from '@/components/modals/VersionUpdateModal';
import { CitySelectorModal } from '@/components/modals/CitySelectorModal';
import { AuthModal } from '@/components/modals/AuthModal';
import { BarewaAiModal } from '@/components/modals/BarewaAiModal';
import { AutonomousOrganismModal } from '@/components/modals/AutonomousOrganismModal';
import { SosModal } from '@/components/modals/SosModal';
import { SimulationModal } from '@/components/modals/SimulationModal';
import { ReceiptModal } from '@/components/modals/ReceiptModal';
import {
  isLanguage,
  translate,
  type Language,
  type TranslationKey,
} from '@/utils/Translations';

const LANGUAGE_STORAGE_KEY = 'barewa.language';
const CITY_STORAGE_KEY = 'barewa.cityId';

/** Trajet à pré-remplir dans le formulaire de commande. */
export interface RebookRequest {
  pickupLabel: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLabel: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  vehicleTypeId?: number;
  cityId?: number;
}

interface AppContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
  /** Ville sélectionnée dans l'app passager, `null` tant qu'aucun choix. */
  cityId: number | null;
  setCityId: (cityId: number | null) => void;
  openStreetView: (target: StreetViewTarget) => void;
  openVehicle3D: (target: Vehicle3DTarget) => void;
  /* Surcouches de la barre supérieure et du bouton flottant. */
  openVersion: () => void;
  openCitySelector: () => void;
  openAuth: () => void;
  openAssistant: () => void;
  openBrain: () => void;
  openSos: () => void;
  openSimulation: () => void;
  /** Reçu officiel d'une course terminée. */
  openReceipt: (rideId: number) => void;
  /** Trajet demandé en re-commande depuis l'historique. */
  rebook: RebookRequest | null;
  requestRebook: (request: RebookRequest) => void;
  clearRebook: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    /* localStorage indisponible (navigation privée) : on garde le français. */
  }
  return 'Français';
}

function readStoredCityId(): number | null {
  try {
    const stored = Number(window.localStorage.getItem(CITY_STORAGE_KEY));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);
  const [cityId, setCityIdState] = useState<number | null>(readStoredCityId);
  const [streetViewTarget, setStreetViewTarget] =
    useState<StreetViewTarget | null>(null);
  const [vehicle3DTarget, setVehicle3DTarget] =
    useState<Vehicle3DTarget | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [receiptRideId, setReceiptRideId] = useState<number | null>(null);
  const [rebook, setRebook] = useState<RebookRequest | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* Rien à faire : la langue reste valable pour la session en cours. */
    }
  }, [language]);

  useEffect(() => {
    try {
      if (cityId) {
        window.localStorage.setItem(CITY_STORAGE_KEY, String(cityId));
      } else {
        window.localStorage.removeItem(CITY_STORAGE_KEY);
      }
    } catch {
      /* Idem : la sélection reste valable pour la session en cours. */
    }
  }, [cityId]);

  const value: AppContextValue = {
    language,
    setLanguage: setLanguageState,
    t: (key: TranslationKey) => translate(language, key),
    cityId,
    setCityId: setCityIdState,
    openStreetView: setStreetViewTarget,
    openVehicle3D: setVehicle3DTarget,
    openVersion: () => setVersionOpen(true),
    openCitySelector: () => setCityOpen(true),
    openAuth: () => setAuthOpen(true),
    openAssistant: () => setAssistantOpen(true),
    openBrain: () => setBrainOpen(true),
    openSos: () => setSosOpen(true),
    openSimulation: () => setSimulationOpen(true),
    openReceipt: setReceiptRideId,
    rebook,
    requestRebook: setRebook,
    clearRebook: () => setRebook(null),
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <StreetViewModal
        target={streetViewTarget}
        onClose={() => setStreetViewTarget(null)}
      />
      <Vehicle3DModal
        target={vehicle3DTarget}
        onClose={() => setVehicle3DTarget(null)}
      />
      <VersionUpdateModal open={versionOpen} onOpenChange={setVersionOpen} />
      <CitySelectorModal open={cityOpen} onOpenChange={setCityOpen} />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <BarewaAiModal open={assistantOpen} onOpenChange={setAssistantOpen} />
      <AutonomousOrganismModal open={brainOpen} onOpenChange={setBrainOpen} />
      <SosModal open={sosOpen} onOpenChange={setSosOpen} />
      <SimulationModal
        open={simulationOpen}
        onOpenChange={setSimulationOpen}
      />
      <ReceiptModal
        rideId={receiptRideId}
        onClose={() => setReceiptRideId(null)}
      />
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext doit être utilisé dans <AppProvider>');
  }
  return context;
}

/** Raccourci de traduction : `const t = useT();` puis `t('navOrder')`. */
export function useT(): (key: TranslationKey) => string {
  return useAppContext().t;
}
