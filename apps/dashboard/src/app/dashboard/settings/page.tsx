"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { mockServiceHealth } from "@/lib/mock-data";
import { api } from "@/lib/api";
import type { ServiceHealth } from "@/types";

export default function SettingsPage() {
  const { apiKey } = useAuth();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [services, setServices] = useState<ServiceHealth[]>([]);

  useEffect(() => {
    api
      .getServiceHealth()
      .then(setServices)
      .catch(() => setServices(mockServiceHealth));
  }, []);

  function copyKey() {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function maskKey(key: string) {
    if (key.length <= 8) return "••••••••";
    return `${key.slice(0, 4)}${"•".repeat(key.length - 8)}${key.slice(-4)}`;
  }

  const healthServices = services.length > 0 ? services : mockServiceHealth;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Platform configuration and service health
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base">API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={apiKey ? (showKey ? apiKey : maskKey(apiKey)) : "Not set"}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={copyKey}>
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base">Service Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {healthServices.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{service.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {service.latency && (
                      <span className="text-xs text-muted-foreground">
                        {service.latency}ms
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        service.status === "healthy"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : service.status === "unhealthy"
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                      }
                    >
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                      {service.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
