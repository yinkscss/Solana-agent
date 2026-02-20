"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { mockPolicies } from "@/lib/mock-data";
import type { Policy } from "@/types";

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-xl border border-border/50 bg-card/30"
          />
        ))}
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border/50 text-muted-foreground">
        No policies found. Create your first policy to get started.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {policies.map((policy) => (
        <Card
          key={policy.id}
          className="border-border/50 bg-card/50"
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-base">{policy.name}</CardTitle>
              <Badge
                variant="outline"
                className={
                  policy.active
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                }
              >
                {policy.active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Wallet: {policy.walletId}</span>
              <span>v{policy.version}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {policy.rules.map((rule) => (
                <Badge
                  key={rule.id}
                  variant="outline"
                  className="text-xs font-normal capitalize"
                >
                  {rule.type.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {policy.rules.length} rule{policy.rules.length !== 1 && "s"} &middot; Updated{" "}
              {new Date(policy.updatedAt).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
