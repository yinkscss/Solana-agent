"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { mockAgents } from "@/lib/mock-data";
import { AgentCard } from "./agent-card";
import type { Agent } from "@/types";

export function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listAgents()
      .then(setAgents)
      .catch(() => setAgents(mockAgents))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-border/50 bg-card/30"
          />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border/50 text-muted-foreground">
        No agents found. Create your first agent to get started.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
