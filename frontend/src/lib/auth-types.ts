export type UserRole =
  | 'BUYER'
  | 'BOOKSTORE_SELLER'
  | 'INDIVIDUAL_SELLER'
  | 'ADMIN';

export interface BookstoreProfileSummary {
  id: number;
  store_name: string;
  slug: string;
  address: string;
  wilaya_id: number;
  wilaya_name_fr?: string;
  commune_id?: number;
  commune_name_fr?: string;
  phone: string;
  logo_url?: string | null;
  is_verified: boolean;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export interface IndividualSellerProfileSummary {
  id: number;
  display_name: string;
  bio?: string | null;
  wilaya_id: number;
  wilaya_name_fr?: string;
  commune_id?: number;
  commune_name_fr?: string;
  phone?: string;
  trust_score?: number;
}

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone?: string | null;
  address?: string | null;
  avatar_url?: string | null;
  wilaya_id?: number | null;
  wilaya_name_fr?: string | null;
  commune_id?: number | null;
  commune_name_fr?: string | null;
  is_suspended: boolean;
  is_active: boolean;
  email_verified: boolean;
  account_status: 'ACTIVE' | 'SUSPENDED';
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  has_library?: boolean;
  bookstore_profile?: BookstoreProfileSummary | null;
  individual_profile?: IndividualSellerProfileSummary | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role: Exclude<UserRole, 'ADMIN'>;
  phone?: string;
  address?: string;
  wilaya_id?: number;
  store_name?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface RegisterResponse extends AuthResponse {
  message?: string;
  verification_token?: string;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  avatar_url?: string | null;
  wilaya_id?: number | null;
  commune_id?: number | null;
}

export interface MessageResponse {
  message: string;
}

export interface PasswordResetRequestResponse extends MessageResponse {
  reset_token?: string;
}

export interface VerifyEmailResponse extends MessageResponse {
  email_verified: boolean;
}
