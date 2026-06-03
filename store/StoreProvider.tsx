'use client';

import { useRef } from 'react';
import { Provider } from 'react-redux';
import { makeStore, type AppStore } from './index';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // useRef guarantees a single store instance per component tree even in
  // React Strict Mode (which mounts twice in development).
  const storeRef = useRef<AppStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = makeStore();
  }
  return <Provider store={storeRef.current}>{children}</Provider>;
}
