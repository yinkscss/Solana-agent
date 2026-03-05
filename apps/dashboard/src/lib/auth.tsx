'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { api } from './api';

interface AuthContextValue {
  apiKey: string | null;
  agentId: string | null;
  walletId: string | null;
  walletPublicKey: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (key: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'solagent_api_key';
const AGENT_ID_KEY = 'solagent_agent_id';
const WALLET_ID_KEY = 'solagent_wallet_id';
const WALLET_PK_KEY = 'solagent_wallet_public_key';

async function provisionWallet(
  authHeaders: Record<string, string>,
  setWalletId: (id: string) => void,
  setWalletPublicKey: (pk: string | null) => void,
): Promise<{ id: string; publicKey: string | null } | null> {
  const res = await fetch('/api/wallet-provision', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ label: 'My Wallet' }),
  });
  const data = res.ok ? await res.json() : null;
  if (!data?.id) return null;
  localStorage.setItem(WALLET_ID_KEY, data.id);
  if (data.publicKey) localStorage.setItem(WALLET_PK_KEY, data.publicKey);
  setWalletId(data.id);
  setWalletPublicKey(data.publicKey ?? null);
  return { id: data.id, publicKey: data.publicKey ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [walletPublicKey, setWalletPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const provisioningRef = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
      api.setApiKey(stored);
    }
    const storedAgentId = localStorage.getItem(AGENT_ID_KEY);
    const storedWalletId = localStorage.getItem(WALLET_ID_KEY);
    const storedWalletPk = localStorage.getItem(WALLET_PK_KEY);
    if (storedAgentId) setAgentId(storedAgentId);
    if (storedWalletId) setWalletId(storedWalletId);
    if (storedWalletPk) setWalletPublicKey(storedWalletPk);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!apiKey || provisioningRef.current) return;
    if (agentId && walletId && walletPublicKey) return;

    provisioningRef.current = true;

    (async () => {
      try {
        // --- Step 1: Ensure we have an agent ---
        const authHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        };

        let resolvedAgentId = agentId;
        if (resolvedAgentId) {
          const res = await fetch('/api/agent-provision', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ existingAgentId: resolvedAgentId }),
          });
          if (!res.ok) resolvedAgentId = null;
        }
        if (!resolvedAgentId) {
          const res = await fetch('/api/agent-provision', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({}),
          });
          const data = res.ok ? await res.json() : null;
          if (data?.id) {
            resolvedAgentId = data.id;
            localStorage.setItem(AGENT_ID_KEY, data.id);
            setAgentId(data.id);
          }
        }
        if (!resolvedAgentId) {
          console.warn('[auth] Could not provision agent');
          return;
        }

        // --- Step 2: Resolve wallet (always use a real keypair-backed wallet) ---
        let resolvedWalletId = walletId;
        let resolvedWalletPk = walletPublicKey;

        if (resolvedWalletId && !resolvedWalletPk) {
          const res = await fetch('/api/wallet-provision', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ existingWalletId: resolvedWalletId }),
          });
          const data = res.ok ? await res.json() : null;
          if (data?.publicKey) {
            resolvedWalletPk = data.publicKey;
            localStorage.setItem(WALLET_PK_KEY, data.publicKey);
            setWalletPublicKey(data.publicKey);
          }
        }
        if (!resolvedWalletId) {
          const created = await provisionWallet(authHeaders, setWalletId, setWalletPublicKey);
          if (created) {
            resolvedWalletId = created.id;
            resolvedWalletPk = created.publicKey;
          }
        }

        // --- Step 3: Sync agent's walletId and clear stale conversation history ---
        if (resolvedAgentId && resolvedWalletId) {
          const previousWalletId = localStorage.getItem(WALLET_ID_KEY);
          const syncPromises: Promise<unknown>[] = [
            fetch('/api/agent-update', {
              method: 'PUT',
              headers: authHeaders,
              body: JSON.stringify({ agentId: resolvedAgentId, walletId: resolvedWalletId }),
            }).catch((err) => console.warn('[auth] agent-update failed:', err)),
          ];
          if (previousWalletId !== resolvedWalletId) {
            syncPromises.push(
              fetch('/api/agent-clear-state', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ agentId: resolvedAgentId }),
              }).catch((err) => console.warn('[auth] agent-clear-state failed:', err)),
            );
          }
          await Promise.all(syncPromises);
        }
      } catch (err) {
        console.warn('[auth] Auto-provisioning failed:', err);
      } finally {
        provisioningRef.current = false;
      }
    })();
  }, [apiKey, agentId, walletId, walletPublicKey]);

  const login = useCallback((key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    api.setApiKey(key);
    setApiKey(key);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AGENT_ID_KEY);
    localStorage.removeItem(WALLET_ID_KEY);
    localStorage.removeItem(WALLET_PK_KEY);
    localStorage.removeItem('solagent-extra-wallets');
    localStorage.removeItem('solagent-onboarded');
    api.setApiKey('');
    setApiKey(null);
    setAgentId(null);
    setWalletId(null);
    setWalletPublicKey(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        apiKey,
        agentId,
        walletId,
        walletPublicKey,
        isAuthenticated: !!apiKey,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
