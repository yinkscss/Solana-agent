'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Hexagon, ArrowRight, Loader2 } from 'lucide-react';
import { Providers } from '@/components/providers';
import { useAuth } from '@/lib/auth';

function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setLoading(true);
    setError('');

    try {
      login(apiKey.trim());
      router.push('/dashboard');
    } catch {
      setError('Invalid API key. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-background to-background" />
      <Card className="relative z-10 w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
            <Hexagon className="h-8 w-8 text-violet-500" />
          </div>
          <CardTitle className="text-2xl">SolAgent</CardTitle>
          <CardDescription>Enter your API key to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="h-11"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter any string as API key for the demo
              </p>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
            <Button
              type="submit"
              disabled={loading || !apiKey.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {loading ? 'Authenticating...' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Providers>
      <LoginForm />
    </Providers>
  );
}
