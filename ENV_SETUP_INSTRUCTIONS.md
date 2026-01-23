# Environment Variables Setup - What You Need to Do

## ✅ What I've Done For You

1. ✅ Generated a secure JWT secret key
2. ✅ Added JWT_SECRET_KEY to backend `.env`
3. ✅ Created frontend `.env.local` file
4. ✅ Set up the file structure

## ⚠️ What YOU Need to Fill In

You need to get your **Google OAuth credentials** from Google Cloud Console and add them to the files.

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select existing)
3. Enable **Google Drive API** and **Google Picker API**
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth client ID**
6. Application type: **Web application**
7. Authorized JavaScript origins:
   - `http://localhost:3000` (for local dev)
   - `http://YOUR_SERVER_IP:3000` (for your server)
8. Copy the **Client ID** and **Client Secret**

### Step 2: Get Google API Key (for Drive Picker)

1. Still in **Credentials** page
2. Click **Create Credentials** → **API Key**
3. Copy the **API Key**

### Step 3: Update Backend `.env` File

Open `.env` in the project root and replace these lines:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here          ← Replace with your Client ID
GOOGLE_CLIENT_SECRET=your_google_client_secret_here  ← Replace with your Client Secret
```

**Example:**
```env
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
```

### Step 4: Update Frontend `.env.local` File

Open `frontend/.env.local` and replace:

```env
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here  ← Same Client ID as above
REACT_APP_GOOGLE_API_KEY=your_google_api_key_here     ← Your API Key
```

**Example:**
```env
REACT_APP_GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
REACT_APP_GOOGLE_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz
```

## 📋 Quick Checklist

- [ ] Got Google Client ID from Google Cloud Console
- [ ] Got Google Client Secret from Google Cloud Console  
- [ ] Got Google API Key from Google Cloud Console
- [ ] Updated `GOOGLE_CLIENT_ID` in `.env`
- [ ] Updated `GOOGLE_CLIENT_SECRET` in `.env`
- [ ] Updated `REACT_APP_GOOGLE_CLIENT_ID` in `frontend/.env.local`
- [ ] Updated `REACT_APP_GOOGLE_API_KEY` in `frontend/.env.local`

## 🎯 Current Status

✅ **JWT_SECRET_KEY** - Already generated and set!  
⚠️ **Google Credentials** - You need to add these

## 📝 File Locations

- Backend config: `.env` (in project root)
- Frontend config: `frontend/.env.local`

## 🔒 Security Note

- Never commit `.env` or `.env.local` to git (they're already in .gitignore)
- Keep your Client Secret and JWT Secret secure
- The Client ID can be public (it's in the frontend code)

## 🚀 After Setup

Once you've added the Google credentials:

1. Restart the backend server
2. Restart the frontend server (or rebuild if using production build)
3. Test Google sign-in!

---

**Need help?** See `SETUP_GOOGLE_DRIVE.md` for detailed Google Cloud Console setup instructions.
