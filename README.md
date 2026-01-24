# Vintage Solo

AI-powered vintage item cataloging for collectors and resellers.

## Quick Start (Local Development)

```bash
cd frontend
npm install
npm start
```

## Deploy to Netlify (Free Hosting)

### Option 1: Drag & Drop
1. Run `npm run build` in the `frontend` folder
2. Go to [app.netlify.com](https://app.netlify.com)
3. Drag the `frontend/build` folder to the deploy zone

### Option 2: Connect to GitHub
1. Push to GitHub repository
2. Go to [app.netlify.com](https://app.netlify.com)
3. Click "Import from Git"
4. Select your repo - Netlify will auto-detect `netlify.toml`

## Features

- 📸 Take photos or upload images
- 🤖 AI identification (Gemini, OpenAI, Claude)
- 📦 Organize by box/session
- 📊 Export to CSV
- 📱 Works on phone (Add to Home Screen)

## Configuration

API keys are stored locally in browser storage. Go to Settings to enter:
- **Gemini API Key** (recommended - free tier available)
- **OpenAI API Key** (optional)
- **Claude API Key** (optional, may need CORS proxy)
