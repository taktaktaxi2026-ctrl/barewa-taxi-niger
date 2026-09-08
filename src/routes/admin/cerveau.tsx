/**
 * `/admin/cerveau` — Cerveau IA & journaux. Même panneau que la surcouche
 * ouverte depuis la barre supérieure : un seul code, deux points d'entrée.
 */

import { AdminOnly } from '@/components/admin/AdminOnly';
import { BrainPanel } from '@/components/admin/BrainPanel';

export default function AdminBrainPage() {
  return (
    <div className="p-3 sm:p-4">
      <AdminOnly>
        <BrainPanel />
      </AdminOnly>
    </div>
  );
}
