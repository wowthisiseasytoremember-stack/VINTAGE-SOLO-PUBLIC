# Local Network Setup Guide

Run the backend on your always-on Plex server and access it from your Android phone on your local network (or anywhere with port forwarding/ngrok).

## Option 1: Local Network Only (Free, Easiest)

Access the app only when your phone is on the same WiFi network as your server.

### Backend Setup (On Plex Server)

1. **Find your server's local IP address:**
   ```bash
   # Linux/Mac:
   hostname -I
   # or
   ip addr show
   
   # Windows:
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.100)
   ```

2. **Update backend CORS settings:**
   
   Edit `backend/main.py` - the CORS is already configured to allow all origins in production, but for local network you can be more specific:
   
   ```python
   # In main.py, around line 42-49
   ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://frontend:3000").split(",")
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],  # Allow all for local network
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

3. **Start backend on your server:**
   ```bash
   cd backend
   python main.py
   # Or use a process manager like PM2, systemd, or screen
   ```
   
   The backend will run on `http://YOUR_SERVER_IP:8000`

4. **Build frontend for production:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

5. **Serve frontend on your server:**
   
   Option A: Use Python's built-in server:
   ```bash
   cd frontend/build
   python -m http.server 3000
   ```
   
   Option B: Use nginx (if installed):
   ```nginx
   server {
       listen 3000;
       server_name _;
       root /path/to/frontend/build;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

6. **Access from Android phone:**
   - Make sure phone is on same WiFi network
   - Open browser: `http://YOUR_SERVER_IP:3000`
   - Example: `http://192.168.1.100:3000`

### Update Frontend API URL

Create `frontend/.env.production`:
```env
REACT_APP_API_URL=http://YOUR_SERVER_IP:8000
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
REACT_APP_GOOGLE_API_KEY=your_google_api_key
```

Then rebuild:
```bash
cd frontend
npm run build
```

---

## Option 2: Access from Anywhere (Free with ngrok/localtunnel)

Access your app from anywhere, even when not on local network.

### Using ngrok (Free tier available)

1. **Install ngrok on your server:**
   ```bash
   # Download from https://ngrok.com/download
   # Or use package manager
   ```

2. **Start backend normally:**
   ```bash
   cd backend
   python main.py
   ```

3. **Create ngrok tunnel:**
   ```bash
   ngrok http 8000
   ```
   
   You'll get a URL like: `https://abc123.ngrok.io`

4. **Update frontend to use ngrok URL:**
   
   Create `frontend/.env.production`:
   ```env
   REACT_APP_API_URL=https://abc123.ngrok.io
   REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
   REACT_APP_GOOGLE_API_KEY=your_google_api_key
   ```
   
   Rebuild frontend:
   ```bash
   cd frontend
   npm run build
   ```

5. **Serve frontend through ngrok too:**
   ```bash
   # In another terminal
   cd frontend/build
   python -m http.server 3000
   
   # In another terminal
   ngrok http 3000
   ```

6. **Access from Android:**
   - Use the ngrok frontend URL (e.g., `https://xyz789.ngrok.io`)
   - Works from anywhere!

**Note:** Free ngrok URLs change each time you restart. For permanent URLs, you need a paid plan OR use localtunnel (free, permanent URLs).

### Using localtunnel (Free, Permanent URLs)

1. **Install localtunnel:**
   ```bash
   npm install -g localtunnel
   ```

2. **Start backend:**
   ```bash
   cd backend
   python main.py
   ```

3. **Create tunnel:**
   ```bash
   lt --port 8000 --subdomain your-unique-name
   ```
   
   You'll get: `https://your-unique-name.loca.lt`

4. **Update frontend and serve:**
   - Same as ngrok steps above
   - Use localtunnel URL instead

---

## Option 3: Router Port Forwarding (Most Permanent)

If you have router access, forward ports to your server.

### Setup

1. **Configure router port forwarding:**
   - Forward external port 8000 → server IP:8000 (backend)
   - Forward external port 3000 → server IP:3000 (frontend)
   - Or use reverse proxy (nginx) on port 80/443

2. **Find your public IP:**
   ```bash
   curl ifconfig.me
   # Or visit https://whatismyipaddress.com
   ```

