'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, MessageSquare, Settings, Hexagon, LogOut, Trash2 } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

interface ChatHistoryItem {
  id: string;
  title: string;
  agentName: string;
  timestamp: Date;
}

function groupByDate(items: ChatHistoryItem[]): Record<string, ChatHistoryItem[]> {
  const groups: Record<string, ChatHistoryItem[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  for (const item of items) {
    const d = new Date(item.timestamp);
    let label: string;
    if (d >= today) label = 'Today';
    else if (d >= yesterday) label = 'Yesterday';
    else if (d >= weekAgo) label = 'This week';
    else label = 'Older';

    (groups[label] ??= []).push(item);
  }
  return groups;
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('solagent-chat-history');
      if (stored) setChatHistory(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    const handler = () => {
      try {
        const stored = localStorage.getItem('solagent-chat-history');
        if (stored) setChatHistory(JSON.parse(stored));
      } catch {}
    };
    window.addEventListener('solagent-chat-updated', handler);
    return () => window.removeEventListener('solagent-chat-updated', handler);
  }, []);

  const startNewChat = useCallback(() => {
    window.dispatchEvent(new CustomEvent('solagent-new-chat'));
    if (pathname !== '/dashboard') router.push('/dashboard');
  }, [pathname, router]);

  const deleteChat = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const updated = chatHistory.filter((c) => c.id !== id);
      setChatHistory(updated);
      localStorage.setItem('solagent-chat-history', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('solagent-chat-updated'));
    },
    [chatHistory],
  );

  const groups = groupByDate(chatHistory);
  const groupOrder = ['Today', 'Yesterday', 'This week', 'Older'];

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="border-b border-border/50 px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Hexagon className="h-7 w-7 text-violet-500" />
          <span className="text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            SolAgent
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <div className="p-2 group-data-[collapsible=icon]:px-0">
          <Button
            onClick={startNewChat}
            className="w-full justify-start gap-2 bg-violet-600 hover:bg-violet-700 text-white group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
            size="sm"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">New Chat</span>
          </Button>
        </div>

        {groupOrder.map((label) => {
          const items = groups[label];
          if (!items?.length) return null;
          return (
            <SidebarGroup key={label}>
              <SidebarGroupLabel className="text-xs text-muted-foreground/70">
                {label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((chat) => (
                    <SidebarMenuItem key={chat.id}>
                      <SidebarMenuButton asChild tooltip={chat.title} className="group/item">
                        <Link href={`/dashboard?chat=${chat.id}`}>
                          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm">{chat.title}</span>
                          <button
                            onClick={(e) => deleteChat(chat.id, e)}
                            className="ml-auto opacity-0 group-hover/item:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                          </button>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {chatHistory.length === 0 && (
          <div className="px-4 py-8 text-center group-data-[collapsible=icon]:hidden">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground/50">No conversations yet</p>
            <p className="text-xs text-muted-foreground/30 mt-1">Start a new chat above</p>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/dashboard/settings'}
              tooltip="Settings"
            >
              <Link href="/dashboard/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs group-data-[collapsible=icon]:hidden"
              >
                Devnet
              </Badge>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} tooltip="Logout">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
