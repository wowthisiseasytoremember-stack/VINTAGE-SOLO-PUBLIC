# Deployment Guide

This guide will help you deploy the Vintage Ephemera Cataloging System to the cloud so you can use it from your Android phone.

## Option 1: Railway (Recommended - Easiest)

Railway is the easiest option with a generous free tier.

### Steps:

1. **Sign up at [railway.app](https://railway.app)**

2. **Create a new project**
   - Click "New Project"
   - Select "Deploy from GitHub repo" (recommended) or "Empty Project"

3. **Add Backend Service**
   - Click "New" → "GitHub Repo" (or "Empty Service")
   - Select your repository
   - Set root directory to `backend`
   - Railway will auto-detect Python
   - Add environment variables:
     ```
     OPENAI_API_KEY=your_openai_key_here
     MAX_IMAGES_PER_BATCH=200
     STORAGE_PATH=/app/storage
     EXPORTS_PATH=/app/exports
     GOOGLE_CLIENT_ID=your_google_client_id
     GOOGLE_CLIENT_SECRET=your_google_client_secret
     ```
   - Railway will automatically assign a PORT (use `$PORT` in start command)
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

4. **Add Frontend Service**
   - Click "New" → "GitHub Repo" (or "Empty Service")
   - Set root directory to `frontend`
   - Railway will auto-detect Node.js
   - Add environment variable:
     ```
     REACT_APP_API_URL=https://your-backend-service.railway.app
     REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
     REACT_APP_GOOGLE_API_KEY=your_google_api_key
     ```
   - Build command: `npm install && npm run build`
   - Start command: `npx serve -s build -l $PORT`

5. **Get your URLs**
   - Railway provides HTTPS URLs automatically
   - Update frontend `REACT_APP_API_URL` with backend URL
   - Redeploy frontend

### Railway Free Tier:
- $5/month credit
- Perfect for testing and small projects

---

## Option 2: Render (Also Easy)

Render offers a free tier with some limitations.

### Steps:

1. **Sign up at [render.com](https://render.com)**

2. **Create Backend Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repo
   - Settings:
     - **Name**: `vintage-ephemera-backend`
     - **Root Directory**: `backend`
     - **Environment**: `Python 3`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Add environment variables (same as Railway)
   - Click "Create Web Service"

3. **Create Frontend Static Site**
   - Click "New" → "Static Site"
   - Connect your GitHub repo
   - Settings:
     - **Root Directory**: `frontend`
     - **Build Command**: `npm install && npm run build`
     - **Publish Directory**: `build`
   - Add environment variables:
     ```
     REACT_APP_API_URL=https://your-backend.onrender.com
     REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
     REACT_APP_GOOGLE_API_KEY=your_google_api_key
     ```

4. **Get your URLs**
   - Render provides URLs like `your-app.onrender.com`
   - Update frontend environment variable with backend URL

### Render Free Tier:
- Free tier spins down after 15 min of inactivity
- First request after spin-down takes ~30 seconds
- Perfect for testing

---

## Google Drive API Setup

To enable Google Drive integration, you need to set up Google OAuth:

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**

2. **Create a new project** (or use existing)

3. **Enable APIs**:
   - Go to "APIs & Services" → "Library"
   - Enable "Google Drive API"
   - Enable "Google Picker API"

4. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "Vintage Ephemera Cataloging"
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for local dev)
     - `https://your-frontend-domain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:3000` (for local dev)
     - `https://your-frontend-domain.com` (for production)
   - Click "Create"

5. **Get your credentials**:
   - Copy the **Client ID** → Use as `GOOGLE_CLIENT_ID` and `REACT_APP_GOOGLE_CLIENT_ID`
   - Copy the **Client Secret** → Use as `GOOGLE_CLIENT_SECRET`
   - For Google Picker, you also need an **API Key**:
     - Go to "APIs & Services" → "Credentials"
     - Click "Create Credentials" → "API Key"
     - Copy the API Key → Use as `REACT_APP_GOOGLE_API_KEY`

6. **Add to environment variables**:
   - Backend: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - Frontend: `REACT_APP_GOOGLE_CLIENT_ID`, `REACT_APP_GOOGLE_API_KEY`

---

## Database Persistence

Both Railway and Render provide persistent storage, but for production you might want to use:

- **Railway**: Provides persistent volumes (paid feature)
- **Render**: Database files persist in the service
- **Alternative**: Use PostgreSQL (Railway/Render both offer managed PostgreSQL)

For now, SQLite will work fine for testing.

---

## Testing on Android Phone

1. **Get your deployed frontend URL** (e.g., `https://your-app.railway.app`)

2. **Open in Chrome on Android**:
   - Navigate to the URL
   - The app should work just like on desktop

3. **Test features**:
   - Upload images from phone
   - Use Google Drive picker (if configured)
   - Process batches
   - Download CSV

---

## Troubleshooting

### Backend won't start:
- Check environment variables are set correctly
- Check logs in Railway/Render dashboard
- Ensure `OPENAI_API_KEY` is valid

### Frontend can't connect to backend:
- Verify `REACT_APP_API_URL` points to correct backend URL
- Check CORS settings in backend (should allow your frontend domain)
- Check backend is running and accessible

### Google Drive not working:
- Verify Google Client ID and API Key are correct
- Check authorized origins include your frontend domain
- Check browser console for OAuth errors

### Images not processing:
- Check OpenAI API key is valid and has credits
- Check backend logs for errors
- Verify file sizes are under 50MB

---

## Quick Start Commands

### Railway:
```bash
# Install Railway CLI (optional)
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

### Render:
Just connect your GitHub repo and Render handles the rest!

---

## Cost Estimate

**Railway Free Tier**: $5/month credit (usually enough for testing)
**Render Free Tier**: Free (with spin-down limitations)

For production use, expect:
- Railway: ~$10-20/month
- Render: ~$7-15/month (paid tier)

Both are very affordable for this type of application!
