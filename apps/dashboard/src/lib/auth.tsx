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
  walletId: string | null;
  walletPublicKey: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (key: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'solagent_api_key';
const WALLET_ID_KEY = 'solagent_wallet_id';
const WALLET_PK_KEY = 'solagent_wallet_public_key';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
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
    const storedWalletId = localStorage.getItem(WALLET_ID_KEY);
    const storedWalletPk = localStorage.getItem(WALLET_PK_KEY);
    if (storedWalletId) setWalletId(storedWalletId);
    if (storedWalletPk) setWalletPublicKey(storedWalletPk);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!apiKey || provisioningRef.current) return;

    if (walletId && walletPublicKey) return;

    provisioningRef.current = true;

    const resolvePublicKey = async () => {
      const res = await fetch('/api/wallet-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingWalletId: walletId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.publicKey) return;
      localStorage.setItem(WALLET_PK_KEY, data.publicKey);
      setWalletPublicKey(data.publicKey);
    };

    const provisionNewWallet = async () => {
      const res = await fetch('/api/wallet-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'My Wallet' }),
      });
      if (!res.ok) throw new Error(`Provision failed: ${res.status}`);
      const data = await res.json();
      if (!data.id) return;
      localStorage.setItem(WALLET_ID_KEY, data.id);
      if (data.publicKey) localStorage.setItem(WALLET_PK_KEY, data.publicKey);
      setWalletId(data.id);
      setWalletPublicKey(data.publicKey || null);
    };

    (async () => {
      try {
        if (walletId && !walletPublicKey) {
          await resolvePublicKey().catch(() => {});
          return;
        }
        if (walletId) return;
        await provisionNewWallet();
      } catch (err) {
        console.warn('[auth] Auto-wallet provisioning failed:', err);
      } finally {
        provisioningRef.current = false;
      }
    })();
  }, [apiKey, walletId, walletPublicKey]);

  const login = useCallback((key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    api.setApiKey(key);
    setApiKey(key);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(WALLET_ID_KEY);
    localStorage.removeItem(WALLET_PK_KEY);
    api.setApiKey('');
    setApiKey(null);
    setWalletId(null);
    setWalletPublicKey(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        apiKey,
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
