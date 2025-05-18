/**
 * Generic Crawler class that manages a request queue
 */

import throttledQueue from 'throttled-queue';

export interface IdentifiedRequest<T = any> {
  id: string;
  data: T;
}

export type FetchFunction<Req = any, Data = any> = (request: Req) => Promise<Data>;
export type PersistFunction<Req = any, Data = any> = (data: Data, request: Req) => Promise<void>;

export class GenericIndexer<Req = any, Data = any> {
  private queue: Req[] = [];
  private fetchFn: FetchFunction<Req, Data>;
  private persistFn: PersistFunction<Req, Data>;
  private throttle: any;

  private _waitForCompletionPromise: Promise<void> | null = null;
  private _waitForCompletionResolve: (value: void) => void | null = null;
  private _isProcessing = false;

  constructor(
    fetch: FetchFunction<Req, Data>,
    persist: PersistFunction<Req, Data>,
    options: {
      concurrency?: number,
      maxOperationsPerWindow?: number,
      windowMs?: number
    } = {}
  ) {
    this.fetchFn = fetch;
    this.persistFn = persist;

    // Create throttle instance for rate limiting
    const maxOps = options.maxOperationsPerWindow || 60;
    const windowTime = options.windowMs || 60000;
    this.throttle = throttledQueue(maxOps, windowTime, true);
  }

  /**
   * Add multiple requests to the queue
   * @param requests The requests to add
   * @param toFront If true, add to the front of the queue, otherwise add to the back
   */
  public addRequests(requests: Req[], toFront = false): void {
    if (requests.length === 0) return;

    if (toFront) {
      this.queue.unshift(...requests);
    } else {
      this.queue.push(...requests);
    }

    // Start processing the queue if it's not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Start processing the queue
   */
  public start(): void {
    this.processQueue();
  }

  public waitForCompletion(): Promise<void> {
    if (!this._isProcessing) {
      return Promise.resolve();
    }
    if (this._waitForCompletionPromise) {
      return this._waitForCompletionPromise;
    }
    this._waitForCompletionPromise = new Promise((resolve) => {
      this._waitForCompletionResolve = resolve;
    });
    return this._waitForCompletionPromise;
  }

  public get isProcessing(): boolean {
    return this._isProcessing;
  }

  /**
   * Get the number of requests in the queue
   */
  public get queueSize(): number {
    return this.queue.length;
  }

  /**
   * Process the next item in the queue
   */
  private async processQueue(): Promise<void> {
    // Don't process if paused or already at max concurrency
    if (this._isProcessing) {
      return;
    }
    this._isProcessing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) break;

      await this.throttle(async () => {
        try {
          // Process the request
          const data = await this.fetchFn(request);
          // Persist the data if a persist function is provided
          await this.persistFn(data, request);
        } catch (error) {
          console.error(`Error processing request:`, error);
        } finally {
          // Continue processing the queue
          this.processQueue();
        }
      })
    }

    this._isProcessing = false;
    this._waitForCompletionResolve?.();
  }
} 