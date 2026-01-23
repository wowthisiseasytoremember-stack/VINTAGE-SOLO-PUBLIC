import React, { useState, useEffect } from 'react';

interface GoogleDrivePickerProps {
  onFilesSelected: (files: Array<{ fileId: string; filename: string; accessToken: string }>) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const GoogleDrivePicker: React.FC<GoogleDrivePickerProps> = ({ onFilesSelected, disabled }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
  const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || '';
  const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

  useEffect(() => {
    // Load Google APIs
    const loadGoogleAPIs = () => {
      if (window.gapi && window.gapi.load) {
        window.gapi.load('auth2:picker', () => {
          window.gapi.auth2.init({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES
          }).then(() => {
            setIsLoaded(true);
            checkAuthStatus();
          }).catch((err: any) => {
            console.error('Error initializing Google Auth:', err);
            setError('Failed to initialize Google authentication');
          });
        });
      } else {
        setTimeout(loadGoogleAPIs, 100);
      }
    };

    // Load Google API script
    if (!document.getElementById('google-api-script')) {
      const script = document.createElement('script');
      script.id = 'google-api-script';
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = loadGoogleAPIs;
      document.head.appendChild(script);
    } else {
      loadGoogleAPIs();
    }
  }, []);

  const checkAuthStatus = () => {
    if (window.gapi && window.gapi.auth2) {
      const authInstance = window.gapi.auth2.getAuthInstance();
      if (authInstance) {
        const user = authInstance.currentUser.get();
        if (user && user.isSignedIn()) {
          const token = user.getAuthResponse().access_token;
          setAccessToken(token);
          setIsAuthorized(true);
        }
      }
    }
  };

  const handleAuthClick = async () => {
    try {
      if (!window.gapi || !window.gapi.auth2) {
        setError('Google APIs not loaded. Please refresh the page.');
        return;
      }

      const authInstance = window.gapi.auth2.getAuthInstance();
      const user = await authInstance.signIn({
        scope: SCOPES
      });

      const token = user.getAuthResponse().access_token;
      setAccessToken(token);
      setIsAuthorized(true);
      setError(null);
    } catch (err: any) {
      console.error('Auth error:', err);
      setError('Failed to authorize Google Drive access');
    }
  };

  const handlePickerClick = () => {
    if (!accessToken) {
      handleAuthClick();
      return;
    }

    try {
      const picker = new window.google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(GOOGLE_API_KEY)
        .setCallback((data: any) => {
          if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
            const files = data[window.google.picker.Response.DOCUMENTS].map((doc: any) => ({
              fileId: doc.id,
              filename: doc.name,
              accessToken: accessToken!
            }));
            onFilesSelected(files);
          }
        })
        .addView(window.google.picker.ViewId.DOCS_IMAGES)
        .addView(window.google.picker.ViewId.PHOTOS)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .setSize(window.innerWidth > 800 ? 1200 : window.innerWidth - 20, window.innerHeight - 100)
        .build();
      
      picker.setVisible(true);
    } catch (err: any) {
      console.error('Picker error:', err);
      setError('Failed to open Google Drive picker. Please try authorizing again.');
    }
  };

  if (!isLoaded) {
    return (
      <div className="text-sm text-gray-500">
        Loading Google Drive...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}
      
      {!isAuthorized ? (
        <button
          onClick={handleAuthClick}
          disabled={disabled}
          className="w-full bg-white border-2 border-gray-300 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      ) : (
        <button
          onClick={handlePickerClick}
          disabled={disabled}
          className="w-full bg-white border-2 border-gray-300 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Pick from Google Drive
        </button>
      )}
    </div>
  );
};

export default GoogleDrivePicker;
