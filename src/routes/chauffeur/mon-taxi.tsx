/**
 * `/chauffeur/mon-taxi` — Mon Taxi & Studio 3D.
 *
 * Deux volets : le studio 3D (choix de la carrosserie, photo réelle du
 * véhicule projetée sur les flancs, couleurs, commandes 360°) et le dépôt des
 * pièces justificatives, dont la lecture automatique est faite par l'action de
 * contrôle des pièces.
 */

import { Box, FileCheck2 } from 'lucide-react';
import { Studio3DSection } from '@/components/chauffeur/Studio3DSection';
import { DriverDocumentsSection } from '@/components/chauffeur/DriverDocumentsSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ChauffeurMyTaxiPage() {
  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <Tabs defaultValue="studio">
        <TabsList>
          <TabsTrigger value="studio">
            <Box data-icon="inline-start" />
            Studio 3D
          </TabsTrigger>
          <TabsTrigger value="pieces">
            <FileCheck2 data-icon="inline-start" />
            Mes pièces
          </TabsTrigger>
        </TabsList>
        <TabsContent value="studio">
          <Studio3DSection />
        </TabsContent>
        <TabsContent value="pieces">
          <DriverDocumentsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
