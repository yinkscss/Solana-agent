type Labels = Record<string, string>;

function labelsKey(labels: Labels): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
}

export class Counter {
  readonly name: string;
  readonly help: string;
  private readonly values = new Map<string, number>();

  constructor(opts: { name: string; help: string }) {
    this.name = opts.name;
    this.help = opts.help;
  }

  inc(labels: Labels = {}, value = 1): void {
    const key = labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  get(labels: Labels = {}): number {
    return this.values.get(labelsKey(labels)) ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  collect(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const [key, value] of this.values) {
      const suffix = key ? `{${key}}` : "";
      lines.push(`${this.name}${suffix} ${value}`);
    }
    return lines.join("\n");
  }
}

export class Gauge {
  readonly name: string;
  readonly help: string;
  private readonly values = new Map<string, number>();

  constructor(opts: { name: string; help: string }) {
    this.name = opts.name;
    this.help = opts.help;
  }

  set(labels: Labels, value: number): void;
  set(value: number): void;
  set(labelsOrValue: Labels | number, maybeValue?: number): void {
    if (typeof labelsOrValue === "number") {
      this.values.set("", labelsOrValue);
    } else {
      this.values.set(labelsKey(labelsOrValue), maybeValue!);
    }
  }

  inc(labels: Labels = {}, value = 1): void {
    const key = labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  dec(labels: Labels = {}, value = 1): void {
    const key = labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) - value);
  }

  get(labels: Labels = {}): number {
    return this.values.get(labelsKey(labels)) ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  collect(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    for (const [key, value] of this.values) {
      const suffix = key ? `{${key}}` : "";
      lines.push(`${this.name}${suffix} ${value}`);
    }
    return lines.join("\n");
  }
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export class Histogram {
  readonly name: string;
  readonly help: string;
  private readonly buckets: number[];
  private readonly data = new Map<string, { buckets: number[]; sum: number; count: number }>();

  constructor(opts: { name: string; help: string; buckets?: number[] }) {
    this.name = opts.name;
    this.help = opts.help;
    this.buckets = opts.buckets ?? DEFAULT_BUCKETS;
  }

  observe(labels: Labels, value: number): void;
  observe(value: number): void;
  observe(labelsOrValue: Labels | number, maybeValue?: number): void {
    let key: string;
    let value: number;
    if (typeof labelsOrValue === "number") {
      key = "";
      value = labelsOrValue;
    } else {
      key = labelsKey(labelsOrValue);
      value = maybeValue!;
    }

    let entry = this.data.get(key);
    if (!entry) {
      entry = { buckets: new Array(this.buckets.length).fill(0), sum: 0, count: 0 };
      this.data.set(key, entry);
    }

    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        entry.buckets[i]++;
      }
    }
    entry.sum += value;
    entry.count++;
  }

  reset(): void {
    this.data.clear();
  }

  collect(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];

    for (const [key, entry] of this.data) {
      const labelPrefix = key ? `{${key},` : "{";
      const labelClose = key ? "}" : "}";

      for (let i = 0; i < this.buckets.length; i++) {
        lines.push(`${this.name}_bucket${labelPrefix}le="${this.buckets[i]}"${labelClose} ${entry.buckets[i]}`);
      }
      lines.push(`${this.name}_bucket${labelPrefix}le="+Inf"${labelClose} ${entry.count}`);

      const sumSuffix = key ? `{${key}}` : "";
      lines.push(`${this.name}_sum${sumSuffix} ${entry.sum}`);
      lines.push(`${this.name}_count${sumSuffix} ${entry.count}`);
    }

    return lines.join("\n");
  }
}

class MetricsRegistry {
  private readonly collectors: Array<Counter | Gauge | Histogram> = [];

  register<T extends Counter | Gauge | Histogram>(metric: T): T {
    this.collectors.push(metric);
    return metric;
  }

  collect(): string {
    return this.collectors.map((c) => c.collect()).filter(Boolean).join("\n\n") + "\n";
  }

  reset(): void {
    this.collectors.forEach((c) => c.reset());
  }
}

export const registry = new MetricsRegistry();

export const httpRequestsTotal = registry.register(
  new Counter({ name: "http_requests_total", help: "Total HTTP requests" }),
);

export const httpRequestDuration = registry.register(
  new Histogram({ name: "http_request_duration_seconds", help: "HTTP request duration in seconds" }),
);

export const policyEvalDuration = registry.register(
  new Histogram({
    name: "policy_eval_duration_seconds",
    help: "Policy evaluation duration in seconds",
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
  }),
);

export const txSigningDuration = registry.register(
  new Histogram({
    name: "tx_signing_duration_seconds",
    help: "Transaction signing duration in seconds",
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  }),
);

export const activeAgentsTotal = registry.register(
  new Gauge({ name: "active_agents_total", help: "Number of active agents" }),
);

export const activeWsConnections = registry.register(
  new Gauge({ name: "active_ws_connections", help: "Number of active WebSocket connections" }),
);
