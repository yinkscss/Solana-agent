import Link from 'next/link';
import { Bot } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AgentStatusBadge } from './agent-status-badge';
import type { Agent } from '@/types';

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/dashboard/agents/${agent.id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold leading-none">{agent.name}</span>
          </div>
          <AgentStatusBadge status={agent.status} />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{agent.model}</span>
            <Badge variant="outline" className="text-xs">
              {agent.framework}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Last active: {new Date(agent.updatedAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
