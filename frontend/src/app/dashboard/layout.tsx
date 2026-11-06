'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { EmailVerificationBanner } from '@/components/auth/EmailVerificationBanner';
import type { UserRole } from '@/lib/auth-types';

const ROLE_BY_SEGMENT: Record<string, UserRole[]> = {
  buyer: ['BUYER'],
  bookstore: ['BOOKSTORE_SELLER'],
  seller: ['INDIVIDUAL_SELLER'],
  admin: ['ADMIN'],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segment = pathname.split('/')[2] ?? '';
  const roles = ROLE_BY_SEGMENT[segment];

  return (
    <RequireAuth roles={roles}>
      <EmailVerificationBanner />
      {children}
    </RequireAuth>
  );
}
