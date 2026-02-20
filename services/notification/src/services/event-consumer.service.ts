import type { NotificationEvent } from '../types/index.js';

export type EventHandler = (event: NotificationEvent) => Promise<void>;

export class EventConsumer {
  private handlers: EventHandler[] = [];
  private running = false;

  onEvent(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  async start(): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async pushEvent(event: NotificationEvent): Promise<void> {
    if (!this.running) return;
    await Promise.allSettled(this.handlers.map((h) => h(event)));
  }
}
