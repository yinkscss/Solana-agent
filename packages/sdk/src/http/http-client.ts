import {
  NetworkError,
  TimeoutError,
  parseErrorResponse,
} from "./errors.js";

export interface HttpClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retries: number;
}

const DEFAULT_INITIAL_BACKOFF_MS = 500;
const BACKOFF_MULTIPLIER = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeout: number;
  private readonly retries: number;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.timeout = config.timeout;
    this.retries = config.retries;
    this.headers = { "Content-Type": "application/json" };

    if (config.apiKey) {
      this.headers["X-API-Key"] = config.apiKey;
    }
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) {
        await sleep(DEFAULT_INITIAL_BACKOFF_MS * BACKOFF_MULTIPLIER ** (attempt - 1));
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers: this.headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await parseErrorResponse(response, url);
          if (response.status >= 400 && response.status < 500) throw error;
          lastError = error;
          continue;
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          lastError = new TimeoutError(`Request timed out after ${this.timeout}ms: ${method} ${path}`);
          continue;
        }

        if (error instanceof TypeError) {
          lastError = new NetworkError(`Network error: ${error.message}`, {
            method,
            path,
          });
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new NetworkError("Request failed after retries");
  }
}
