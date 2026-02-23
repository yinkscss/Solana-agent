'use client';

import { AgentList } from '@/components/agents/agent-list';
import { CreateAgentDialog } from '@/components/agents/create-agent-dialog';

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">Manage and monitor your AI agents</p>
        </div>
        <CreateAgentDialog />
      </div>
      <AgentList />
    </div>
  );
}
