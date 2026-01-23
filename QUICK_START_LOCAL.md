# Quick Start: Run on Your Plex Server (FREE!)

## 5-Minute Setup

### Step 1: On Your Plex Server

1. **Copy the project to your server** (or clone it there)

2. **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   
   cd ../frontend
   npm install
   npm run build
   ```

3. **Create `.env` file** in project root:
   ```env
   OPENAI_API_KEY=your_openai_key_here
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_secret
   JWT_SECRET_KEY=generate-random-string-here
   ENABLE_CORS_ALL=true
   ```

4. **Start the servers:**

   **Option A: Simple (two terminals)**
   ```bash
   # Terminal 1 - Backend
   cd backend
   python main.py
   
   # Terminal 2 - Frontend  
   cd frontend/build
   python -m http.server 3000
   ```

   **Option B: Background (one terminal)**
   ```bash
   # Backend
   cd backend
   python main.py &
   
   # Frontend
   cd frontend/build
   python -m http.server 3000 &
   ```

5. **Note the IP address shown** when backend starts (e.g., `192.168.1.100`)

### Step 2: On Your Android Phone

1. **Connect to same WiFi** as your server

2. **Open browser** and go to:
   ```
   http://YOUR_SERVER_IP:3000
   ```
   Example: `http://192.168.1.100:3000`

3. **Sign in with Google** and start using!

### Step 3: Keep It Running (Optional)

**Linux (systemd service):**
```bash
# Create service file
sudo nano /etc/systemd/system/ephemera.service

# Add this:
[Unit]
Description=Ephemera Cataloging
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/project
ExecStart=/usr/bin/python3 /path/to/project/backend/main.py
Restart=always

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable ephemera
sudo systemctl start ephemera
```

**Windows (Task Scheduler):**
- Create a scheduled task that runs at startup
- Or use NSSM to create a Windows service

---

## Access from Outside Your Network (Optional)

### Using ngrok (Free, URL changes each restart):

1. **Install ngrok:** https://ngrok.com/download

2. **Start backend:**
   ```bash
   cd backend
   python main.py
   ```

3. **In another terminal, create tunnel:**
   ```bash
   ngrok http 8000
   ```

4. **Update frontend** to use ngrok URL:
   - Edit `frontend/.env.production`:
     ```env
     REACT_APP_API_URL=https://your-ngrok-url.ngrok.io
     ```
   - Rebuild: `cd frontend && npm run build`

5. **Serve frontend through ngrok too:**
   ```bash
   cd frontend/build
   python -m http.server 3000
   # In another terminal:
   ngrok http 3000
   ```

6. **Access from anywhere:** Use the ngrok frontend URL!

---

## Troubleshooting

**"Can't connect" from phone:**
- ✅ Check phone is on same WiFi
- ✅ Check server IP is correct
- ✅ Check firewall allows ports 8000 and 3000
- ✅ Try `http://SERVER_IP:8000/api/health` in phone browser

**CORS errors:**
- ✅ Make sure `ENABLE_CORS_ALL=true` in `.env`
- ✅ Backend should show "Network access: http://IP:8000" on startup

**Backend stops when terminal closes:**
- ✅ Use `screen` or `tmux` to keep it running
- ✅ Use systemd service (Linux) or Task Scheduler (Windows)
- ✅ Use `nohup python main.py &` to run in background

---

## That's It!

You now have a **completely free** deployment running on your own server, accessible from your phone! 🎉
