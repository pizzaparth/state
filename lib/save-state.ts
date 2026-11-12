/**
 * Saving state for the top bar (C45): how many writes are in flight, whether the last
 * one finished, and how many are waiting on the network. A tiny external store read
 * with useSyncExternalStore.
 */

export interface SaveState {
  inFlight: number;
  /** Writes retrying after a network failure. */
  waiting: number;
  /** Epoch ms of the last successful write. */
  savedAt: number;
}

let state: SaveState = { inFlight: 0, waiting: 0, savedAt: 0 };
const listeners = new Set<() => void>();

function set(patch: Partial<SaveState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export const saveStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => state,
  server: (): SaveState => ({ inFlight: 0, waiting: 0, savedAt: 0 }),
  start: () => set({ inFlight: state.inFlight + 1 }),
  wait: () => set({ waiting: state.waiting + 1 }),
  unwait: () => set({ waiting: Math.max(0, state.waiting - 1) }),
  finish: (ok: boolean) => set({ inFlight: Math.max(0, state.inFlight - 1), ...(ok ? { savedAt: Date.now() } : {}) }),
};

/** Other tabs refresh when this one writes (C43). */
export const CHANNEL = "state";

let channel: BroadcastChannel | null = null;
export function broadcastWrite() {
  try {
    channel ??= new BroadcastChannel(CHANNEL);
    channel.postMessage({ type: "write", at: Date.now() });
  } catch {
    // BroadcastChannel unavailable: other tabs refresh on focus instead
  }
}
