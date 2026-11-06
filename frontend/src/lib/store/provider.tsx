'use client';

import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { bootstrapSession } from './authSlice';
import { makeStore, type AppStore } from './index';

export function ReduxProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<AppStore>(() => makeStore());

  useEffect(() => {
    store.dispatch(bootstrapSession());
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
