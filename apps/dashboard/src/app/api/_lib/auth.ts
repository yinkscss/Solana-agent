import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type AuthSuccess = { apiKey: string };
type AuthFailure = { error: string; status: 401 };

export function requireApiKey(req: NextRequest): AuthSuccess | AuthFailure {
  const fromHeader = req.headers.get('x-api-key');
  if (fromHeader) return { apiKey: fromHeader };

  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return { apiKey: token };
  }

  return { error: 'API key required', status: 401 };
}

export function isAuthFailure(result: AuthSuccess | AuthFailure): result is AuthFailure {
  return 'error' in result;
}

export function authErrorResponse(result: AuthFailure) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
