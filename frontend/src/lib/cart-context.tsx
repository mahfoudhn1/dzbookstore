'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Offer } from './types';

export interface CartLine {
  offer: Offer;
  quantity: number;
}

interface CartContextType {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (offer: Offer, quantity?: number) => void;
  remove: (offerId: number) => void;
  setQuantity: (offerId: number, quantity: number) => void;
  clear: () => void;
  isReady: boolean;
}

const CartContext = createContext<CartContextType>({
  lines: [],
  count: 0,
  subtotal: 0,
  add: () => {},
  remove: () => {},
  setQuantity: () => {},
  clear: () => {},
  isReady: false,
});

const STORAGE_KEY = 'bookstoredz.cart.v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only cart hydration after mount
        if (Array.isArray(parsed)) setLines(parsed);
      }
    } catch {
      // A stale cart should never block the storefront.
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage may be unavailable in private mode.
    }
  }, [lines, isReady]);

  const add = (offer: Offer, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((line) => line.offer.id === offer.id);
      if (existing) {
        return current.map((line) =>
          line.offer.id === offer.id
            ? { ...line, quantity: Math.min(line.quantity + quantity, Math.max(offer.quantity, 1)) }
            : line,
        );
      }
      return [...current, { offer, quantity }];
    });
  };

  const remove = (offerId: number) => {
    setLines((current) => current.filter((line) => line.offer.id !== offerId));
  };

  const setQuantity = (offerId: number, quantity: number) => {
    setLines((current) =>
      current
        .map((line) =>
          line.offer.id === offerId
            ? { ...line, quantity: Math.max(0, Math.min(quantity, Math.max(line.offer.quantity, 1))) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const clear = () => setLines([]);

  const count = useMemo(() => lines.reduce((total, line) => total + line.quantity, 0), [lines]);
  const subtotal = useMemo(
    () => lines.reduce((total, line) => total + line.offer.price * line.quantity, 0),
    [lines],
  );

  return (
    <CartContext.Provider value={{ lines, count, subtotal, add, remove, setQuantity, clear, isReady }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
