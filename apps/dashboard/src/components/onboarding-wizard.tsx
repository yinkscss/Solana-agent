'use client';

import { useState } from 'react';
import { Hexagon, Droplets, Wallet, ArrowRight, Check, Sparkles, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { truncateAddress } from '@/lib/format';
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard';

const SOLANA_FAUCET_URL = 'https://faucet.solana.com';

export interface OnboardingWizardProps {
  walletPublicKey: string | null;
  agentName: string;
  onComplete: () => void;
  onSendMessage: (msg: string) => void;
}

function getFaucetUrl(walletPublicKey: string): string {
  return `${SOLANA_FAUCET_URL}/?address=${walletPublicKey}&network=devnet`;
}

export function OnboardingWizard({
  walletPublicKey,
  agentName,
  onComplete,
  onSendMessage,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [faucetOpened, setFaucetOpened] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  const stepTitles = ['Welcome to SolAgent!', 'Check Your Balance', "You're All Set!"];

  const handleGetSol = () => {
    if (walletPublicKey) {
      window.open(getFaucetUrl(walletPublicKey), '_blank', 'noopener,noreferrer');
      setFaucetOpened(true);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div
        className="w-full max-w-lg space-y-6 text-center transition-all duration-300 ease-out"
        style={{
          opacity: 1,
          transform: 'translateY(0)',
        }}
      >
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center rounded-full bg-violet-500/10 p-4">
            <Hexagon className="h-8 w-8 text-violet-400" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {stepTitles[step]}
          </h1>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">Your wallet is ready:</p>
            {walletPublicKey && (
              <button
                type="button"
                onClick={() => walletPublicKey && copy(walletPublicKey)}
                className="mx-auto flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-1.5 transition-colors hover:bg-accent"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                <span className="text-sm font-mono font-medium text-foreground">
                  {truncateAddress(walletPublicKey)}
                </span>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              First, let&apos;s get some free test SOL to play with.
            </p>

            <Card className="gap-0 border-violet-500/30 bg-violet-500/5 text-left">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-violet-400">
                  <Droplets className="h-4 w-4" />
                  Get Free Test SOL
                </div>
                <p className="text-xs text-muted-foreground">Opens Solana faucet in new tab</p>
                {faucetOpened ? (
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700"
                    onClick={() => setStep(1)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Done! Next →
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700"
                    onClick={handleGetSol}
                  >
                    Get SOL
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
            >
              I already have SOL →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Let&apos;s verify the SOL arrived in your wallet.
            </p>

            <Card className="gap-0 border-violet-500/30 bg-violet-500/5 text-left">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-violet-400">
                  <Wallet className="h-4 w-4" />
                  Check Balance
                </div>
                <p className="text-xs text-muted-foreground">See what&apos;s in your wallet</p>
                <Button
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700"
                  onClick={() => {
                    onSendMessage("What's my balance?");
                    setStep(2);
                  }}
                >
                  Check Balance
                </Button>
              </CardContent>
            </Card>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Skip →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">You can now:</p>
            <ul className="text-sm text-muted-foreground leading-relaxed text-left list-disc list-inside mx-auto max-w-xs space-y-1">
              <li>Send SOL to anyone</li>
              <li>Swap tokens</li>
              <li>Check balances anytime</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Just type what you need — {agentName} will help you out.
            </p>

            <Button
              size="lg"
              className="bg-violet-600 hover:bg-violet-700 gap-2"
              onClick={onComplete}
            >
              <Sparkles className="h-4 w-4" />
              Start Chatting →
            </Button>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-2">
          <span className="text-xs text-muted-foreground">Step {step + 1} of 3</span>
          <div className="flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i <= step ? 'bg-violet-500' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
