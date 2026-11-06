import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  MessageResponse,
  PasswordResetRequestResponse,
  RegisterPayload,
  RegisterResponse,
  UpdateProfilePayload,
  VerifyEmailResponse,
} from './auth-types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

const FIELD_LABELS: Record<string, string> = {
  email: 'Adresse email',
  password: 'Mot de passe',
  new_password: 'Nouveau mot de passe',
  name: 'Nom',
  role: 'Rôle',
  phone: 'Téléphone',
  wilaya_id: 'Wilaya',
  store_name: 'Nom de la librairie',
  non_field_errors: 'Erreur',
  detail: 'Erreur',
};

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Une erreur inattendue est survenue.';
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.trim()) return data;
  if (!data || typeof data !== 'object') return fallback;

  const payload = data as Record<string, unknown>;
  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }
  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    return payload.detail;
  }

  for (const [field, value] of Object.entries(payload)) {
    const label = FIELD_LABELS[field] ?? field;
    if (typeof value === 'string' && value.trim()) {
      return field in FIELD_LABELS ? `${label} : ${value}` : value;
    }
    if (Array.isArray(value) && value.length > 0) {
      return field in FIELD_LABELS ? `${label} : ${String(value[0])}` : String(value[0]);
    }
  }
  return fallback;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Token ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(
      'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.',
      0,
      null,
    );
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(data, 'La requête a échoué. Réessayez.'),
      response.status,
      data,
    );
  }

  return data as T;
}

export const authApi = {
  login(payload: LoginPayload) {
    return request<AuthResponse>('/auth/login/', { method: 'POST', body: payload });
  },

  register(payload: RegisterPayload) {
    return request<RegisterResponse>('/auth/register/', {
      method: 'POST',
      body: payload,
    });
  },

  me(token: string) {
    return request<AuthUser>('/auth/me/', { token });
  },

  updateMe(token: string, payload: UpdateProfilePayload) {
    return request<AuthUser>('/auth/me/', {
      method: 'PUT',
      body: payload,
      token,
    });
  },

  logout(token: string) {
    return request<MessageResponse>('/auth/logout/', { method: 'POST', token });
  },

  verifyEmail(token: string) {
    return request<VerifyEmailResponse>('/auth/verify-email/', {
      method: 'POST',
      body: { token },
    });
  },

  resendVerification(token: string) {
    return request<MessageResponse & { verification_token?: string; email_verified?: boolean }>(
      '/auth/resend-verification/',
      { method: 'POST', token },
    );
  },

  requestPasswordReset(email: string) {
    return request<PasswordResetRequestResponse>('/auth/password-reset/request/', {
      method: 'POST',
      body: { email },
    });
  },

  resetPassword(token: string, newPassword: string) {
    return request<MessageResponse>('/auth/password-reset/confirm/', {
      method: 'POST',
      body: { token, new_password: newPassword },
    });
  },
};
