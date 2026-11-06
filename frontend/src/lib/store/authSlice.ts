import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { ApiError, authApi, getErrorMessage } from '@/lib/auth-api';
import {
  clearStoredToken,
  getStoredToken,
  storeToken,
} from '@/lib/auth-storage';
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
} from '@/lib/auth-types';
import type { RootState } from './index';

export type PendingAction =
  | 'login'
  | 'register'
  | 'bootstrap'
  | 'logout'
  | 'profile'
  | 'verify'
  | 'resend'
  | 'reset-request'
  | 'reset'
  | null;

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  initialized: boolean;
  pendingAction: PendingAction;
  error: string | null;
  notice: string | null;
  demoVerificationToken: string | null;
  demoResetToken: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  initialized: false,
  pendingAction: null,
  error: null,
  notice: null,
  demoVerificationToken: null,
  demoResetToken: null,
};

export const login = createAsyncThunk<
  { token: string; user: AuthUser },
  LoginPayload,
  { rejectValue: string }
>('auth/login', async (payload, { rejectWithValue }) => {
  try {
    const data = await authApi.login(payload);
    storeToken(data.token);
    return { token: data.token, user: data.user };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const register = createAsyncThunk<
  { token: string; user: AuthUser; message?: string; verificationToken?: string },
  RegisterPayload,
  { rejectValue: string }
>('auth/register', async (payload, { rejectWithValue }) => {
  try {
    const data = await authApi.register(payload);
    storeToken(data.token);
    return {
      token: data.token,
      user: data.user,
      message: data.message,
      verificationToken: data.verification_token,
    };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const bootstrapSession = createAsyncThunk<
  { token: string | null; user: AuthUser | null },
  void,
  { rejectValue: string }
>('auth/bootstrap', async (_, { rejectWithValue }) => {
  const token = getStoredToken();
  if (!token) return { token: null, user: null };

  try {
    const user = await authApi.me(token);
    return { token, user };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      clearStoredToken();
    }
    return rejectWithValue(getErrorMessage(error));
  }
});

export const logout = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/logout',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const token = state.auth.token;
    try {
      if (token) await authApi.logout(token);
    } catch {
      // The local session is always cleared, even if the API is unreachable.
    } finally {
      clearStoredToken();
    }
  },
);

export const updateProfile = createAsyncThunk<
  AuthUser,
  UpdateProfilePayload,
  { rejectValue: string; state: RootState }
>('auth/updateProfile', async (payload, { getState, rejectWithValue }) => {
  const token = getState().auth.token;
  if (!token) return rejectWithValue('Vous devez être connecté.');
  try {
    return await authApi.updateMe(token, payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const verifyEmail = createAsyncThunk<
  { message: string; emailVerified: boolean },
  string,
  { rejectValue: string }
>('auth/verifyEmail', async (token, { rejectWithValue }) => {
  try {
    const data = await authApi.verifyEmail(token);
    return { message: data.message, emailVerified: data.email_verified };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const resendVerification = createAsyncThunk<
  { message: string; verificationToken?: string },
  void,
  { rejectValue: string; state: RootState }
>('auth/resendVerification', async (_, { getState, rejectWithValue }) => {
  const token = getState().auth.token;
  if (!token) return rejectWithValue('Vous devez être connecté.');
  try {
    const data = await authApi.resendVerification(token);
    return {
      message: data.message,
      verificationToken: data.verification_token,
    };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const requestPasswordReset = createAsyncThunk<
  { message: string; resetToken?: string },
  string,
  { rejectValue: string }
>('auth/requestPasswordReset', async (email, { rejectWithValue }) => {
  try {
    const data = await authApi.requestPasswordReset(email);
    return { message: data.message, resetToken: data.reset_token };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const resetPassword = createAsyncThunk<
  string,
  { token: string; newPassword: string },
  { rejectValue: string }
>('auth/resetPassword', async ({ token, newPassword }, { rejectWithValue }) => {
  try {
    const data = await authApi.resetPassword(token, newPassword);
    return data.message;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearFeedback(state) {
      state.error = null;
      state.notice = null;
    },
    clearDemoTokens(state) {
      state.demoVerificationToken = null;
      state.demoResetToken = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.pendingAction = 'login';
        state.error = null;
        state.notice = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.pendingAction = null;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.initialized = true;
        state.demoVerificationToken = null;
        state.demoResetToken = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.pendingAction = null;
        state.error = action.payload ?? 'Connexion impossible.';
      })
      .addCase(register.pending, (state) => {
        state.pendingAction = 'register';
        state.error = null;
        state.notice = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.pendingAction = null;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.initialized = true;
        state.notice = action.payload.message ?? 'Compte créé avec succès.';
        state.demoVerificationToken = action.payload.verificationToken ?? null;
      })
      .addCase(register.rejected, (state, action) => {
        state.pendingAction = null;
        state.error = action.payload ?? 'Inscription impossible.';
      })
      .addCase(bootstrapSession.pending, (state) => {
        state.pendingAction = 'bootstrap';
      })
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        state.pendingAction = null;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.initialized = true;
      })
      .addCase(bootstrapSession.rejected, (state) => {
        state.pendingAction = null;
        state.token = null;
        state.user = null;
        state.initialized = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.pendingAction = null;
        state.token = null;
        state.user = null;
        state.initialized = true;
        state.error = null;
        state.notice = 'Vous êtes déconnecté.';
        state.demoVerificationToken = null;
        state.demoResetToken = null;
      })
      .addCase(logout.rejected, (state) => {
        state.pendingAction = null;
        state.token = null;
        state.user = null;
        state.initialized = true;
      })
      .addCase(updateProfile.pending, (state) => {
        state.pendingAction = 'profile';
        state.error = null;
        state.notice = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.pendingAction = null;
        state.user = action.payload;
        state.notice = 'Profil mis à jour.';
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.pendingAction = null;
        state.error = action.payload ?? 'Mise à jour impossible.';
      })
      .addCase(verifyEmail.pending, (state) => {
        state.pendingAction = 'verify';
        state.error = null;
        state.notice = null;
      })
      .addCase(verifyEmail.fulfilled, (state, action) => {
        state.pendingAction = null;
        state.notice = action.payload.message;
        if (state.user) state.user.email_verified = action.payload.emailVerified;
        state.demoVerificationToken = null;
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.pendingAction = null;
        state.error = action.payload ?? 'Vérification impossible.';
      })
      .addCase(resendVerification.pending, (state) => {
        state.pendingAction = 'resend';
        state.error = null;
        state.notice = null;
      })
      .addCase(resendVerification.fulfilled, (state, action) => {
        state.pendingAction = null;
        state.notice = action.payload.message;
        state.demoVerificationToken = action.payload.verificationToken ?? null;
      })
      .addCase(resendVerification.rejected, (state, action) => {
        state.pendingAction = null;
        state.error = action.payload ?? 'Envoi impossible.';
      })
      .addCase(requestPasswordReset.pending, (state) => {
        state.pendingAction = 'reset-request';
        state.error = null;
        state.notice = null;
        state.demoResetToken = null;
      })
      .addCase(requestPasswordReset.fulfilled, (state, action) => {
        state.pendingAction = null;
        state.notice = action.payload.message;
        state.demoResetToken = action.payload.resetToken ?? null;
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.pendingAction = null;
        state.error = action.payload ?? 'Demande impossible.';
      })
      .addCase(resetPassword.pending, (state) => {
        state.pendingAction = 'reset';
        state.error = null;
        state.notice = null;
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        state.pendingAction = null;
        state.notice = action.payload;
        state.demoResetToken = null;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.pendingAction = null;
        state.error = action.payload ?? 'Réinitialisation impossible.';
      });
  },
});

export const { clearFeedback, clearDemoTokens } = authSlice.actions;

export const selectUser = (state: RootState) => state.auth.user;
export const selectToken = (state: RootState) => state.auth.token;
export const selectIsAuthenticated = (state: RootState) =>
  Boolean(state.auth.token && state.auth.user);
export const selectAuthInitialized = (state: RootState) => state.auth.initialized;
export const selectPendingAction = (state: RootState) => state.auth.pendingAction;
export const selectAuthError = (state: RootState) => state.auth.error;
export const selectAuthNotice = (state: RootState) => state.auth.notice;
export const selectDemoVerificationToken = (state: RootState) =>
  state.auth.demoVerificationToken;
export const selectDemoResetToken = (state: RootState) => state.auth.demoResetToken;

export default authSlice.reducer;
