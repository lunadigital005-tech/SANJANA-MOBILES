import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { UserProfile, UserRole } from '../types';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (fullName: string, email: string, password: string) => Promise<{ success: boolean; error?: string; requireEmailVerification?: boolean }>;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_AUTH_KEY = 'sanjana_auth_user_v1';
const LOCAL_TOKEN_KEY = 'sanjana_auth_token_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Initialize session
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (isSupabaseConfigured) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setToken(session.access_token);
            // Fetch profile row from public.profiles
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              setUser({
                id: profile.id,
                email: profile.email || session.user.email!,
                full_name: profile.full_name || 'Customer',
                role: profile.role || 'customer',
                phone: profile.phone,
                avatar_url: profile.avatar_url,
                created_at: profile.created_at,
              });
            } else {
              // Fallback if profile row is still syncing
              setUser({
                id: session.user.id,
                email: session.user.email!,
                full_name: session.user.user_metadata?.full_name || 'Customer',
                role: 'customer',
              });
            }
          }
        } else {
          // Restore mock session for local development
          const savedUser = localStorage.getItem(LOCAL_AUTH_KEY);
          const savedToken = localStorage.getItem(LOCAL_TOKEN_KEY);
          if (savedUser) {
            setUser(JSON.parse(savedUser));
            setToken(savedToken || 'mock-customer-token');
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen to Supabase auth events if configured
    if (isSupabaseConfigured) {
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (session?.user) {
            setToken(session.access_token);
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            setUser({
              id: session.user.id,
              email: session.user.email!,
              full_name: profile?.full_name || session.user.user_metadata?.full_name || 'Customer',
              role: profile?.role || 'customer',
              phone: profile?.phone,
              avatar_url: profile?.avatar_url,
            });
          } else {
            setUser(null);
            setToken(null);
          }
        }
      );

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) return { success: false, error: error.message };

        // Fetch verified role from DB
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        const userObj: UserProfile = {
          id: data.user.id,
          email: data.user.email!,
          full_name: profile?.full_name || data.user.user_metadata?.full_name || 'Customer',
          role: profile?.role || 'customer',
          phone: profile?.phone,
          avatar_url: profile?.avatar_url,
        };
        setUser(userObj);
        setToken(data.session.access_token);
        showToast(`Welcome back, ${userObj.full_name}`, 'success');
        return { success: true };
      } else {
        // Local offline / demo fallback
        const demoUser: UserProfile = {
          id: 'customer-user-id-001',
          email,
          full_name: 'Elena Rostova',
          role: 'customer',
          phone: '+1 (555) 234-5678',
          avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
        };
        setUser(demoUser);
        setToken('mock-customer-token');
        localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(demoUser));
        localStorage.setItem(LOCAL_TOKEN_KEY, 'mock-customer-token');
        showToast(`Welcome back, ${demoUser.full_name}`, 'success');
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const register = async (fullName: string, email: string, password: string) => {
    try {
      if (isSupabaseConfigured) {
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedName = fullName.trim();

        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: trimmedName,
              role: 'customer', // Always customer on public registration
            },
          },
        });

        if (error) {
          console.error('[AuthContext] Supabase registration failure:', {
            status: error.status,
            name: error.name,
            message: error.message,
          });

          let displayError = error.message;
          if (error.message.includes('Database error saving new user')) {
            displayError = 'Database error saving new user. Please apply database migration 10 (10_fix_auth_registration_trigger.sql) in Supabase SQL Editor.';
          }
          return { success: false, error: displayError };
        }

        const requireVerification = !data.session;
        if (requireVerification) {
          showToast('Verification email sent! Please check your inbox.', 'info', 7000);
          return { success: true, requireEmailVerification: true };
        }

        const userObj: UserProfile = {
          id: data.user!.id,
          email: data.user!.email!,
          full_name: fullName,
          role: 'customer',
        };
        setUser(userObj);
        setToken(data.session?.access_token || null);
        showToast('Registration successful! Welcome to Sanjana Mobiles.', 'success');
        return { success: true, requireEmailVerification: false };
      } else {
        // Local demo registration
        const newUser: UserProfile = {
          id: `cust-${Date.now()}`,
          email,
          full_name: fullName,
          role: 'customer',
        };
        setUser(newUser);
        setToken('mock-customer-token');
        localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(newUser));
        localStorage.setItem(LOCAL_TOKEN_KEY, 'mock-customer-token');
        showToast('Account created successfully!', 'success');
        return { success: true, requireEmailVerification: false };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' };
    }
  };

  const adminLogin = async (email: string, password: string) => {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) return { success: false, error: error.message };

        // Verify role in profiles table - MUST be admin or super_admin
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role, full_name, avatar_url')
          .eq('id', data.user.id)
          .single();

        const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
        if (profileErr || !isAdmin) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: 'Access Denied: This account is not authorized as an administrator for Sanjana Mobiles.',
          };
        }

        const adminObj: UserProfile = {
          id: data.user.id,
          email: data.user.email!,
          full_name: profile.full_name || 'Sanjana Administrator',
          role: profile.role as UserRole,
          avatar_url: profile.avatar_url,
        };
        setUser(adminObj);
        setToken(data.session.access_token);
        showToast(profile.role === 'super_admin' ? 'Super Admin session authenticated' : 'Admin session authenticated', 'success');
        return { success: true };
      } else {
        // Local / Offline Admin verification for development
        const normalizedEmail = email.toLowerCase().trim();
        if (
          normalizedEmail === 'sanjanamobiledatabase@gmail.com' ||
          normalizedEmail === 'admin@sanjanamobiles.com' ||
          normalizedEmail === 'admin@luna-store.com'
        ) {
          const isSuper = normalizedEmail === 'sanjanamobiledatabase@gmail.com';
          const adminUser: UserProfile = {
            id: 'admin-user-id-001',
            email: normalizedEmail,
            full_name: isSuper ? 'Sanjana Super Admin' : 'Sanjana Administrator',
            role: isSuper ? 'super_admin' : 'admin',
            avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
          };
          setUser(adminUser);
          setToken('mock-admin-token');
          localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(adminUser));
          localStorage.setItem(LOCAL_TOKEN_KEY, 'mock-admin-token');
          showToast(isSuper ? 'Super Admin authorized' : 'Admin session authorized', 'success');
          return { success: true };
        } else {
          return {
            success: false,
            error: 'Access Denied: This account is not registered as an administrator for Sanjana Mobiles.',
          };
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Admin authentication failed' };
    }
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem(LOCAL_AUTH_KEY);
      localStorage.removeItem(LOCAL_TOKEN_KEY);
      showToast('You have been logged out', 'info');
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) return { success: false, error: error.message };
      }
      showToast('Password reset instructions sent to your email', 'success', 6000);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send reset email' };
    }
  };

  const resetPassword = async (newPassword: string) => {
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) return { success: false, error: error.message };
      }
      showToast('Password updated successfully! Please login with your new password.', 'success');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update password' };
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    // Security: strip role if maliciously passed
    const safeData = { ...data };
    delete (safeData as any).role;
    delete (safeData as any).id;

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('profiles')
          .update(safeData)
          .eq('id', user.id);
        if (error) return { success: false, error: error.message };
      }

      const updated = { ...user, ...safeData };
      setUser(updated);
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(updated));
      showToast('Profile updated successfully', 'success');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        token,
        loading,
        login,
        register,
        adminLogin,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
