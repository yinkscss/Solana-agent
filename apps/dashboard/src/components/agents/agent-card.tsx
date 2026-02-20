"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentStatusBadge } from "./agent-status-badge";
import type { Agent } from "@/types";

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/dashboard/agents/${agent.id}`}>
      <Card className="border-border/50 bg-card/50 transition-colors hover:border-violet-500/30 hover:bg-card/80">
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{agent.name}</CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {agent.description}
            </p>
          </div>
          <AgentStatusBadge status={agent.status} />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs font-normal">
              {agent.framework}
            </Badge>
            <Badge variant="outline" className="text-xs font-normal">
              {agent.model}
            </Badge>
            <span className="ml-auto">
              {new Date(agent.createdAt).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
