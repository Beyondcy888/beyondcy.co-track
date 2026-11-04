import { useSyncExternalStore } from 'react';
import { currentMonthWIB, todayWIB } from '../lib/time.js';

// One shared timer per period, however many components need "now".
// (600 table rows showing "3 min ago" share a single interval.)
const stores = new Map();

function storeFor(period) {
  let store = stores.get(period);
  if (store) return store;
  let now = Date.now();
  let timer = null;
  const listeners = new Set();
  store = {
    subscribe(listener) {
      listeners.add(listener);
      if (!timer) {
        now = Date.now();
        timer = setInterval(() => {
          now = Date.now();
          listeners.forEach((l) => l());
        }, period);
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    get: () => now,
  };
  stores.set(period, store);
  return store;
}

/** Date.now(), refreshed every `period` ms. */
export function useNow(period = 30000) {
  const store = storeFor(period);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Today's date in WIB ('YYYY-MM-DD'), rolling over at Jakarta midnight. */
export function useToday() {
  return todayWIB(useNow(30000));
}

export function useCurrentMonth() {
  return currentMonthWIB(useNow(30000));
}
