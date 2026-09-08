/**
 * `/admin/comptabilite` — Comptabilité & statistiques.
 *
 * Suivi des flux financiers, taux d'adoption des paiements digitaux face aux
 * espèces, complétion des courses, codes promotionnels, et export CSV des
 * données d'exploitation. Les courses de simulation sont exclues partout.
 */

import { Activity, CircleAlert, Coins, Percent } from 'lucide-react';
import { Cell, Pie, PieChart } from 'recharts';
import { useEntityGetAll } from '@blocksdiy/blocks-client-sdk/reactSdk';
import { PaymentsOverviewEntity, RidesEntity } from '@/product-types';
import { asViewRows, type PaymentOverviewRow } from '@/utils/ViewRows';
import { AdminOnly } from '@/components/admin/AdminOnly';
import { PaymentsSection } from '@/components/admin/PaymentsSection';
import { PromoSection } from '@/components/admin/PromoSection';
import { ExportPanel } from '@/components/admin/ExportPanel';
import { formatFcfa } from '@/utils/Format';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export default function AdminAccountingPage() {
  return (
    <AdminOnly>
      <AdminAccounting />
    </AdminOnly>
  );
}

function AdminAccounting() {
  const paymentsQuery = useEntityGetAll(PaymentsOverviewEntity);
  const ridesQuery = useEntityGetAll(RidesEntity);

  const payments = asViewRows<PaymentOverviewRow>(paymentsQuery.data).filter(
    (payment) => payment.rideStatus !== 'Simulation terminée',
  );
  const rides = (ridesQuery.data ?? []).filter((ride) => !ride.isSimulation);

  const cash = payments.filter(
    (payment) => payment.providerKind === 'Espèces',
  );
  const digital = payments.filter(
    (payment) => payment.providerKind !== 'Espèces',
  );

  const cashTotal = cash.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const digitalTotal = digital.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const grandTotal = cashTotal + digitalTotal;
  const digitalShare = grandTotal
    ? Math.round((digitalTotal / grandTotal) * 100)
    : 0;

  const byProvider = new Map<string, number>();
  for (const payment of digital) {
    const name = payment.providerName ?? 'Mobile money';
    byProvider.set(name, (byProvider.get(name) ?? 0) + (payment.amount ?? 0));
  }
  const providerSlices = [
    { name: 'Espèces', amount: cashTotal },
    ...[...byProvider.entries()].map(([name, amount]) => ({ name, amount })),
  ].filter((slice) => slice.amount > 0);

  const providerConfig: ChartConfig = Object.fromEntries(
    providerSlices.map((slice, index) => [
      slice.name,
      {
        label: slice.name,
        color: CHART_COLORS[index % CHART_COLORS.length],
      },
    ]),
  );

  const completed = rides.filter((ride) => ride.status === 'Terminée').length;
  const cancelled = rides.filter((ride) => ride.status === 'Annulée').length;
  const completionRate = rides.length
    ? Math.round((completed / rides.length) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={<Coins className="size-4" />}
          label="Flux encaissés"
          value={formatFcfa(grandTotal)}
        />
        <Kpi
          icon={<Percent className="size-4" />}
          label="Part du digital"
          value={`${digitalShare} %`}
        />
        <Kpi
          icon={<Activity className="size-4" />}
          label="Courses complétées"
          value={`${completionRate} %`}
        />
        <Kpi
          icon={<Activity className="size-4" />}
          label="Courses annulées"
          value={String(cancelled)}
        />
      </div>

      {paymentsQuery.error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Paiements indisponibles</AlertTitle>
          <AlertDescription>
            Vérifiez la connexion, puis rouvrez l’onglet.
          </AlertDescription>
        </Alert>
      )}

      {paymentsQuery.isLoading && !payments.length && (
        <Skeleton className="h-72 w-full" />
      )}

      {providerSlices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Adoption des moyens de paiement</CardTitle>
            <CardDescription>
              Répartition des montants encaissés entre espèces et opérateurs
              mobile money.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={providerConfig} className="h-72 w-full">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      nameKey="name"
                      formatter={(value) => formatFcfa(Number(value))}
                    />
                  }
                />
                <Pie
                  data={providerSlices}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={92}
                >
                  {providerSlices.map((slice, index) => (
                    <Cell
                      key={slice.name}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <ExportPanel />

      <PaymentsSection />

      <PromoSection />
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="amount text-xl font-bold text-primary">{value}</span>
      </CardContent>
    </Card>
  );
}
