# Google OAuth Authentication Setup

## Overview

The app now uses Google OAuth for user authentication. Users must sign in with Google before they can process batches.

## Features

- **Google Sign-In**: Users sign in with their Google account
- **JWT Tokens**: Secure token-based authentication
- **Protected Routes**: All batch processing endpoints require authentication
- **User Management**: Automatic user creation and session management

## Backend Setup

### 1. Environment Variables

Add to your `.env` file:

```env
# Google OAuth (same as Google Drive setup)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# JWT Secret (generate a secure random string)
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production
```

**Generate JWT Secret:**
```bash
# On Linux/Mac:
openssl rand -hex 32

# On Windows (PowerShell):
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### 2. Database

The `users` table is automatically created on first run. It stores:
- Google ID
- Email
- Name
- Profile picture
- Created/Last login timestamps

### 3. API Endpoints

- `POST /api/auth/google` - Authenticate with Google ID token
- `GET /api/auth/me` - Get current user info (requires auth)
- `POST /api/process-batch` - **Protected** - Process batch (requires auth)
- `POST /api/process-batch-google-drive` - **Protected** - Process from Google Drive (requires auth)

## Frontend Setup

### 1. Environment Variables

Add to `frontend/.env.local`:

```env
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

### 2. Google Sign-In Script

The Google Sign-In script is loaded automatically in `index.html`.

### 3. Authentication Flow

1. User clicks "Sign in with Google"
2. Google Sign-In popup appears
3. User authorizes
4. Frontend receives Google ID token
5. Frontend sends token to `/api/auth/google`
6. Backend verifies token and creates/updates user
7. Backend returns JWT token
8. Frontend stores JWT token in localStorage
9. All subsequent API calls include JWT in Authorization header

## How It Works

### Sign-In Process

1. **User clicks "Sign in with Google"**
   - Google Sign-In script prompts for credentials
   - User authorizes the app

2. **Frontend receives Google ID token**
   - Token is sent to backend `/api/auth/google`
   - Backend verifies token with Google

3. **Backend creates/updates user**
   - Checks if user exists by Google ID
   - Creates new user or updates last login
   - Generates JWT token

4. **Frontend stores token**
   - JWT token saved to localStorage
   - Token included in all API requests

### Protected Routes

All batch processing endpoints require authentication:

```python
@app.post("/api/process-batch")
async def process_batch(
    ...,
    current_user: User = Depends(get_current_user)  # Requires auth
):
    ...
```

If user is not authenticated, they'll get a 401 error.

### Frontend Protection

- App shows sign-in screen if not authenticated
- All API calls automatically include JWT token
- Token is verified on each request

## Testing

### Local Testing

1. Start backend: `cd backend && python main.py`
2. Start frontend: `cd frontend && npm start`
3. Open `http://localhost:3000`
4. You should see "Sign In Required" screen
5. Click "Sign in with Google"
6. After signing in, you can use the app

### Production Testing

1. Deploy backend and frontend
2. Make sure `GOOGLE_CLIENT_ID` is set in both
3. Make sure authorized origins include your production domain
4. Test sign-in flow

## Troubleshooting

### "Invalid token" error
- Check `GOOGLE_CLIENT_ID` matches in frontend and backend
- Verify Google OAuth consent screen is configured
- Check authorized origins include your domain

### "User not found" after sign-in
- Check database connection
- Verify `users` table was created
- Check backend logs for errors

### Sign-in button doesn't appear
- Check `REACT_APP_GOOGLE_CLIENT_ID` is set
- Verify Google Sign-In script loaded (check browser console)
- Check network tab for script loading errors

### 401 errors on API calls
- Verify JWT token is in localStorage
- Check token hasn't expired (7 days default)
- Verify Authorization header is being sent
- Check `JWT_SECRET_KEY` matches between requests

## Security Notes

1. **JWT Secret**: Use a strong, random secret in production
2. **HTTPS**: Always use HTTPS in production
3. **Token Expiration**: Tokens expire after 7 days (configurable)
4. **Google Client ID**: Keep it secret (though it's public in frontend)
5. **CORS**: Configure CORS properly for production

## Production Checklist

- [ ] Strong JWT secret generated and set
- [ ] Google OAuth consent screen published
- [ ] Production domain added to authorized origins
- [ ] HTTPS enabled
- [ ] Environment variables set in deployment platform
- [ ] Test sign-in flow on production
- [ ] Test protected endpoints require auth
