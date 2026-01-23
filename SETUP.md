# Setup Guide

## Prerequisites

- Docker Desktop (or Docker + Docker Compose)
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Quick Start

1. **Clone or navigate to the project directory**

2. **Create a `.env` file in the root directory:**
   ```bash
   OPENAI_API_KEY=sk-your-actual-api-key-here
   MAX_IMAGES_PER_BATCH=200
   ```

3. **Build and start the services:**
   ```bash
   docker-compose up --build
   ```

4. **Open your browser:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## First Run

1. The first build will take a few minutes to download dependencies
2. Once both services are running, you should see:
   - `backend_1  | Uvicorn running on http://0.0.0.0:8000`
   - `frontend_1 | Compiled successfully!`

## Testing the System

1. Go to http://localhost:3000
2. Enter a box ID (e.g., "BOX34")
3. Upload a few test images (JPG, PNG, or HEIC)
4. Click "Process Batch"
5. Wait for processing to complete
6. CSV should download automatically
7. Review results in the table

## Troubleshooting

### Backend won't start
- Check that `OPENAI_API_KEY` is set in `.env`
- Check Docker logs: `docker-compose logs backend`

### Frontend won't start
- Check Docker logs: `docker-compose logs frontend`
- Ensure port 3000 is not in use

### Images not processing
- Check OpenAI API key is valid
- Check backend logs for error messages
- Verify images are valid JPG/PNG/HEIC format

### CSV not downloading
- Check browser console for errors
- Ensure popup blocker is disabled
- Try manual download button

## Development Mode

### Run Backend Locally (without Docker)

```bash
cd backend
pip install -r requirements.txt
# Create .env file with OPENAI_API_KEY
uvicorn main:app --reload
```

### Run Frontend Locally (without Docker)

```bash
cd frontend
npm install
npm start
```

Note: Update `REACT_APP_API_URL` in frontend if backend is on different port.

## Stopping the Services

Press `Ctrl+C` in the terminal, or:
```bash
docker-compose down
```

To remove volumes (deletes uploaded images and exports):
```bash
docker-compose down -v
```
