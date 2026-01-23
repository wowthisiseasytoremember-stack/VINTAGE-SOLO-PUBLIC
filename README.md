# Vintage Ephemera Cataloging System (MVP)

A single-user batch photo processing system to catalog vintage paper ephemera (books, comics, maps, ads, etc.) using AI vision.

## Core Workflow

1. User enters a box identifier (e.g., "BOX34")
2. User uploads batch of images (100-200 images)
3. System processes each image with GPT-4o mini
4. System extracts metadata (title, type, year, notes)
5. User downloads CSV with all items tagged with box ID

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, OpenAI GPT-4o mini
- **Frontend**: React 18, TypeScript, TailwindCSS
- **Infrastructure**: Docker Compose

## Quick Start

### Option 1: Local Network Deployment (Recommended for Free Use)

Run on your always-on server (like a Plex server) and access from your phone:

1. **On your server:**
   ```bash
   # Linux/Mac
   chmod +x start-local.sh
   ./start-local.sh
   
   # Windows
   .\start-local.ps1
   ```

2. **On your Android phone:**
   - Connect to same WiFi network
   - Open browser: `http://YOUR_SERVER_IP:3000`
   - Example: `http://192.168.1.100:3000`

See [LOCAL_NETWORK_SETUP.md](LOCAL_NETWORK_SETUP.md) for detailed instructions.

### Option 2: Docker Compose (Development)

### Prerequisites

- Docker and Docker Compose
- OpenAI API key

### Setup

1. Clone the repository
2. Create a `.env` file in the root directory:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```
3. Build and start the services:
   ```bash
   docker-compose up --build
   ```
4. Open your browser to `http://localhost:3000`

## Usage

1. Enter a box ID (e.g., "BOX34")
2. Drag and drop or select images (JPG, PNG, HEIC supported)
3. Click "Process Batch"
4. Wait for processing to complete
5. CSV will automatically download when finished
6. Review the results in the table

## API Endpoints

- `POST /api/process-batch` - Process a batch of images
- `POST /api/download-csv` - Download CSV (handled automatically)
- `GET /api/health` - Health check

## Configuration

Environment variables:
- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `MAX_IMAGES_PER_BATCH` - Maximum images per batch (default: 200)
- `STORAGE_PATH` - Path for storing uploaded images (default: /app/storage)
- `EXPORTS_PATH` - Path for CSV exports (default: /app/exports)

## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm start
```

## Project Structure

```
.
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile           # Backend Docker image
│   └── .env.example         # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main application component
│   │   ├── components/      # React components
│   │   └── index.tsx        # Entry point
│   ├── package.json         # Node dependencies
│   └── Dockerfile           # Frontend Docker image
├── docker-compose.yml       # Docker Compose configuration
└── README.md               # This file
```

## Notes

- Images are processed synchronously (one at a time)
- HEIC images are automatically converted to JPG
- CSV includes: filename, box_id, title, type, year, notes, confidence, processed_at
- Processing time: ~15 minutes for 100 images (depends on API response time)

## MVP Scope

This is an MVP focused on the core workflow. Features NOT included:
- Multiple AI model support
- Cost tracking
- Manual metadata editing
- User authentication
- Batch history
- Advanced filtering
