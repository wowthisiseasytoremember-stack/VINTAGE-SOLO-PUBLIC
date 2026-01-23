#!/usr/bin/env python3
"""
Start script for local network deployment
Handles IP detection and server startup
"""
import os
import socket
import subprocess
import sys
from pathlib import Path

def get_local_ip():
    """Get the local network IP address"""
    try:
        # Connect to a remote address to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def main():
    # Get local IP
    local_ip = get_local_ip()
    port = os.getenv("PORT", "8000")
    
    print("=" * 60)
    print("Vintage Ephemera Cataloging System - Backend Server")
    print("=" * 60)
    print(f"Local IP: {local_ip}")
    print(f"Port: {port}")
    print(f"Access from network: http://{local_ip}:{port}")
    print(f"Access locally: http://localhost:{port}")
    print("=" * 60)
    print("\nStarting server...\n")
    
    # Change to backend directory
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    # Start uvicorn
    try:
        import uvicorn
        uvicorn.run(
            "main:app",
            host="0.0.0.0",  # Listen on all interfaces
            port=int(port),
            reload=False,  # Disable reload for production
            log_level="info"
        )
    except ImportError:
        print("ERROR: uvicorn not installed. Run: pip install uvicorn[standard]")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nServer stopped.")
        sys.exit(0)

if __name__ == "__main__":
    main()
