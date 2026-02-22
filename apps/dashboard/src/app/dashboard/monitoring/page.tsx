"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Cpu,
  ArrowLeftRight,
  Shield,
  Server,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";

const GRAFANA_URL =
  process.env.NEXT_PUBLIC_GRAFANA_URL || "http://localhost:3100";

const PANELS = [
  {
    id: "system-overview",
    label: "System Overview",
    icon: Activity,
    dashboardPath: "/d/system-overview",
  },
  {
    id: "transactions",
    label: "Transactions",
    icon: ArrowLeftRight,
    dashboardPath: "/d/transactions",
  },
  {
    id: "policies",
    label: "Policies",
    icon: Shield,
    dashboardPath: "/d/policies",
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    icon: Server,
    dashboardPath: "/d/infrastructure",
  },
] as const;

const MOCK_METRICS = {
  "system-overview": [
    {
      title: "Uptime",
      value: "99.97%",
      description: "Last 30 days",
      icon: TrendingUp,
      trend: { value: 0.02, positive: true },
    },
    {
      title: "Avg Latency",
      value: "42ms",
      description: "p99: 128ms",
      icon: Clock,
    },
    {
      title: "CPU Usage",
      value: "34%",
      description: "4 cores allocated",
      icon: Cpu,
      trend: { value: 5, positive: false },
    },
    {
      title: "Memory",
      value: "2.1 GB",
      description: "of 4 GB allocated",
      icon: Zap,
    },
  ],
  transactions: [
    {
      title: "TPS",
      value: "24.3",
      description: "Transactions per second",
      icon: Zap,
      trend: { value: 12, positive: true },
    },
    {
      title: "Success Rate",
      value: "98.2%",
      description: "Last 24 hours",
      icon: TrendingUp,
      trend: { value: 1.5, positive: true },
    },
    {
      title: "Avg Confirm Time",
      value: "1.2s",
      description: "Solana finality",
      icon: Clock,
    },
    {
      title: "Failed (24h)",
      value: "3",
      description: "2 retried successfully",
      icon: AlertTriangle,
      trend: { value: 40, positive: true },
    },
  ],
  policies: [
    {
      title: "Policy Evals",
      value: "1,247",
      description: "Last 24 hours",
      icon: Shield,
      trend: { value: 8, positive: true },
    },
    {
      title: "Blocked",
      value: "23",
      description: "Transactions blocked",
      icon: AlertTriangle,
    },
    {
      title: "Avg Eval Time",
      value: "8ms",
      description: "p99: 22ms",
      icon: Clock,
      trend: { value: 3, positive: true },
    },
    {
      title: "Active Rules",
      value: "7",
      description: "Across 2 policies",
      icon: Activity,
    },
  ],
  infrastructure: [
    {
      title: "Services",
      value: "5 / 5",
      description: "All healthy",
      icon: Server,
      trend: { value: 0, positive: true },
    },
    {
      title: "DB Connections",
      value: "12",
      description: "of 50 pool limit",
      icon: Cpu,
    },
    {
      title: "Redis Memory",
      value: "128 MB",
      description: "Hit rate: 94%",
      icon: Zap,
      trend: { value: 2, positive: true },
    },
    {
      title: "Queue Depth",
      value: "3",
      description: "Redpanda topics",
      icon: Activity,
    },
  ],
} as const;

export default function MonitoringPage() {
  const [grafanaAvailable, setGrafanaAvailable] = useState<boolean | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<string>("system-overview");

  const checkGrafana = useCallback(async () => {
    try {
      const res = await fetch(`${GRAFANA_URL}/api/health`, {
        mode: "no-cors",
        signal: AbortSignal.timeout(3000),
      });
      setGrafanaAvailable(res.ok || res.type === "opaque");
    } catch {
      setGrafanaAvailable(false);
    }
  }, []);

  useEffect(() => {
    checkGrafana();
  }, [checkGrafana]);

  const currentPanel = PANELS.find((p) => p.id === activeTab) ?? PANELS[0];
  const iframeSrc = `${GRAFANA_URL}${currentPanel.dashboardPath}?orgId=1&kiosk`;
  const metrics =
    MOCK_METRICS[activeTab as keyof typeof MOCK_METRICS] ??
    MOCK_METRICS["system-overview"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time platform metrics and dashboards
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              grafanaAvailable
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            }
          >
            {grafanaAvailable === null
              ? "Checking..."
              : grafanaAvailable
                ? "Grafana Connected"
                : "Grafana Offline"}
          </Badge>
          <Button variant="outline" size="sm" onClick={checkGrafana}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {PANELS.map((panel) => (
            <TabsTrigger key={panel.id} value={panel.id}>
              <panel.icon className="mr-1.5 h-3.5 w-3.5" />
              {panel.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {PANELS.map((panel) => (
          <TabsContent key={panel.id} value={panel.id}>
            {grafanaAvailable ? (
              <Card className="overflow-hidden border-border/50">
                <CardContent className="p-0">
                  <iframe
                    src={`${GRAFANA_URL}${panel.dashboardPath}?orgId=1&kiosk`}
                    className="h-[600px] w-full border-0"
                    title={`${panel.label} Dashboard`}
                    loading="lazy"
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
                  <CardContent className="flex items-center gap-3 py-4">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-amber-300">
                        Grafana not connected
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Showing mock metrics. Connect Grafana at{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">
                          {GRAFANA_URL}
                        </code>{" "}
                        for live dashboards.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {metrics.map((metric) => (
                    <StatCard
                      key={metric.title}
                      title={metric.title}
                      value={metric.value}
                      description={metric.description}
                      icon={metric.icon}
                      trend={
                        "trend" in metric ? metric.trend : undefined
                      }
                    />
                  ))}
                </div>

                <Card className="border-border/50 bg-card/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <panel.icon className="h-4 w-4 text-violet-400" />
                      {panel.label} — Sample View
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border/50 text-muted-foreground">
                      <div className="text-center">
                        <panel.icon className="mx-auto mb-3 h-10 w-10 opacity-30" />
                        <p className="text-sm">
                          Live {panel.label.toLowerCase()} charts will appear
                          here when Grafana is connected
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
