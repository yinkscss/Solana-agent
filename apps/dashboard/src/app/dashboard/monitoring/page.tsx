'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Gauge, AlertTriangle, Timer, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/stat-card';
import { mockServiceHealth } from '@/lib/mock-data';
import { api } from '@/lib/api';
import type { ServiceHealth } from '@/types';

const GRAFANA_URL = process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://localhost:3100';

const STAT_CARDS = [
  {
    title: 'Uptime',
    value: '99.97%',
    description: 'Last 30 days',
    icon: Activity,
    trend: 'up' as const,
  },
  { title: 'Request Rate', value: '24.3/s', description: 'Avg last hour', icon: Gauge },
  {
    title: 'Error Rate',
    value: '0.12%',
    description: 'Last 24 hours',
    icon: AlertTriangle,
    trend: 'down' as const,
  },
  { title: 'Avg Latency', value: '42ms', description: 'p99: 128ms', icon: Timer },
];

const statusDot: Record<ServiceHealth['status'], string> = {
  healthy: 'bg-emerald-500',
  unhealthy: 'bg-red-500',
  unknown: 'bg-zinc-500',
};

const statusBadge: Record<ServiceHealth['status'], string> = {
  healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  unhealthy: 'bg-red-500/10 text-red-400 border-red-500/20',
  unknown: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export default function MonitoringPage() {
  const [grafanaAvailable, setGrafanaAvailable] = useState<boolean | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);

  const checkGrafana = useCallback(async () => {
    try {
      const res = await fetch(`${GRAFANA_URL}/api/health`, {
        mode: 'no-cors',
        signal: AbortSignal.timeout(3000),
      });
      setGrafanaAvailable(res.ok || res.type === 'opaque');
    } catch {
      setGrafanaAvailable(false);
    }
  }, []);

  useEffect(() => {
    checkGrafana();
    api
      .getServiceHealth()
      .then(setServices)
      .catch(() => setServices(mockServiceHealth));
  }, [checkGrafana]);

  const healthServices = services.length > 0 ? services : mockServiceHealth;
  const grafanaLabel = grafanaAvailable ? 'Grafana Connected' : 'Grafana Offline';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Monitoring</h1>
          <p className="text-sm text-muted-foreground">System observability and metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              grafanaAvailable
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }
          >
            {grafanaAvailable === null ? 'Checking...' : grafanaLabel}
          </Badge>
          <Button variant="outline" size="sm" onClick={checkGrafana}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            description={card.description}
            icon={card.icon}
            trend={card.trend}
          />
        ))}
      </div>

      {/* Service Health */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Service Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {healthServices.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between rounded-lg border border-border/30 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusDot[service.status]}`} />
                  <div>
                    <p className="text-sm font-medium">{service.name}</p>
                    {service.latency != null && (
                      <p className="text-xs text-muted-foreground">{service.latency}ms</p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={statusBadge[service.status]}>
                  {service.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Grafana Embeds */}
      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics">
          <Card className="overflow-hidden border-border/50">
            <CardContent className="p-0">
              {grafanaAvailable ? (
                <iframe
                  src={`${GRAFANA_URL}/d/system-overview?orgId=1&kiosk`}
                  className="h-[400px] md:h-[500px] w-full border-0"
                  title="Metrics Dashboard"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-[400px] md:h-[500px] items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Activity className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p className="text-sm">Connect Grafana to view live metrics</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expected at{' '}
                      <code className="rounded bg-muted px-1 py-0.5">{GRAFANA_URL}</code>
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="overflow-hidden border-border/50">
            <CardContent className="p-0">
              {grafanaAvailable ? (
                <iframe
                  src={`${GRAFANA_URL}/d/logs?orgId=1&kiosk`}
                  className="h-[400px] md:h-[500px] w-full border-0"
                  title="Logs Dashboard"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-[400px] md:h-[500px] items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Activity className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p className="text-sm">Connect Grafana to view live logs</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expected at{' '}
                      <code className="rounded bg-muted px-1 py-0.5">{GRAFANA_URL}</code>
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
