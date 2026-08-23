import { create } from 'zustand';
import type { AuthSession, User } from '../api/types';
import { clearTokens, getTokens, saveTokens } from './tokenStorage';
import { setSessionExpiredHandler } from '../api/client';
import * as authApi from '../api/auth';

/**
 * Session state. Server data (bookings, addresses) belongs to TanStack Query —
 * this store holds only who is signed in and whether we have finished checking.
 */

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  user: User | null;
  /** Drives the jump to profile setup after a first sign-in (ui.md §10). */
  needsProfile: boolean;

  restore: () => Promise<void>;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  needsProfile: false,

  /**
   * Runs once on launch, behind the splash screen. A stored token is not
   * trusted on its own — it is exchanged for the current user, so a suspended
   * or deleted account cannot linger in a signed-in state.
   */
  restore: async () => {
    const tokens = await getTokens();
    if (!tokens) {
      set({ status: 'signedOut', user: null });
      return;
    }

    try {
      const user = await authApi.me();
      set({
        status: 'signedIn',
        user,
        needsProfile: !user.profileComplete,
      });
    } catch {
      // Expired beyond refresh, or the account is gone.
      await clearTokens();
      set({ status: 'signedOut', user: null });
    }
  },

  signIn: async (session) => {
    await saveTokens({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    set({
      status: 'signedIn',
      user: session.user,
      needsProfile: !session.profileComplete,
    });
  },

  signOut: async () => {
    const tokens = await getTokens();
    // Best-effort: revoke server-side, but always clear locally even if the
    // call fails, or a customer could not sign out while offline.
    if (tokens?.refreshToken) {
      await authApi.logout(tokens.refreshToken).catch(() => undefined);
    }
    await clearTokens();
    set({ status: 'signedOut', user: null, needsProfile: false });
  },

  setUser: (user) => set({ user, needsProfile: !user.profileComplete }),
}));

/**
 * When a refresh fails for good, the client tells us here rather than importing
 * this store — which would be a cycle.
 */
setSessionExpiredHandler(() => {
  useAuthStore.setState({ status: 'signedOut', user: null, needsProfile: false });
});

/** Convenience selectors — components subscribe to the narrowest slice. */
export const useUser = () => useAuthStore((state) => state.user);
export const useIsSignedIn = () => useAuthStore((state) => state.status === 'signedIn');
