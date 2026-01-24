import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginButtonProps {
  compact?: boolean;
}

export default function LoginButton({ compact = false }: LoginButtonProps) {
  const { user, loading, isConfigured, signInWithGoogle, signOut } = useAuth();

  // Don't show anything if Firebase isn't configured
  if (!isConfigured) {
    return null;
  }

  if (loading) {
    return (
      <div style={{ 
        padding: compact ? '6px 12px' : '8px 16px',
        fontSize: '13px',
        color: 'var(--text-secondary)'
      }}>
        Loading...
      </div>
    );
  }

  if (user) {
    // Logged in state
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        {!compact && (
          <>
            {user.photoURL && (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: '2px solid var(--primary)'
                }}
              />
            )}
            <span style={{ 
              fontSize: '13px', 
              fontWeight: 500,
              color: 'var(--text-main)',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
            </span>
          </>
        )}
        <button
          onClick={signOut}
          className="btn-seamless btn-ghost"
          style={{
            padding: '6px 12px',
            fontSize: '12px'
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Logged out state
  return (
    <button
      onClick={signInWithGoogle}
      className="btn-seamless btn-primary"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: compact ? '6px 12px' : '8px 16px',
        fontSize: '13px'
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {compact ? 'Sign In' : 'Sign in with Google'}
    </button>
  );
}
