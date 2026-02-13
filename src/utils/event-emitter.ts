/**
 * A simple typed event emitter for decoupled component communication.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler<T = any> = (payload: T) => void;

/**
 * Typed event emitter that provides publish/subscribe functionality.
 * 
 * @example
 * ```typescript
 * interface AppEvents {
 *   'file:upload': { files: File[] };
 *   'document:select': { documentId: string };
 *   'settings:change': void;
 * }
 * 
 * const events = new EventEmitter<AppEvents>();
 * events.on('file:upload', ({ files }) => console.log(files));
 * events.emit('file:upload', { files: [...] });
 * ```
 */
export class EventEmitter<TEvents extends { [K in keyof TEvents]: unknown }> {
  private readonly handlers = new Map<keyof TEvents, Set<EventHandler>>();

  /**
   * Subscribe to an event.
   * @returns Unsubscribe function
   */
  on<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Subscribe to an event, but only fire once.
   */
  once<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): () => void {
    const wrappedHandler = ((payload: TEvents[K]) => {
      this.off(event, wrappedHandler);
      handler(payload);
    }) as EventHandler<TEvents[K]>;

    return this.on(event, wrappedHandler);
  }

  /**
   * Unsubscribe from an event.
   */
  off<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers.
   */
  emit<K extends keyof TEvents>(
    event: K,
    ...args: TEvents[K] extends void ? [] : [payload: TEvents[K]]
  ): void {
    const handlers = this.handlers.get(event);
    if (!handlers) {
      return;
    }

    const payload = args[0];
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error in event handler for "${String(event)}":`, error);
      }
    }
  }

  /**
   * Remove all handlers for an event, or all handlers if no event specified.
   */
  clear(event?: keyof TEvents): void {
    if (event !== undefined) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Get the number of handlers for an event.
   */
  listenerCount(event: keyof TEvents): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}
