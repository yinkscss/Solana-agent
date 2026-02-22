export interface Logger {
  info: (msg: string, data?: Record<string, unknown>) => void;
  warn: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
}

export const createLogger = (service: string): Logger => ({
  info: (msg, data) =>
    console.log(JSON.stringify({ level: "info", service, msg, ...data, ts: new Date().toISOString() })),
  warn: (msg, data) =>
    console.warn(JSON.stringify({ level: "warn", service, msg, ...data, ts: new Date().toISOString() })),
  error: (msg, data) =>
    console.error(JSON.stringify({ level: "error", service, msg, ...data, ts: new Date().toISOString() })),
});
