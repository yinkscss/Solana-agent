'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Bot,
  Wallet,
  ArrowLeftRight,
  Shield,
  Settings as SettingsIcon,
  Key,
  Globe,
  HeartPulse,
  Copy,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { AgentList } from '@/components/agents/agent-list';
import { WalletList } from '@/components/wallets/wallet-list';
import { TransactionTable } from '@/components/transactions/transaction-table';
import { PolicyList } from '@/components/policies/policy-list';
import { CreateAgentDialog } from '@/components/agents/create-agent-dialog';
import { CreateWalletDialog } from '@/components/wallets/create-wallet-dialog';
import { CreatePolicyDialog } from '@/components/policies/create-policy-dialog';
import { useAuth } from '@/lib/auth';
import { useWebSocketContext } from '@/lib/websocket-context';
import { api } from '@/lib/api';
import { mockServiceHealth } from '@/lib/mock-data';
import type { ServiceHealth } from '@/types';

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

const TABS = [
  { value: 'agents', label: 'Agents', icon: Bot },
  { value: 'wallets', label: 'Wallets', icon: Wallet },
  { value: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { value: 'policies', label: 'Policies', icon: Shield },
  { value: 'system', label: 'System', icon: SettingsIcon },
] as const;

type TabValue = (typeof TABS)[number]['value'];

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { apiKey } = useAuth();
  const { lastEvent } = useWebSocketContext();

  const initialTab = (searchParams.get('tab') as TabValue) || 'agents';
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [services, setServices] = useState<ServiceHealth[]>([]);

  useEffect(() => {
    api
      .getServiceHealth()
      .then(setServices)
      .catch(() => setServices(mockServiceHealth));
  }, []);

  function handleTabChange(value: string) {
    const tab = value as TabValue;
    setActiveTab(tab);
    router.replace(`/dashboard/settings?tab=${tab}`, { scroll: false });
  }

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function maskKey(key: string) {
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}${'•'.repeat(key.length - 8)}${key.slice(-4)}`;
  }

  const healthServices = services.length > 0 ? services : mockServiceHealth;

  let apiKeyDisplay = 'Not set';
  if (apiKey) {
    apiKeyDisplay = showKey ? apiKey : maskKey(apiKey);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center gap-3 border-b border-border/40 px-4 shrink-0">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-sm font-semibold">Settings</h1>
        <div className="flex-1" />
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
        >
          Devnet
        </Badge>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="border-b border-border/40 px-4 pt-2">
          <TabsList className="bg-transparent h-auto gap-1 p-0">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="gap-1.5 rounded-none border-b-2 border-transparent px-3 pb-2.5 pt-2 data-[state=active]:border-violet-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Agents */}
          <TabsContent value="agents" className="mt-0">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Agents</h2>
                <p className="text-sm text-muted-foreground">Manage and monitor your AI agents</p>
              </div>
              <CreateAgentDialog />
            </div>
            <AgentList />
          </TabsContent>

          {/* Wallets */}
          <TabsContent value="wallets" className="mt-0">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Wallets</h2>
                <p className="text-sm text-muted-foreground">Managed wallets across networks</p>
              </div>
              <CreateWalletDialog />
            </div>
            <WalletList />
          </TabsContent>

          {/* Transactions */}
          <TabsContent value="transactions" className="mt-0">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Transactions</h2>
              <p className="text-sm text-muted-foreground">
                On-chain transaction history across all wallets
              </p>
            </div>
            <TransactionTable lastWsEvent={lastEvent} />
          </TabsContent>

          {/* Policies */}
          <TabsContent value="policies" className="mt-0">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Policies</h2>
                <p className="text-sm text-muted-foreground">
                  Security rules and transaction limits
                </p>
              </div>
              <CreatePolicyDialog />
            </div>
            <PolicyList />
          </TabsContent>

          {/* System */}
          <TabsContent value="system" className="mt-0">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">System</h2>
              <p className="text-sm text-muted-foreground">
                API configuration, network, and service health
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Key className="h-4 w-4 text-violet-400" />
                    API Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="text-sm font-medium">API Key</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      value={apiKeyDisplay}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe className="h-4 w-4 text-violet-400" />
                    Network
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="text-sm font-medium">Current Network</label>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-sm px-3 py-1"
                    >
                      devnet
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Solana Devnet — for development and testing
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6 border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HeartPulse className="h-4 w-4 text-violet-400" />
                  Service Health
                </CardTitle>
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
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
