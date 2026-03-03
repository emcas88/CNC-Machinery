// F27 – useGlobalError tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StandaloneGlobalErrorStore,
  createGlobalErrorStore,
  DEFAULT_DURATIONS,
  generateToastId,
  type GlobalErrorState,
  type Toast,
} from './useGlobalError';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeStore(): StandaloneGlobalErrorStore {
  return new StandaloneGlobalErrorStore();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StandaloneGlobalErrorStore', () => {
  // Test 1
  it('starts with empty toasts', () => {
    const store = makeStore();
    expect(store.toasts).toEqual([]);
  });

  // Test 2
  it('adds a toast with addToast', () => {
    const store = makeStore();
    const id = store.addToast({ type: 'info', title: 'Hello' });
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].id).toBe(id);
    expect(store.toasts[0].title).toBe('Hello');
    expect(store.toasts[0].type).toBe('info');
  });

  // Test 3
  it('generates unique IDs', () => {
    const id1 = generateToastId();
    const id2 = generateToastId();
    expect(id1).not.toBe(id2);
  });

  // Test 4
  it('sets default duration based on type', () => {
    const store = makeStore();
    store.addToast({ type: 'error', title: 'Err' });
    expect(store.toasts[0].duration).toBe(DEFAULT_DURATIONS.error);
  });

  // Test 5
  it('allows custom duration', () => {
    const store = makeStore();
    store.addToast({ type: 'info', title: 'Quick', duration: 1000 });
    expect(store.toasts[0].duration).toBe(1000);
  });

  // Test 6
  it('removes a toast by ID', () => {
    const store = makeStore();
    const id = store.addToast({ type: 'info', title: 'Remove me' });
    store.removeToast(id);
    expect(store.toasts).toHaveLength(0);
  });

  // Test 7
  it('clears all toasts', () => {
    const store = makeStore();
    store.addToast({ type: 'info', title: 'A' });
    store.addToast({ type: 'error', title: 'B' });
    store.clearAllToasts();
    expect(store.toasts).toHaveLength(0);
  });

  // Test 8
  it('limits to maxToasts', () => {
    const store = makeStore();
    store.maxToasts = 3;
    for (let i = 0; i < 5; i++) {
      store.addToast({ type: 'info', title: `Toast ${i}` });
    }
    expect(store.toasts).toHaveLength(3);
    // Oldest should be trimmed
    expect(store.toasts[0].title).toBe('Toast 2');
  });

  // Test 9
  it('success() creates a success toast', () => {
    const store = makeStore();
    store.success('Saved');
    expect(store.toasts[0].type).toBe('success');
    expect(store.toasts[0].title).toBe('Saved');
  });

  // Test 10
  it('error() creates an error toast', () => {
    const store = makeStore();
    store.error('Failed', 'Something went wrong');
    expect(store.toasts[0].type).toBe('error');
    expect(store.toasts[0].message).toBe('Something went wrong');
  });

  // Test 11
  it('warning() creates a warning toast', () => {
    const store = makeStore();
    store.warning('Caution', 'Check input');
    expect(store.toasts[0].type).toBe('warning');
  });

  // Test 12
  it('info() creates an info toast', () => {
    const store = makeStore();
    store.info('FYI', 'New update');
    expect(store.toasts[0].type).toBe('info');
  });

  // Test 13
  it('notifies subscribers on add', () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.addToast({ type: 'info', title: 'X' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // Test 14
  it('notifies subscribers on remove', () => {
    const store = makeStore();
    const id = store.addToast({ type: 'info', title: 'X' });
    const listener = vi.fn();
    store.subscribe(listener);
    store.removeToast(id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // Test 15
  it('unsubscribe stops notifications', () => {
    const store = makeStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.addToast({ type: 'info', title: 'X' });
    expect(listener).not.toHaveBeenCalled();
  });

  // Test 16
  it('sets dismissible to true by default', () => {
    const store = makeStore();
    store.addToast({ type: 'info', title: 'X' });
    expect(store.toasts[0].dismissible).toBe(true);
  });

  // Test 17
  it('allows non-dismissible toasts', () => {
    const store = makeStore();
    store.addToast({ type: 'error', title: 'Sticky', dismissible: false });
    expect(store.toasts[0].dismissible).toBe(false);
  });

  // Test 18
  it('stores createdAt timestamp', () => {
    const now = Date.now();
    const store = makeStore();
    store.addToast({ type: 'info', title: 'Timed' });
    expect(store.toasts[0].createdAt).toBeGreaterThanOrEqual(now);
  });

  // Test 19
  it('stores action on toast', () => {
    const store = makeStore();
    const action = { label: 'Undo', onClick: vi.fn() };
    store.addToast({ type: 'success', title: 'Deleted', action });
    expect(store.toasts[0].action).toEqual(action);
  });
});

// ---------------------------------------------------------------------------
// createGlobalErrorStore tests (Zustand-compatible factory)
// ---------------------------------------------------------------------------

describe('createGlobalErrorStore', () => {
  // Test 20
  it('creates a store with correct initial state', () => {
    let state: GlobalErrorState | null = null;
    const set = vi.fn((fn: any) => {
      if (state) {
        const partial = fn(state);
        state = { ...state, ...partial };
      }
    });
    const get = vi.fn(() => state!);

    state = createGlobalErrorStore(set, get);
    expect(state.toasts).toEqual([]);
    expect(state.maxToasts).toBe(5);
  });

  // Test 21
  it('addToast calls set with new toast', () => {
    let state: GlobalErrorState;
    const set = vi.fn((fn: any) => {
      const partial = fn(state);
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);

    state = createGlobalErrorStore(set, get);
    state.addToast({ type: 'info', title: 'Test' });
    expect(set).toHaveBeenCalled();
  });
});
