import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventDispatcher } from '../../app/events/EventDispatcher';
import { Event } from '../../app/events/Event';

class TestEvent extends Event<{ message: string }> {
  constructor(message: string) {
    super('test.event', { message });
  }
}

class AnotherEvent extends Event<{ count: number }> {
  constructor(count: number) {
    super('another.event', { count });
  }
}

describe('EventDispatcher', () => {
  let dispatcher: EventDispatcher;

  beforeEach(() => {
    dispatcher = new EventDispatcher();
  });

  describe('on / emit', () => {
    it('calls registered listener when event is emitted', async () => {
      const handler = vi.fn();
      dispatcher.on(TestEvent, handler);

      await dispatcher.emit(new TestEvent('hello'));
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].payload.message).toBe('hello');
    });

    it('calls multiple listeners for the same event', async () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      dispatcher.on(TestEvent, h1);
      dispatcher.on(TestEvent, h2);

      await dispatcher.emit(new TestEvent('hi'));
      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });

    it('does not call listener for different event', async () => {
      const handler = vi.fn();
      dispatcher.on(AnotherEvent, handler);

      await dispatcher.emit(new TestEvent('hello'));
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns unsubscribe function', async () => {
      const handler = vi.fn();
      const unsubscribe = dispatcher.on(TestEvent, handler);

      unsubscribe();
      await dispatcher.emit(new TestEvent('hello'));
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('calls listener only once', async () => {
      const handler = vi.fn();
      dispatcher.once(TestEvent, handler);

      await dispatcher.emit(new TestEvent('first'));
      await dispatcher.emit(new TestEvent('second'));
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('off', () => {
    it('removes a specific listener', async () => {
      const handler = vi.fn();
      dispatcher.on(TestEvent, handler);
      dispatcher.off(TestEvent, handler);

      await dispatcher.emit(new TestEvent('hello'));
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onAny (wildcard)', () => {
    it('receives all emitted events', async () => {
      const wildcard = vi.fn();
      dispatcher.onAny(wildcard);

      await dispatcher.emit(new TestEvent('hello'));
      await dispatcher.emit(new AnotherEvent(42));
      expect(wildcard).toHaveBeenCalledTimes(2);
    });

    it('returns unsubscribe function', async () => {
      const wildcard = vi.fn();
      const unsubscribe = dispatcher.onAny(wildcard);
      unsubscribe();

      await dispatcher.emit(new TestEvent('hello'));
      expect(wildcard).not.toHaveBeenCalled();
    });
  });

  describe('stopPropagation', () => {
    it('stops subsequent listeners when propagation is stopped', async () => {
      const h1 = vi.fn((event: TestEvent) => event.stopPropagation());
      const h2 = vi.fn();
      dispatcher.on(TestEvent, h1);
      dispatcher.on(TestEvent, h2);

      await dispatcher.emit(new TestEvent('stop'));
      expect(h1).toHaveBeenCalledOnce();
      expect(h2).not.toHaveBeenCalled();
    });
  });

  describe('class-based listeners', () => {
    it('calls handle() method on class-based listener', async () => {
      const handleFn = vi.fn();
      const listener = { handle: handleFn };
      dispatcher.on(TestEvent, listener);

      await dispatcher.emit(new TestEvent('class'));
      expect(handleFn).toHaveBeenCalledOnce();
    });
  });

  describe('listenerCount / hasListeners', () => {
    it('returns correct listener count', () => {
      expect(dispatcher.listenerCount(TestEvent)).toBe(0);
      const h1 = vi.fn();
      const h2 = vi.fn();
      dispatcher.on(TestEvent, h1);
      dispatcher.on(TestEvent, h2);
      expect(dispatcher.listenerCount(TestEvent)).toBe(2);
    });

    it('hasListeners returns false when no listeners', () => {
      expect(dispatcher.hasListeners(TestEvent)).toBe(false);
    });

    it('hasListeners returns true when listeners registered', () => {
      dispatcher.on(TestEvent, vi.fn());
      expect(dispatcher.hasListeners(TestEvent)).toBe(true);
    });
  });

  describe('removeAllListeners', () => {
    it('removes listeners for specific event', async () => {
      const h = vi.fn();
      dispatcher.on(TestEvent, h);
      dispatcher.removeAllListeners(TestEvent);

      await dispatcher.emit(new TestEvent('hello'));
      expect(h).not.toHaveBeenCalled();
    });

    it('removes all listeners for all events', async () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      dispatcher.on(TestEvent, h1);
      dispatcher.on(AnotherEvent, h2);
      dispatcher.removeAllListeners();

      await dispatcher.emit(new TestEvent('hello'));
      await dispatcher.emit(new AnotherEvent(1));
      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });
  });
});
