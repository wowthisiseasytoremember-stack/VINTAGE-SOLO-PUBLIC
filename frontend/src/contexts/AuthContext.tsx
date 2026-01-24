import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isFirebaseConfigured();

  useEffect(() => {
    if (!isConfigured || !auth) {
      setLoading(false);
      return;
    }

    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      
      if (firebaseUser) {
        console.log('🔐 User signed in:', firebaseUser.email);
      } else {
        console.log('🔓 User signed out');
      }
    });

    return () => unsubscribe();
  }, [isConfigured]);

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) {
      console.error('Firebase Auth not initialized');
      return;
    }

    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Sign-in error:', error);
      // Handle popup closed by user
      if (error.code !== 'auth/popup-closed-by-user') {
        throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!auth) return;
    
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign-out error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isConfigured,
    isAuthenticated: !!user,
    signInWithGoogle,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
