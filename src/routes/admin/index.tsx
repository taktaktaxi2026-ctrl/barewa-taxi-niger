/**
 * `/admin` — tableau de bord national : courses et recettes par ville et par
 * région (vue CityRideStats), et supervision des courses en cours lues sur la
 * table Rides pour être à jour à la seconde.
 */

import { Activity, CircleAlert, Coins, MapPinned, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { useEntityGetAll } from '@blocksdiy/blocks-client-sdk/reactSdk';
import { CityRideStatsEntity, RidesEntity } from '@/product-types';
import { asViewRows, type CityRideStatsRow } from '@/utils/ViewRows';
import { AdminOnly } from '@/components/admin/AdminOnly';
import { SosAlertsPanel } from '@/components/admin/SosAlertsPanel';
import {
  formatAmount,
  formatDistanceKm,
  formatFcfa,
  formatNigerTime,
} from '@/utils/Format';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const revenueConfig = {
  revenue: { label: 'Recettes', color: 'var(--chart-1)' },
  platformCommission: { label: 'Commission', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const LIVE_STATUSES = [
  'Recherche',
  'Acceptée',
  'Chauffeur en route',
  'Chauffeur arrivé',
  'En course',
];

export default function AdminDashboardPage() {
  return (
    <AdminOnly>
      <AdminDashboard />
    </AdminOnly>
  );
}

function AdminDashboard() {
  const statsQuery = useEntityGetAll(CityRideStatsEntity);
  const ridesQuery = useEntityGetAll(RidesEntity);

  const stats = asViewRows<CityRideStatsRow>(statsQuery.data);
  // Les courses de simulation n'entrent dans aucun compteur national.
  const rides = (ridesQuery.data ?? []).filter((ride) => !ride.isSimulation);
  const liveRides = rides
    .filter((ride) => LIVE_STATUSES.includes(ride.status ?? ''))
    .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''));

  const totalRides = stats.reduce(
    (sum, row) => sum + (row.completedRides ?? 0),
    0,
  );
  const totalRevenue = stats.reduce((sum, row) => sum + (row.revenue ?? 0), 0);
  const totalCommission = stats.reduce(
    (sum, row) => sum + (row.platformCommission ?? 0),
    0,
  );

  const byCity = [...stats]
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
    .map((row) => ({
      label: row.cityName ?? '—',
      revenue: row.revenue ?? 0,
      platformCommission: row.platformCommission ?? 0,
    }));

  const byRegion = Object.entries(
    stats.reduce<Record<string, number>>((acc, row) => {
      const key = row.regionName ?? '—';
      acc[key] = (acc[key] ?? 0) + (row.revenue ?? 0);
      return acc;
    }, {}),
  )
    .map(([region, revenue]) => ({ region, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const regionConfig: ChartConfig = Object.fromEntries(
    byRegion.map((entry, index) => [
      entry.region,
      {
        label: entry.region,
        color: CHART_COLORS[index % CHART_COLORS.length],
      },
    ]),
  );

  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={<Activity className="size-4" />}
          label="Courses terminées"
          value={String(totalRides)}
        />
        <Kpi
          icon={<Coins className="size-4" />}
          label="Recettes nationales"
          value={formatFcfa(totalRevenue)}
        />
        <Kpi
          icon={<TrendingUp className="size-4" />}
          label="Commission plateforme"
          value={formatFcfa(totalCommission)}
        />
        <Kpi
          icon={<MapPinned className="size-4" />}
          label="Villes actives"
          value={String(stats.length)}
        />
      </div>

      {statsQuery.error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Statistiques indisponibles</AlertTitle>
          <AlertDescription>
            Vérifiez la connexion, puis rouvrez la page.
          </AlertDescription>
        </Alert>
      )}

      {statsQuery.isLoading && !stats.length && (
        <Skeleton className="h-72 w-full" />
      )}

      {!statsQuery.isLoading && !stats.length && (
        <Empty>
          <EmptyMedia variant="icon">
            <Activity />
          </EmptyMedia>
          <EmptyTitle>Aucune course terminée</EmptyTitle>
          <EmptyDescription>
            Les recettes par ville et par région apparaîtront ici dès les
            premières courses clôturées.
          </EmptyDescription>
        </Empty>
      )}

      {stats.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recettes par ville</CardTitle>
              <CardDescription>
                Chiffre d’affaires et commission plateforme, en FCFA.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueConfig} className="h-72 w-full">
                <BarChart data={byCity}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickFormatter={(value: number) => formatAmount(value)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatFcfa(Number(value))}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    dataKey="revenue"
                    fill="var(--color-revenue)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="platformCommission"
                    fill="var(--color-platformCommission)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Répartition par région</CardTitle>
              <CardDescription>
                Part de chaque région dans les recettes nationales.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={regionConfig} className="h-72 w-full">
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        nameKey="region"
                        formatter={(value) => formatFcfa(Number(value))}
                      />
                    }
                  />
                  <Pie
                    data={byRegion}
                    dataKey="revenue"
                    nameKey="region"
                    innerRadius={54}
                    outerRadius={92}
                  >
                    {byRegion.map((entry, index) => (
                      <Cell
                        key={entry.region}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="region" />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {stats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Détail par ville</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ville</TableHead>
                  <TableHead>Région</TableHead>
                  <TableHead className="text-end">Courses</TableHead>
                  <TableHead className="text-end">Recettes</TableHead>
                  <TableHead className="text-end">Commission</TableHead>
                  <TableHead className="text-end">Panier moyen</TableHead>
                  <TableHead className="text-end">Distance moy.</TableHead>
                  <TableHead className="text-end">Note moy.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.cityName}
                    </TableCell>
                    <TableCell>{row.regionName}</TableCell>
                    <TableCell className="amount text-end">
                      {row.completedRides ?? 0}
                    </TableCell>
                    <TableCell className="amount text-end">
                      {formatFcfa(row.revenue)}
                    </TableCell>
                    <TableCell className="amount text-end">
                      {formatFcfa(row.platformCommission)}
                    </TableCell>
                    <TableCell className="amount text-end">
                      {formatFcfa(row.averageFare)}
                    </TableCell>
                    <TableCell className="amount text-end">
                      {formatDistanceKm(row.averageDistanceKm)}
                    </TableCell>
                    <TableCell className="amount text-end">
                      {(row.averageRating ?? 0).toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <SosAlertsPanel />

      <Card>
        <CardHeader>
          <CardTitle>Courses en cours</CardTitle>
          <CardDescription>
            Mise à jour en direct depuis la table des courses.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {ridesQuery.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Courses indisponibles</AlertTitle>
              <AlertDescription>
                Vérifiez la connexion, puis rouvrez la page.
              </AlertDescription>
            </Alert>
          )}
          {ridesQuery.isLoading && !rides.length && (
            <Skeleton className="h-24 w-full" />
          )}
          {!ridesQuery.isLoading && !liveRides.length && (
            <p className="text-sm text-muted-foreground">
              Aucune course en cours actuellement.
            </p>
          )}
          {liveRides.map((ride) => (
            <div
              key={ride.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5"
            >
              <Badge variant="outline" className="amount">
                {ride.reference}
              </Badge>
              <Badge variant="secondary">{ride.status}</Badge>
              <span className="min-w-0 flex-1 truncate text-sm">
                {ride.pickupLabel} → {ride.dropoffLabel}
              </span>
              <span className="amount text-sm font-semibold text-primary">
                {formatFcfa(ride.estimatedFare)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatNigerTime(ride.requestedAt)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
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