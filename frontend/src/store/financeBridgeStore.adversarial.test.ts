import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useFinanceBridgeStore,
  dispatchFinanceAction,
  type Wallet,
  type FinanceActionType
} from './financeBridgeStore';

describe('Adversarial Verification: Modal Triggers, Wallet Sync, Action Replay & Fallback', () => {
  let mockWindow: EventTarget & Record<string, any>;
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    useFinanceBridgeStore.getState().reset();
    vi.restoreAllMocks();

    // Create browser window mock on Node 22 global
    mockWindow = new EventTarget() as any;
    mockWindow.dispatchEvent = mockWindow.dispatchEvent.bind(mockWindow);
    mockWindow.addEventListener = mockWindow.addEventListener.bind(mockWindow);
    mockWindow.removeEventListener = mockWindow.removeEventListener.bind(mockWindow);

    (globalThis as any).window = mockWindow;
  });

  afterEach(() => {
    if (originalWindow !== undefined) {
      (globalThis as any).window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
  });

  // ==========================================================================
  // TASK 1.1: Verify Header action buttons dispatch CustomEvent 'oaktree:finance-action'
  // ==========================================================================
  describe('1.1 Modal Triggers via CustomEvent dispatch', () => {
    it('dispatches CustomEvent "oaktree:finance-action" with { action: "add-tx" }', () => {
      const receivedEvents: any[] = [];
      const handler = (e: Event) => {
        receivedEvents.push((e as CustomEvent).detail);
      };

      window.addEventListener('oaktree:finance-action', handler);

      // Trigger Add Transaction
      dispatchFinanceAction('add-tx');

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual({ action: 'add-tx' });

      window.removeEventListener('oaktree:finance-action', handler);
    });

    it('dispatches CustomEvent "oaktree:finance-action" with { action: "ai-scan" }', () => {
      const receivedEvents: any[] = [];
      const handler = (e: Event) => {
        receivedEvents.push((e as CustomEvent).detail);
      };

      window.addEventListener('oaktree:finance-action', handler);

      // Trigger AI Scanner
      dispatchFinanceAction('ai-scan');

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual({ action: 'ai-scan' });

      window.removeEventListener('oaktree:finance-action', handler);
    });

    it('dispatches CustomEvent "oaktree:finance-action" with { action: "csv-import" }', () => {
      const receivedEvents: any[] = [];
      const handler = (e: Event) => {
        receivedEvents.push((e as CustomEvent).detail);
      };

      window.addEventListener('oaktree:finance-action', handler);

      // Trigger CSV Import
      dispatchFinanceAction('csv-import');

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual({ action: 'csv-import' });

      window.removeEventListener('oaktree:finance-action', handler);
    });

    it('handles multiple sequential action button clicks cleanly without dropped events', () => {
      const actions: FinanceActionType[] = ['add-tx', 'ai-scan', 'csv-import', 'add-tx'];
      const receivedActions: string[] = [];

      const handler = (e: Event) => {
        receivedActions.push((e as CustomEvent).detail?.action);
      };

      window.addEventListener('oaktree:finance-action', handler);

      actions.forEach((act) => dispatchFinanceAction(act));

      expect(receivedActions).toEqual(actions);

      window.removeEventListener('oaktree:finance-action', handler);
    });

    it('SSR safe guard: returns cleanly when window is undefined without throwing', () => {
      delete (globalThis as any).window;

      expect(() => {
        dispatchFinanceAction('add-tx');
      }).not.toThrow();

      expect(useFinanceBridgeStore.getState().pendingAction).toBeNull();
    });
  });

  // ==========================================================================
  // TASK 1.2: Action Buffering & Unmounted Queue Replay
  // ==========================================================================
  describe('1.2 Action Buffering & Unmounted Queue Replay', () => {
    it('buffers action in store when remote is unmounted', () => {
      // Prior to remote mount, user clicks "+ Add"
      dispatchFinanceAction('add-tx');

      // Store must retain the pending action
      expect(useFinanceBridgeStore.getState().pendingAction).toBe('add-tx');
    });

    it('replays pending action when remote container mounts and consumes it', () => {
      // 1. User clicks "+ Add" before remote is mounted
      dispatchFinanceAction('add-tx');
      expect(useFinanceBridgeStore.getState().pendingAction).toBe('add-tx');

      // 2. Remote mounts and attaches listener
      const replayedEvents: any[] = [];
      const remoteListener = (e: Event) => {
        replayedEvents.push((e as CustomEvent).detail);
      };
      window.addEventListener('oaktree:finance-action', remoteListener);

      // 3. Simulate RemoteFinanceContainer mount effect:
      const pending = useFinanceBridgeStore.getState().consumePendingAction();
      expect(pending).toBe('add-tx');
      // Verify pendingAction is cleared immediately to prevent duplicate replay
      expect(useFinanceBridgeStore.getState().pendingAction).toBeNull();

      if (pending) {
        window.dispatchEvent(new CustomEvent('oaktree:finance-action', { detail: { action: pending } }));
      }

      // 4. Remote listener receives the replayed action
      expect(replayedEvents).toHaveLength(1);
      expect(replayedEvents[0]).toEqual({ action: 'add-tx' });

      // 5. Subsequent consume returns null
      const secondConsume = useFinanceBridgeStore.getState().consumePendingAction();
      expect(secondConsume).toBeNull();

      window.removeEventListener('oaktree:finance-action', remoteListener);
    });

    it('returns null and dispatches nothing when no pending action was queued', () => {
      const events: any[] = [];
      const listener = (e: Event) => {
        events.push((e as CustomEvent).detail);
      };
      window.addEventListener('oaktree:finance-action', listener);

      const pending = useFinanceBridgeStore.getState().consumePendingAction();
      expect(pending).toBeNull();
      expect(events).toHaveLength(0);

      window.removeEventListener('oaktree:finance-action', listener);
    });

    it('buffers latest action if user clicks multiple buttons before remote mounts', () => {
      dispatchFinanceAction('add-tx');
      dispatchFinanceAction('csv-import');
      dispatchFinanceAction('ai-scan');

      expect(useFinanceBridgeStore.getState().pendingAction).toBe('ai-scan');

      const consumed = useFinanceBridgeStore.getState().consumePendingAction();
      expect(consumed).toBe('ai-scan');
      expect(useFinanceBridgeStore.getState().pendingAction).toBeNull();
    });
  });

  // ==========================================================================
  // TASK 1.3: Wallet List Synchronization
  // ==========================================================================
  describe('1.3 Wallet List Synchronization', () => {
    it('synchronizes wallet list from remote into host store', () => {
      const mockWallets: Wallet[] = [
        { id: 'wal_kbank', name: 'Kasikorn Bank', currency: 'THB', balance: 50000, color: '#10b981' },
        { id: 'wal_scb', name: 'SCB Easy', currency: 'THB', balance: 25000, color: '#6366f1' },
        { id: 'wal_binance', name: 'Binance USD', currency: 'USD', balance: 1500, color: '#f59e0b' },
      ];

      expect(useFinanceBridgeStore.getState().wallets).toEqual([]);

      // Remote invokes onWalletsSync -> store.setWallets
      useFinanceBridgeStore.getState().setWallets(mockWallets);

      const updatedWallets = useFinanceBridgeStore.getState().wallets;
      expect(updatedWallets).toHaveLength(3);
      expect(updatedWallets[0].id).toBe('wal_kbank');
      expect(updatedWallets[0].name).toBe('Kasikorn Bank');
      expect(updatedWallets[1].id).toBe('wal_scb');
      expect(updatedWallets[2].currency).toBe('USD');
    });

    it('handles empty wallet list ([]) gracefully', () => {
      useFinanceBridgeStore.getState().setWallets([]);
      expect(useFinanceBridgeStore.getState().wallets).toEqual([]);
      expect(useFinanceBridgeStore.getState().selectedWalletId).toBe('all');
    });

    it('sanitizes non-array or malformed wallet inputs without throwing', () => {
      useFinanceBridgeStore.getState().setWallets(null as any);
      expect(useFinanceBridgeStore.getState().wallets).toEqual([]);

      useFinanceBridgeStore.getState().setWallets(undefined as any);
      expect(useFinanceBridgeStore.getState().wallets).toEqual([]);

      useFinanceBridgeStore.getState().setWallets('invalid' as any);
      expect(useFinanceBridgeStore.getState().wallets).toEqual([]);
    });
  });

  // ==========================================================================
  // TASK 1.4: Wallet Deletion & Automatic Fallback to 'all'
  // ==========================================================================
  describe('1.4 Wallet Deletion Fallback (F-11-B5)', () => {
    const initialWallets: Wallet[] = [
      { id: 'wal_kbank', name: 'Kasikorn Bank', currency: 'THB', balance: 50000 },
      { id: 'wal_scb', name: 'SCB Easy', currency: 'THB', balance: 25000 },
      { id: 'wal_crypto', name: 'Binance', currency: 'USD', balance: 1000 },
    ];

    it('automatically resets selectedWalletId to "all" when the currently selected wallet is deleted', () => {
      const store = useFinanceBridgeStore.getState();
      store.setWallets(initialWallets);
      store.setSelectedWalletId('wal_scb');
      expect(useFinanceBridgeStore.getState().selectedWalletId).toBe('wal_scb');

      // Simulate remote deleting 'wal_scb':
      const remainingWallets = initialWallets.filter((w) => w.id !== 'wal_scb');
      store.setWallets(remainingWallets);

      // selectedWalletId MUST automatically fall back to 'all'
      expect(useFinanceBridgeStore.getState().selectedWalletId).toBe('all');
      expect(useFinanceBridgeStore.getState().wallets).toHaveLength(2);
    });

    it('preserves selectedWalletId when a different wallet is deleted', () => {
      const store = useFinanceBridgeStore.getState();
      store.setWallets(initialWallets);
      store.setSelectedWalletId('wal_kbank');
      expect(useFinanceBridgeStore.getState().selectedWalletId).toBe('wal_kbank');

      // Remote deletes 'wal_crypto', but 'wal_kbank' remains
      const remainingWallets = initialWallets.filter((w) => w.id !== 'wal_crypto');
      store.setWallets(remainingWallets);

      // selectedWalletId should remain 'wal_kbank'
      expect(useFinanceBridgeStore.getState().selectedWalletId).toBe('wal_kbank');
    });

    it('remains "all" when selectedWalletId was already "all" and a wallet is deleted', () => {
      const store = useFinanceBridgeStore.getState();
      store.setWallets(initialWallets);
      store.setSelectedWalletId('all');

      // Remote deletes a wallet
      const remaining = [initialWallets[0]];
      store.setWallets(remaining);

      expect(useFinanceBridgeStore.getState().selectedWalletId).toBe('all');
    });

    it('falls back to "all" when all wallets are deleted (empty wallet list)', () => {
      const store = useFinanceBridgeStore.getState();
      store.setWallets(initialWallets);
      store.setSelectedWalletId('wal_kbank');

      // All wallets deleted
      store.setWallets([]);

      expect(useFinanceBridgeStore.getState().selectedWalletId).toBe('all');
      expect(useFinanceBridgeStore.getState().wallets).toEqual([]);
    });
  });
});
