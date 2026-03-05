import { redirect } from 'next/navigation';

export default function AgentDetailPage() {
  redirect('/dashboard/settings?tab=preferences');
}
