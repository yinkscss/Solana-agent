import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { AuthGuard } from '@/components/auth-guard';
import { Providers } from '@/components/providers';
import { WebSocketProvider } from '@/lib/websocket-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AuthGuard>
        <WebSocketProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex h-[100dvh] flex-col">{children}</SidebarInset>
          </SidebarProvider>
        </WebSocketProvider>
      </AuthGuard>
    </Providers>
  );
}
