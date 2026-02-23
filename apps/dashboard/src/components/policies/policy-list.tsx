'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { mockPolicies } from '@/lib/mock-data';
import type { Policy, PolicyRule } from '@/types';

function ruleLabel(rule: PolicyRule): string {
  switch (rule.type) {
    case 'max_amount': {
      const p = rule.params as { max?: number; token?: string };
      return `Max ${p.max ?? '?'} ${p.token ?? ''}`.trim();
    }
    case 'time_window': {
      const p = rule.params as { maxPerWindow?: number; windowHours?: number };
      return `${p.maxPerWindow ?? '?'} per ${p.windowHours ?? '?'}h`;
    }
    case 'whitelist': {
      const p = rule.params as { addresses?: string[] };
      return `${p.addresses?.length ?? 0} whitelisted`;
    }
    case 'allowed_tokens': {
      const p = rule.params as { tokens?: string[] };
      return (p.tokens ?? []).join(', ');
    }
    default:
      return rule.type.replace(/_/g, ' ');
  }
}

const typeColors: Record<string, string> = {
  max_amount: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  time_window: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  whitelist: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  allowed_tokens: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export function PolicyList() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listPolicies()
      .then(setPolicies)
      .catch(() => setPolicies(mockPolicies))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border/50 text-muted-foreground">
        <Shield className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">No policies</p>
        <p className="mt-1 text-xs">Define rules to govern wallet transactions</p>
        <Button variant="outline" size="sm" className="mt-4">
          Create Policy
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {policies.map((policy) => (
        <Card
          key={policy.id}
          className="border-border/50 bg-card/50 transition-colors hover:bg-accent/50"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">{policy.name}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {policy.rules.map((rule) => (
                  <Badge
                    key={rule.id}
                    variant="outline"
                    className={`text-xs ${typeColors[rule.type] ?? ''}`}
                  >
                    {rule.type.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  policy.active ? 'bg-emerald-500' : 'bg-zinc-500'
                }`}
              />
              <span className="text-sm">{policy.active ? 'Enabled' : 'Disabled'}</span>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {policy.rules.length} rule{policy.rules.length !== 1 && 's'}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {policy.rules.map((rule) => (
                  <span key={rule.id}>{ruleLabel(rule)}</span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>v{policy.version}</span>
              <span>Updated {new Date(policy.updatedAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
