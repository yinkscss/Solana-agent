import type { KoraClient } from './client.js';

export type BalanceStatus = 'ok' | 'warning' | 'critical';

export interface BalanceCheckResult {
  balance: number;
  status: BalanceStatus;
}

export interface BalanceMonitorConfig {
  koraClient: KoraClient;
  warningThresholdSol?: number;
  criticalThresholdSol?: number;
  checkIntervalMs?: number;
  onWarning?: (balance: number) => void;
  onCritical?: (balance: number) => void;
}

const DEFAULT_WARNING_THRESHOLD = 2;
const DEFAULT_CRITICAL_THRESHOLD = 0.5;
const DEFAULT_CHECK_INTERVAL_MS = 60_000;

const classifyBalance = (balance: number, warning: number, critical: number): BalanceStatus => {
  if (balance <= critical) return 'critical';
  if (balance <= warning) return 'warning';
  return 'ok';
};

export class FeeRelayerMonitor {
  private intervalId?: ReturnType<typeof setInterval>;
  private readonly warningThreshold: number;
  private readonly criticalThreshold: number;
  private readonly checkIntervalMs: number;
  private readonly koraClient: KoraClient;
  private readonly onWarning?: (balance: number) => void;
  private readonly onCritical?: (balance: number) => void;

  constructor(config: BalanceMonitorConfig) {
    this.koraClient = config.koraClient;
    this.warningThreshold = config.warningThresholdSol ?? DEFAULT_WARNING_THRESHOLD;
    this.criticalThreshold = config.criticalThresholdSol ?? DEFAULT_CRITICAL_THRESHOLD;
    this.checkIntervalMs = config.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
    this.onWarning = config.onWarning;
    this.onCritical = config.onCritical;
  }

  start = (): void => {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => void this.runCheck(), this.checkIntervalMs);
    void this.runCheck();
  };

  stop = (): void => {
    if (!this.intervalId) return;
    clearInterval(this.intervalId);
    this.intervalId = undefined;
  };

  checkBalance = async (): Promise<BalanceCheckResult> => {
    const balance = await this.koraClient.getFeePayerBalance();
    const status = classifyBalance(balance, this.warningThreshold, this.criticalThreshold);
    return { balance, status };
  };

  private runCheck = async (): Promise<void> => {
    try {
      const { balance, status } = await this.checkBalance();
      if (status === 'critical') this.onCritical?.(balance);
      else if (status === 'warning') this.onWarning?.(balance);
    } catch {
      // Monitoring should not throw — health failures are surfaced via callbacks
    }
  };
}
