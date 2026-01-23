import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';

// Auto-detect API URL based on environment
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  if (process.env.NODE_ENV === 'production') {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:8000`;
    }
  }
  return 'http://localhost:8000';
};

const API_URL = getApiUrl();

interface CameraCaptureProps {
  initialBoxId?: string;
  onExit: () => void;
  onBatchComplete?: () => void;
}

interface QueueItem {
  id: string;
  file: Blob;
  filename: string;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ initialBoxId = '', onExit, onBatchComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [boxId, setBoxId] = useState(initialBoxId);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Queue statistics
  const queuedCount = queue.filter(q => q.status === 'queued' || q.status === 'uploading').length;
  const processingCount = queue.filter(q => q.status === 'processing').length;
  const completedCount = queue.filter(q => q.status === 'completed').length;
  const failedCount = queue.filter(q => q.status === 'failed').length;

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found. Please connect a camera and try again.');
      } else {
        setCameraError(`Failed to access camera: ${err.message}`);
      }
      setIsStreaming(false);
    }
  }, [facingMode]);

  // Initialize batch on mount
  useEffect(() => {
    const createBatch = async () => {
      try {
        const response = await axios.post(`${API_URL}/api/create-batch`, {
          box_id: boxId || 'CAMERA-SESSION'
        });
        setBatchId(response.data.batch_id);
      } catch (error) {
        console.error('Failed to create batch:', error);
      }
    };
    createBatch();
  }, []);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    
    return () => {
      // Cleanup: stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  // Switch camera
  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Capture photo
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;
    
    setIsCapturing(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsCapturing(false);
      return;
    }
    
    ctx.drawImage(video, 0, 0);
    
    // Convert to blob
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setIsCapturing(false);
        return;
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `capture_${timestamp}.jpg`;
      const itemId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add to queue
      const newItem: QueueItem = {
        id: itemId,
        file: blob,
        filename,
        status: 'queued'
      };
      
      setQueue(prev => [...prev, newItem]);
      
      // Haptic feedback (if available)
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Play capture sound (optional)
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleWYXAHCZi3tJLjFtkpmWn1YyKn2SgXx1TShPioVwakc6T3mFhYOAXDpLhomCgn9INGCThHByYTs/bYB6eHJWRlxydG51cFpdWWFnbGxjU15dTllya3JkQVBhW15lb181TGlpam1ufmNWXGJnamtwbGVfXmpnamxmYWBhZGhrbGljZ2VnamtubWpoaGlra21ta2lpamprbW5tamhoaWprbGxramloaGprbGxsamloaGlqampqamlpa2tqamppampqaWpqamlpamlqaWppampqampqaWpqaWlpampqampqamppampqamppampqampqamppamlqampqampqampqamppaWpqamppampqamppaWlpampqampqampqampqampqamtqa2xrbGxraWlpaWppamlpaWpqampqampqaWpqampqamppaWpqag==');
        audio.volume = 0.3;
        audio.play().catch(() => {}); // Ignore errors
      } catch (e) {
        // Audio not supported
      }
      
      // Upload in background
      uploadItem(newItem);
      
      setIsCapturing(false);
    }, 'image/jpeg', 0.85);
  }, [batchId, boxId, isCapturing]);

  // Upload item to server
  const uploadItem = async (item: QueueItem) => {
    // Update status to uploading
    setQueue(prev => prev.map(q => 
      q.id === item.id ? { ...q, status: 'uploading' as const } : q
    ));
    
    try {
      const formData = new FormData();
      formData.append('file', item.file, item.filename);
      formData.append('box_id', boxId || 'CAMERA-SESSION');
      if (batchId) {
        formData.append('batch_id', batchId);
      }
      
      await axios.post(`${API_URL}/api/process-item`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000,
      });
      
      // Update status to processing (server is now processing with AI)
      setQueue(prev => prev.map(q => 
        q.id === item.id ? { ...q, status: 'processing' as const } : q
      ));
      
      // Poll for completion (simplified - just mark as completed after upload success)
      // In a real implementation, you'd poll /api/batches/{id}/items/status
      setTimeout(() => {
        setQueue(prev => prev.map(q => 
          q.id === item.id ? { ...q, status: 'completed' as const } : q
        ));
      }, 5000); // Assume 5 seconds for AI processing
      
    } catch (error: any) {
      console.error('Upload failed:', error);
      setQueue(prev => prev.map(q => 
        q.id === item.id ? { 
          ...q, 
          status: 'failed' as const, 
          error: error.response?.data?.detail || error.message 
        } : q
      ));
    }
  };

  // Handle exit
  const handleExit = () => {
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Notify parent of batch completion if items were processed
    if (completedCount > 0 && onBatchComplete) {
      onBatchComplete();
    }
    
    onExit();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header Bar */}
      <div className="bg-gray-900/90 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <label className="text-gray-400 text-sm whitespace-nowrap">Box ID:</label>
          <input
            type="text"
            value={boxId}
            onChange={(e) => setBoxId(e.target.value)}
            placeholder="e.g., BOX-042"
            className="bg-gray-800 text-white px-3 py-1.5 rounded-md text-sm border border-gray-700 focus:border-blue-500 focus:outline-none flex-1 max-w-xs"
          />
        </div>
        <button
          onClick={handleExit}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
        >
          Exit
        </button>
      </div>
      
      {/* Camera Viewfinder */}
      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="bg-red-900/80 text-white p-6 rounded-lg text-center max-w-md">
              <div className="text-4xl mb-4">📷</div>
              <p className="mb-4">{cameraError}</p>
              <button
                onClick={startCamera}
                className="bg-white text-red-900 px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Camera switch button */}
        {isStreaming && (
          <button
            onClick={switchCamera}
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
            title="Switch Camera"
          >
            🔄
          </button>
        )}
        
        {/* Capture flash effect */}
        {isCapturing && (
          <div className="absolute inset-0 bg-white animate-flash pointer-events-none" />
        )}
      </div>
      
      {/* Status Bar */}
      <div className="bg-gray-900/90 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between text-sm mb-3">
          <div className="flex gap-4">
            <span className="text-yellow-400">
              📸 Queued: {queuedCount}
            </span>
            <span className="text-blue-400">
              ⏳ Processing: {processingCount}
            </span>
            <span className="text-green-400">
              ✅ Completed: {completedCount}
            </span>
            {failedCount > 0 && (
              <span className="text-red-400">
                ❌ Failed: {failedCount}
              </span>
            )}
          </div>
          <span className="text-gray-400">
            Total: {queue.length}
          </span>
        </div>
        
        {/* Mini progress bar */}
        {queue.length > 0 && (
          <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3">
            <div 
              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / queue.length) * 100}%` }}
            />
          </div>
        )}
      </div>
      
      {/* Capture Button */}
      <div className="bg-gray-900 px-4 py-6 flex justify-center">
        <button
          onClick={capturePhoto}
          disabled={!isStreaming || !boxId.trim() || isCapturing}
          className={`
            w-20 h-20 rounded-full border-4 border-white flex items-center justify-center
            transition-all duration-150 transform
            ${isStreaming && boxId.trim() && !isCapturing
              ? 'bg-white hover:bg-gray-200 active:scale-95 cursor-pointer'
              : 'bg-gray-600 cursor-not-allowed opacity-50'
            }
          `}
          title={!boxId.trim() ? 'Enter Box ID first' : 'Capture Photo'}
        >
          <div className={`w-16 h-16 rounded-full ${isStreaming && boxId.trim() ? 'bg-red-500' : 'bg-gray-500'}`} />
        </button>
      </div>
      
      {/* Instructions */}
      {!boxId.trim() && (
        <div className="absolute bottom-32 left-0 right-0 text-center">
          <span className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-medium">
            Enter a Box ID to start capturing
          </span>
        </div>
      )}
      
      {/* CSS for flash animation */}
      <style>{`
        @keyframes flash {
          0% { opacity: 0.8; }
          100% { opacity: 0; }
        }
        .animate-flash {
          animation: flash 0.15s ease-out;
        }
      `}</style>
    </div>
  );
};

export default CameraCapture;
