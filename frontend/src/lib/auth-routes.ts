import type { UserRole } from './auth-types';

export const DASHBOARD_PATH: Record<UserRole, string> = {
  BUYER: '/dashboard/buyer',
  BOOKSTORE_SELLER: '/dashboard/library',
  INDIVIDUAL_SELLER: '/dashboard/seller',
  ADMIN: '/dashboard/admin',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  BUYER: 'Lecteur',
  BOOKSTORE_SELLER: 'Libraire',
  INDIVIDUAL_SELLER: 'Vendeur particulier',
  ADMIN: 'Administrateur',
};

export function dashboardPathForRole(role: UserRole, isStaff = false): string {
  if (isStaff || role === 'ADMIN') return DASHBOARD_PATH.ADMIN;
  return DASHBOARD_PATH[role] ?? DASHBOARD_PATH.BUYER;
}

export function canAccessDashboard(
  role: UserRole,
  allowedRoles: UserRole[] | undefined,
  isStaff = false,
): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (isStaff || role === 'ADMIN') return true;
  return allowedRoles.includes(role);
}
