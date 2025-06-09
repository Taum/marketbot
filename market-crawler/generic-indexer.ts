/**
 * Generic Crawler class that manages a request queue
 */

import { delay } from '@common/utils/promise';
import throttledQueue from 'throttled-queue';

export interface IdentifiedRequest<T = any> {
  id: string;
  data: T;
}

export class TooManyRequestsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TooManyRequestsError";
  }
}
export abstract class GenericIndexer<Req = any, Data = any, Response = Data, Comp = any> {
  private queue: Req[] = [];
  private throttle: any;

  protected _completionValue: Comp;
  protected set completionValue(value: Comp) {
    this._completionValue = value;
  }
  protected get completionValue(): Comp {
    return this._completionValue;
  }

  private _waitForCompletionPromise: Promise<Comp> | null = null;
  private _waitForCompletionResolve: ((value: Comp) => void) | null = null;
  private _waitForCompletionReject: ((error: Error) => void) | null = null;
  private _isProcessing = false;

  constructor(
    initialCompletionValue: Comp,
    options: {
      concurrency?: number,
      maxOperationsPerWindow?: number,
      windowMs?: number,
      evenlySpaced?: boolean,
    } = {}
  ) {
    this._completionValue = initialCompletionValue;

    // Create throttle instance for rate limiting
    const maxOps = options.maxOperationsPerWindow || 60;
    const windowTime = options.windowMs || 60000;
    const evenlySpaced = options.evenlySpaced ?? true;
    this.throttle = throttledQueue(maxOps, windowTime, evenlySpaced);
  }

  public abstract fetch(request: Req): Promise<Response>;
  public abstract persist(data: Response, request: Req): Promise<void>;

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

  public waitForCompletion(): Promise<Comp> {
    if (!this._isProcessing) {
      return Promise.resolve(this.completionValue);
    }
    if (this._waitForCompletionPromise) {
      return this._waitForCompletionPromise;
    }
    this._waitForCompletionPromise = new Promise((resolve, reject) => {
      this._waitForCompletionResolve = resolve;
      this._waitForCompletionReject = reject;
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

      let retries = 0
      while (true) {
        try {
          await this.throttle(async () => {
            // Process the request
            const response = await this.fetch(request);
            // Persist the data if a persist function is provided
            await this.persist(response, request);
          })
          break;
        } catch (error) {
          console.error(`Error processing request ${JSON.stringify(request)} (retry=${retries}):`, error);
          if (retries >= 3) {
            this._isProcessing = false;
            this._waitForCompletionReject?.(error);
            return;
          }
          if (error instanceof TooManyRequestsError) {
            await delay(15000)
          } else {
            await delay(5000)
          }
          retries += 1
        }
      }
    }

    this._isProcessing = false;
    this._waitForCompletionResolve?.(this.completionValue);
  }
} 