3. **Update frontend:**
   ```env
   REACT_APP_API_URL=http://YOUR_PUBLIC_IP:8000
   ```

4. **Access from Android:**
   - `http://YOUR_PUBLIC_IP:3000`
   - Works from anywhere!

**Security Note:** Exposing ports directly is less secure. Consider using a reverse proxy with SSL.

---

## Recommended: Hybrid Setup (Best of Both Worlds)

Use local network when at home, ngrok when away.

### Smart Frontend Configuration

Create a script that detects network and uses appropriate URL:

**frontend/src/config.ts:**
```typescript
// Auto-detect if on local network
const isLocalNetwork = window.location.hostname === '192.168.1.100' || 
                       window.location.hostname === 'localhost' ||
                       window.location.hostname.includes('.local');

export const API_URL = isLocalNetwork 
  ? 'http://192.168.1.100:8000'  // Local network
  : 'https://your-ngrok-url.ngrok.io';  // Remote access
```

---

## Running as a Service (Keep Running After Reboot)

### Linux (systemd)

Create `/etc/systemd/system/ephemera-backend.service`:
```ini
[Unit]
Description=Vintage Ephemera Backend
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/project/backend
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 /path/to/project/backend/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable ephemera-backend
sudo systemctl start ephemera-backend
sudo systemctl status ephemera-backend
```

### Windows (Task Scheduler or NSSM)

**Using NSSM (Non-Sucking Service Manager):**

1. Download NSSM: https://nssm.cc/download
2. Install service:
   ```cmd
   nssm install EphemeraBackend
   ```
3. Configure:
   - Path: `C:\Python\python.exe` (or your Python path)
   - Startup directory: `C:\path\to\project\backend`
   - Arguments: `main.py`
4. Start service:
   ```cmd
   nssm start EphemeraBackend
   ```

---

## Quick Start Script

Create `start-server.sh` on your server:

```bash
#!/bin/bash

# Start backend
cd /path/to/project/backend
python3 main.py &
BACKEND_PID=$!

# Start frontend server
cd /path/to/project/frontend/build
python3 -m http.server 3000 &
FRONTEND_PID=$!

# Start ngrok (optional)
# ngrok http 8000 &

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Backend: http://$(hostname -I | awk '{print $1}'):8000"
echo "Frontend: http://$(hostname -I | awk '{print $1}'):3000"

# Keep script running
wait
```

Make executable:
```bash
chmod +x start-server.sh
./start-server.sh
```

---

## Android Phone Setup

### Option A: Use Browser
- Open Chrome/Firefox
- Navigate to your server URL
- Add to home screen for app-like experience

### Option B: Create Web App Shortcut
1. Open your app in browser
2. Menu → "Add to Home Screen"
3. Now it's like a native app!

---

## Troubleshooting

### "Connection refused" from phone
- Check firewall on server allows port 8000 and 3000
- Verify phone is on same network
- Check server IP address is correct

### CORS errors
- Backend CORS should allow all origins (`allow_origins=["*"]`)
- Check backend logs for CORS errors

### Can't access from outside network
- Check router firewall settings
- Verify port forwarding is configured
- Use ngrok/localtunnel for testing

### Backend stops after closing terminal
- Use systemd service (Linux)
- Use screen/tmux to keep it running
- Use PM2 or similar process manager

---

## Security Considerations

1. **Local Network Only**: Most secure, only accessible on your WiFi
2. **ngrok/localtunnel**: URLs are public but random, moderate security
3. **Port Forwarding**: Exposes your server, use firewall rules
4. **HTTPS**: Consider using nginx with Let's Encrypt for SSL

---

## Cost Comparison

| Method | Cost | Setup Time | Accessibility |
|--------|------|------------|---------------|
| Local Network | FREE | 5 min | Home only |
| ngrok (free) | FREE | 10 min | Anywhere (URL changes) |
| localtunnel | FREE | 10 min | Anywhere (permanent URL) |
| Port Forwarding | FREE | 15 min | Anywhere (needs router access) |
| Cloud (Railway/Render) | $5-20/mo | 30 min | Anywhere (most reliable) |

**Recommendation**: Start with local network, add ngrok for remote access when needed!
