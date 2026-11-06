'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  selectAuthInitialized,
  selectToken,
  selectUser,
} from '@/lib/store/authSlice';
import { useAppSelector } from '@/lib/store/hooks';
import { canAccessDashboard, dashboardPathForRole } from '@/lib/auth-routes';
import type { UserRole } from '@/lib/auth-types';
import { useI18n } from '@/lib/i18n/I18nProvider';

function AuthLoading({ label = 'Vérification de votre session…' }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-muted">
      <Loader2 className="h-5 w-5 animate-spin text-sea" />
      <p className="text-[11px] uppercase tracking-[0.14em]">{t(label)}</p>
    </div>
  );
}

export function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { t } = useI18n();
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectToken);
  const initialized = useAppSelector(selectAuthInitialized);
  const router = useRouter();
  const pathname = usePathname();

  const authenticated = Boolean(token && user);
  const allowed =
    authenticated && user
      ? canAccessDashboard(user.role, roles, user.is_staff || user.is_superuser)
      : false;

  useEffect(() => {
    if (!initialized) return;

    if (!authenticated || !user) {
      const next = encodeURIComponent(pathname || '/');
      router.replace(`/connexion?next=${next}`);
      return;
    }

    if (!allowed) {
      router.replace(dashboardPathForRole(user.role, user.is_staff || user.is_superuser));
    }
  }, [allowed, authenticated, initialized, pathname, router, user]);

  if (!initialized) return <AuthLoading />;
  if (!authenticated) return <AuthLoading label={t("Redirection vers la connexion…")} />;
  if (!allowed) return <AuthLoading label={t("Redirection vers votre espace…")} />;

  return <>{children}</>;
}
