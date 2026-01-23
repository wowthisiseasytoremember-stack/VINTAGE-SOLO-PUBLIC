# Google Drive Integration Setup

## Quick Setup Guide

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Note your project name

### 2. Enable Required APIs

1. Go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Google Drive API**
   - **Google Picker API**

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure OAuth consent screen:
   - User Type: **External** (for testing) or **Internal** (for Google Workspace)
   - App name: **Vintage Ephemera Cataloging**
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue**
   - Scopes: Add `https://www.googleapis.com/auth/drive.readonly`
   - Click **Save and Continue**
   - Test users: Add your email (for external apps)
   - Click **Save and Continue**

4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: **Vintage Ephemera Web Client**
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for local development)
     - `https://your-production-domain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:3000` (for local development)
     - `https://your-production-domain.com` (for production)
   - Click **Create**
   - **Copy the Client ID** (you'll need this)

### 4. Create API Key

1. Still in **Credentials** page
2. Click **Create Credentials** → **API Key**
3. Copy the API Key
4. (Optional) Click **Restrict Key**:
   - Application restrictions: **HTTP referrers**
   - Add your domains: `localhost:3000`, `your-production-domain.com`
   - API restrictions: **Restrict key**
   - Select: **Google Drive API**, **Google Picker API**
   - Click **Save**

### 5. Add to Environment Variables

#### Local Development (.env file):

```env
# Google Drive (Backend)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here

# Google Drive (Frontend - in frontend/.env or frontend/.env.local)
REACT_APP_GOOGLE_CLIENT_ID=your_client_id_here
REACT_APP_GOOGLE_API_KEY=your_api_key_here
```

#### Production (Railway/Render):

Add these environment variables in your deployment platform:

**Backend:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**Frontend:**
- `REACT_APP_GOOGLE_CLIENT_ID`
- `REACT_APP_GOOGLE_API_KEY`

### 6. Test Locally

1. Start backend: `cd backend && python main.py`
2. Start frontend: `cd frontend && npm start`
3. Open `http://localhost:3000`
4. Click "Google Drive" tab
5. Click "Sign in with Google"
6. Authorize the app
7. Click "Pick from Google Drive"
8. Select images from your Google Drive
9. Process batch!

## Troubleshooting

### "Error 400: redirect_uri_mismatch"
- Make sure your redirect URI in Google Console exactly matches your app URL
- For local: `http://localhost:3000`
- For production: `https://your-exact-domain.com`

### "This app isn't verified"
- This is normal for testing
- Click "Advanced" → "Go to [App Name] (unsafe)"
- Your app will work fine

### Google Picker not opening
- Check browser console for errors
- Verify `REACT_APP_GOOGLE_CLIENT_ID` and `REACT_APP_GOOGLE_API_KEY` are set
- Make sure Google Picker API is enabled in Google Cloud Console

### Files not downloading
- Check backend logs for errors
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set correctly
- Make sure Google Drive API is enabled

## Security Notes

- Never commit `.env` files to git
- Use different OAuth clients for development and production
- Restrict API keys to specific domains in production
- Regularly rotate credentials

## Production Checklist

- [ ] OAuth consent screen published (for external apps)
- [ ] Production domain added to authorized origins
- [ ] API key restricted to production domain
- [ ] Environment variables set in deployment platform
- [ ] Test Google Drive picker on production URL
- [ ] Verify file downloads work
