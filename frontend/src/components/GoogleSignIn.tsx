import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

declare global {
  interface Window {
    google: any;
  }
}

const GoogleSignIn: React.FC = () => {
  const { signIn, signOut, user, isAuthenticated } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    // Load Google Sign-In script
    const handleCredentialResponse = async (response: any) => {
      try {
        setError(null);
        await signIn(response.credential);
      } catch (err: any) {
        setError(err.message || 'Failed to sign in');
        console.error('Sign in error:', err);
      }
    };

    if (!document.getElementById('google-signin-script')) {
      const script = document.createElement('script');
      script.id = 'google-signin-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google && GOOGLE_CLIENT_ID) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
          });
          setIsLoaded(true);
        }
      };
      document.head.appendChild(script);
    } else {
      setIsLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleCredentialResponse = async (response: any) => {
    try {
      setError(null);
      await signIn(response.credential);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      console.error('Sign in error:', err);
    }
  };

  const handleSignIn = () => {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.prompt();
    } else {
      setError('Google Sign-In not loaded. Please refresh the page.');
    }
  };

  if (!isLoaded) {
    return (
      <div className="text-sm text-gray-500">
        Loading sign-in...
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        {user.picture && (
          <img
            src={user.picture}
            alt={user.name || user.email}
            className="w-8 h-8 rounded-full"
          />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-700">
            {user.name || user.email}
          </span>
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-gray-700 text-left"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Show compact sign-in button when not authenticated
  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-2 py-1 rounded text-xs mb-1">
          {error}
        </div>
      )}
      <button
        onClick={handleSignIn}
        className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
        title="Sign in to sync across devices (optional)"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in
      </button>
    </div>
  );
};

export default GoogleSignIn;
