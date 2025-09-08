import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  User,
  LoginCredentials,
  SignupCredentials,
  UpdateProfileData,
  UserSettings,
} from "@/types/auth";
import { Workspace } from "@/types/workspace";
import { authService } from "@/lib/api/authService";
import { userService } from "@/lib/api/userService";
import { workspaceService } from "@/lib/api/workspaceService";

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  settings: UserSettings | null;
  hasInitialized: boolean;
  currentWorkspace: Workspace | null;
  currentWorkspaceId:  Workspace['id'];

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  loadUserSettings: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  loadCurrentWorkspace: () => Promise<void>;

  // Helpers
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      // Initial state - explicitly false to prevent auto-checks
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      settings: null,
      hasInitialized: false,
      currentWorkspace: null,
      currentWorkspaceId: null,

      // Actions
      login: async (credentials) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authService.login(credentials);

          set({
            user: response.user,
            currentWorkspaceId: response.user.currentWorkspaceId,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Load user settings and workspace after login
          try {
            await get().loadUserSettings();
          } catch (settingsError) {
            // Don't fail login if settings loading fails
            console.warn("Failed to load user settings:", settingsError);
          }

          // Load current workspace
          try {
            await get().loadCurrentWorkspace();
          } catch (workspaceError) {
            console.warn("Failed to load workspace:", workspaceError);
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Login failed",
            isLoading: false,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      signup: async (credentials) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authService.signup(credentials);

          set({
            user: response.user,
            currentWorkspaceId: response.user.currentWorkspaceId,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Signup failed",
            isLoading: false,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      logout: async () => {
        // Clear local state first to prevent loops
        set({
          user: null,
          isAuthenticated: false,
          settings: null,
          error: null,
          isLoading: false,
          hasInitialized: false, // Reset so auth can be checked again
        });

        try {
          await authService.logout();
        } catch (error) {
          console.warn("Logout request failed:", error);
        }
      },

      checkAuth: async () => {
        const currentState = get();

        // Don't check auth if already loading or already initialized
        if (currentState.isLoading || currentState.hasInitialized) {
          return;
        }

        set({ isLoading: true });

        try {
          // First do a lightweight auth check
          const isAuthenticated = await authService.checkAuthStatus();

          if (isAuthenticated) {
            // If authenticated, get full user data
            const user = await authService.getCurrentUser();

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              hasInitialized: true,
              currentWorkspaceId: user?.currentWorkspaceId
            });

            // TODO: In future we might want to show workspaces and their details from the very beginning of the user's journey in the app
            //
            // Load current workspace after auth check
            // try {
            //   await get().loadCurrentWorkspace();
            // } catch (workspaceError) {
            //   console.warn('Failed to load workspace:', workspaceError);
            // }
          } else {
            // Not authenticated
            set({
              isAuthenticated: false,
              user: null,
              isLoading: false,
              error: null,
              settings: null,
              hasInitialized: true,
            });
          }
        } catch (error) {
          // If auth check fails, user is not logged in
          set({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: null, // Don't show error for failed auth check
            settings: null,
            hasInitialized: true,
          });
        }
      },

      updateProfile: async (data) => {
        const { user } = get();

        if (!user) {
          throw new Error("Not authenticated");
        }

        set({ isLoading: true, error: null });

        try {
          const updatedUser = await userService.updateProfile(data);

          set({
            user: updatedUser,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : "Profile update failed",
            isLoading: false,
          });
          throw error;
        }
      },

      updateSettings: async (settings) => {
        try {
          const updatedSettings = await userService.updateSettings(settings);
          set({ settings: updatedSettings });
        } catch (error) {
          // Fall back to local storage if server-side settings not implemented yet
          console.warn(
            "Server-side settings not available, using local storage:",
            error
          );
          const currentSettings = get().settings || {};
          const newSettings = { ...currentSettings, ...settings };
          set({ settings: newSettings });
        }
      },

      loadUserSettings: async () => {
        try {
          const settings = await userService.getSettings();
          set({ settings });
        } catch (error) {
          console.warn("Failed to load user settings:", error);
          // Continue without settings
        }
      },

      switchWorkspace: async (workspaceId: string) => {
        try {
          await workspaceService.switchWorkspace(workspaceId);
          // Reload user to get updated currentWorkspace
          const user = await authService.getCurrentUser();
          set({ user });
          await get().loadCurrentWorkspace();
        } catch (error) {
          throw error;
        }
      },

      loadCurrentWorkspace: async () => {
        const { user } = get();
        if (!user?.currentWorkspaceId) return;

        try {
          const workspace = await workspaceService.getWorkspace(
            user.currentWorkspaceId
          );
          set({ currentWorkspace: workspace });
        } catch (error) {
          console.error("Failed to load current workspace:", error);
        }
      },

      // Helpers
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
    }),
    { name: "AuthStore" }
  )
);
