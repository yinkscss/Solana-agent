"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LiveIndicator } from "@/components/live-indicator";
import { useWebSocket } from "@/hooks/use-websocket";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws";

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));
}

export function Header() {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);
  const { connected } = useWebSocket(WS_URL, "default");

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border/50 bg-background/80 px-4 backdrop-blur-sm">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <nav className="flex flex-1 items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-muted-foreground/50">/</span>
            )}
            <span
              className={
                crumb.isLast
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>
      <LiveIndicator connected={connected} />
    </header>
  );
}
