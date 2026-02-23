'use client';

import { memo, useEffect, useState } from 'react';
import { Bot, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { mockAgents } from '@/lib/mock-data';
import { AgentCard } from './agent-card';
import { CreateAgentDialog } from './create-agent-dialog';
import type { Agent } from '@/types';

export const AgentList = memo(() => {
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
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/50 py-16">
        <Bot className="h-10 w-10 text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">No agents yet</p>
          <p className="text-sm text-muted-foreground">Create your first agent to get started</p>
        </div>
        <CreateAgentDialog
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
});
