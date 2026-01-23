import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';
import ReviewTable from './components/ReviewTable';
import BatchHistory from './components/BatchHistory';
import GoogleDrivePicker from './components/GoogleDrivePicker';
import GoogleSignIn from './components/GoogleSignIn';
import ServerControl from './components/ServerControl';
import ImageProgressList from './components/ImageProgressList';
import CameraCapture from './components/CameraCapture';
import { useAuth } from './contexts/AuthContext';

interface ProcessedItem {
  filename: string;
  box_id: string;
  title: string;
  type: string;
  year?: string;
  notes?: string;
  confidence: string;
  processed_at: string;
}

interface BatchResult {
  batch_id: string;
  box_id: string;
  total_images: number;
  processed: number;
  failed: number;
  items: ProcessedItem[];
  created_at?: string;
  status?: string; // pending, processing, completed, failed
  current_image_index?: number;
}

interface BatchProgress {
  batch_id: string;
  status: string;
  total_images: number;
  processed: number;
  failed: number;
  current_image_index: number;
  current_filename?: string;
  last_updated?: string;
}

interface ItemStatus {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string | null;
}

interface BatchSummary {
  batch_id: string;
  box_id: string;
  total_images: number;
  processed: number;
  failed: number;
  created_at: string;
}

// Auto-detect API URL based on environment
const getApiUrl = () => {
  // Use environment variable if set
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // In production build, try to detect server
  if (process.env.NODE_ENV === 'production') {
    // Use same hostname as frontend, different port
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:8000`;
    }
  }
  
  // Default to localhost for development
  return 'http://localhost:8000';
};

const API_URL = getApiUrl();

function App() {
  const { token, loading: authLoading } = useAuth();
  const [boxId, setBoxId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '', currentFilename: '' });
  const [processingLog, setProcessingLog] = useState<Array<{time: string; message: string}>>([]);
  const [imageStatuses, setImageStatuses] = useState<ItemStatus[]>([]);
  const [batchStartTime, setBatchStartTime] = useState<Date | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null);
  const [googleDriveFiles, setGoogleDriveFiles] = useState<Array<{fileId: string; filename: string; accessToken: string}>>([]);
  const [uploadSource, setUploadSource] = useState<'local' | 'google'>('local');
  const [showCameraMode, setShowCameraMode] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev: File[]) => [...prev, ...acceptedFiles]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic', '.heif']
    },
    maxFiles: 1000, // Allow more files, we'll split into batches automatically
    multiple: true
  });

  const removeFile = (index: number) => {
    setFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index));
  };

  const downloadCSV = (data: BatchResult) => {
    try {
      // Escape CSV values properly
      const escapeCSV = (value: string): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // If contains comma, quote, or newline, wrap in quotes and escape quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = [
        ['filename', 'box_id', 'title', 'type', 'year', 'notes', 'confidence', 'processed_at'],
        ...data.items.map(item => [
          escapeCSV(item.filename),
          escapeCSV(item.box_id),
          escapeCSV(item.title || ''),
          escapeCSV(item.type || ''),
          escapeCSV(item.year || ''),
          escapeCSV(item.notes || ''),
          escapeCSV(item.confidence || ''),
          escapeCSV(item.processed_at)
        ])
      ];

      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      
      // Add BOM for Excel compatibility with UTF-8
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      // Create safe filename
      const safeBoxId = data.box_id.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 50);
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      link.setAttribute('href', url);
      link.setAttribute('download', `${safeBoxId}_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading CSV:', error);
      setError('Failed to download CSV. Please try again.');
    }
  };

  const pollProgress = async (batchId: string) => {
    try {
      const [progressResponse, statusResponse] = await Promise.all([
        axios.get<BatchProgress>(`${API_URL}/api/batches/${batchId}/progress`),
        axios.get<ItemStatus[]>(`${API_URL}/api/batches/${batchId}/items/status`)
      ]);
      const prog = progressResponse.data;
      const statuses = statusResponse.data;
      
      // Update image statuses
      setImageStatuses(statuses);
      
      // Track batch start time when processing begins
      if (prog.status === 'processing' && !batchStartTime) {
        setBatchStartTime(new Date());
      }
      
      // Add log entry for every progress update (show all activity)
      if (prog.status === 'processing') {
        setProcessingLog(prev => {
          const lastProcessed = prev.length > 0 ? 
            parseInt(prev[prev.length - 1].message.match(/(\d+)\/(\d+)/)?.[1] || '0') : 0;
          
          // Add entry if progress changed or if we have a new filename
          if (prog.processed !== lastProcessed || 
              (prog.current_filename && prev.length === 0) ||
              (prog.current_filename && prev[prev.length - 1]?.message !== `Processing ${prog.processed + 1}/${prog.total_images}: ${prog.current_filename}`)) {
            const newEntry = {
              time: new Date().toLocaleTimeString(),
              message: prog.current_filename 
                ? `Processing ${prog.processed + 1}/${prog.total_images}: ${prog.current_filename}`
                : `Progress: ${prog.processed}/${prog.total_images} images`
            };
            // Keep last 100 entries for large batches
            return [...prev.slice(-99), newEntry];
          }
          return prev;
        });
      }
      
      setProgress({
        current: prog.processed,
        total: prog.total_images,
        status: prog.status,
        currentFilename: prog.current_filename || ''
      });

      // If completed, load full batch data
      if (prog.status === 'completed') {
        if (progressInterval) {
          clearInterval(progressInterval);
          setProgressInterval(null);
        }
        setProcessingLog(prev => [...prev, {
          time: new Date().toLocaleTimeString(),
          message: `✅ Completed! Processed ${prog.processed}/${prog.total_images} images`
        }]);
        const batchResponse = await axios.get<BatchResult>(`${API_URL}/api/batches/${batchId}`);
        setBatchResult(batchResponse.data);
        // downloadCSV(batchResponse.data);
        loadBatchHistory();
        setProcessing(false);
        setCurrentBatchId(null);
      } else if (prog.status === 'failed') {
        if (progressInterval) {
          clearInterval(progressInterval);
          setProgressInterval(null);
        }
        setError('Batch processing failed. You can try resuming from Batch History.');
        setProcessing(false);
        setCurrentBatchId(null);
      }
    } catch (error) {
      console.error('Error polling progress:', error);
    }
  };

  // Add auth token to axios requests
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const processBatch = async () => {
    if (!boxId.trim()) {
      setError('Please enter a box ID');
      return;
    }

    if (uploadSource === 'local' && files.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    if (uploadSource === 'google' && googleDriveFiles.length === 0) {
      setError('Please select at least one image from Google Drive');
      return;
    }

    const totalFiles = uploadSource === 'local' ? files.length : googleDriveFiles.length;
    // Note: Backend will automatically chunk batches >200 images

    setProcessing(true);
    setError(null);
    setProcessingLog([{ time: new Date().toLocaleTimeString(), message: `Starting batch processing for ${totalFiles} images...` }]);
    setProgress({ current: 0, total: totalFiles, status: 'pending', currentFilename: '' });

    try {
      let response: any;

      if (uploadSource === 'local') {
        // Process local files
        const formData = new FormData();
        formData.append('box_id', boxId.trim());
        files.forEach((file: File) => {
          formData.append('files', file);
        });

        response = await axios.post<BatchResult>(
          `${API_URL}/api/process-batch`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            timeout: 300000, // 5 minutes for upload
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percentCompleted = Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total
                );
                setProgress({
                  current: Math.round((percentCompleted / 100) * files.length),
                  total: files.length,
                  status: 'uploading',
                  currentFilename: ''
                });
              }
            },
          }
        );
      } else {
        // Process Google Drive files
        response = await axios.post<BatchResult>(
          `${API_URL}/api/process-batch-google-drive`,
          {
            box_id: boxId.trim(),
            files: googleDriveFiles
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 300000,
          }
        );
      }

      // Batch started, now poll for progress
      setCurrentBatchId(response.data.batch_id);
      setBatchStartTime(new Date());
      setProgress({ 
        current: 0, 
        total: response.data.total_images, 
        status: 'processing',
        currentFilename: ''
      });
      
      // Start polling every 2 seconds
      const interval = setInterval(() => {
        pollProgress(response.data.batch_id);
      }, 2000);
      setProgressInterval(interval);
      
      // Initial poll
      pollProgress(response.data.batch_id);
      
    } catch (err: any) {
      let errorMessage = 'Failed to process batch';
      
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Upload timed out. The batch may be too large. Try processing fewer images at once.';
      } else if (err.response?.status === 400) {
        errorMessage = err.response.data?.detail || 'Invalid request. Please check your input.';
      } else if (err.response?.status === 413) {
        errorMessage = 'File(s) too large. Maximum file size is 50MB.';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error('Processing error:', err);
      setProcessing(false);
      if (progressInterval) {
        clearInterval(progressInterval);
        setProgressInterval(null);
      }
    }
  };

  const resetBatch = () => {
    setFiles([]);
    setGoogleDriveFiles([]);
    setBoxId('');
    setBatchResult(null);
    setError(null);
    setCurrentBatchId(null);
    setImageStatuses([]);
    setBatchStartTime(null);
    setUploadSource('local');
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
  };
  
  // Calculate ETA
  const calculateETA = (): string => {
    if (!batchStartTime || progress.current === 0 || progress.total === 0) {
      return 'Calculating...';
    }
    
    const elapsed = (new Date().getTime() - batchStartTime.getTime()) / 1000; // seconds
    const avgTimePerImage = elapsed / progress.current;
    const remaining = progress.total - progress.current;
    const etaSeconds = remaining * avgTimePerImage;
    
    if (etaSeconds < 60) {
      return `~${Math.round(etaSeconds)} sec`;
    } else {
      const minutes = Math.floor(etaSeconds / 60);
      const seconds = Math.round(etaSeconds % 60);
      return `~${minutes} min ${seconds} sec`;
    }
  };

  const handleGoogleDriveFiles = (selectedFiles: Array<{fileId: string; filename: string; accessToken: string}>) => {
    setGoogleDriveFiles(selectedFiles);
    setError(null);
  };

  const resumeBatch = async (batchId: string) => {
    try {
      setProcessing(true);
      setCurrentBatchId(batchId);
      setError(null);
      
      await axios.post(`${API_URL}/api/batches/${batchId}/resume`);
      
      // Start polling
      const interval = setInterval(() => {
        pollProgress(batchId);
      }, 2000);
      setProgressInterval(interval);
      pollProgress(batchId);
      
    } catch (error: any) {
      setError('Failed to resume batch: ' + (error.response?.data?.detail || error.message));
      setProcessing(false);
      setCurrentBatchId(null);
    }
  };

  const loadBatchHistory = async () => {
    try {
      const response = await axios.get<BatchSummary[]>(`${API_URL}/api/batches?limit=20`);
      setBatches(response.data);
    } catch (error) {
      console.error('Error loading batch history:', error);
    }
  };

  const loadBatch = async (batchId: string) => {
    try {
      const response = await axios.get<BatchResult>(`${API_URL}/api/batches/${batchId}`);
      setBatchResult(response.data);
      setShowHistory(false);
      // Items already have database IDs from the backend
    } catch (error: any) {
      setError('Failed to load batch: ' + (error.response?.data?.detail || error.message));
    }
  };

  const downloadBatchCSV = async (batchId: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/batches/${batchId}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `batch_${batchId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert('Failed to download CSV: ' + (error.response?.data?.detail || error.message));
    }
  };

  useEffect(() => {
    loadBatchHistory();
    
    // Load state from localStorage on mount
    const savedBatchId = localStorage.getItem('currentBatchId');
    const savedBoxId = localStorage.getItem('boxId');
    const savedBatchResult = localStorage.getItem('lastBatchResult');
    
    if (savedBatchId) {
      setCurrentBatchId(savedBatchId);
      // Resume polling if batch was in progress
      const interval = setInterval(() => {
        pollProgress(savedBatchId);
      }, 2000);
      setProgressInterval(interval);
      pollProgress(savedBatchId);
    }
    if (savedBoxId) {
      setBoxId(savedBoxId);
    }
    if (savedBatchResult) {
      try {
        const parsed = JSON.parse(savedBatchResult);
        setBatchResult(parsed);
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    // Cleanup interval on unmount
    return () => {
      // progressInterval cleanup handled by state
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - dependencies handled internally
  
  // Save state to localStorage
  useEffect(() => {
    if (currentBatchId) {
      localStorage.setItem('currentBatchId', currentBatchId);
    } else {
      localStorage.removeItem('currentBatchId');
    }
  }, [currentBatchId]);
  
  useEffect(() => {
    if (boxId) {
      localStorage.setItem('boxId', boxId);
    }
  }, [boxId]);
  
  useEffect(() => {
    if (batchResult) {
      localStorage.setItem('lastBatchResult', JSON.stringify(batchResult));
    }
  }, [batchResult]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Authentication is optional - show sign-in option but don't block access

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <ServerControl />
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Vintage Ephemera Cataloging System
              </h1>
              <p className="text-gray-600">
                Upload images of vintage paper ephemera to automatically catalog them with AI
              </p>
            </div>
            <div className="flex items-center gap-4">
              <GoogleSignIn />
              <button
                onClick={() => setShowCameraMode(true)}
                className="bg-green-600 text-white py-2 px-6 rounded-md font-medium hover:bg-green-700 transition-colors"
              >
                📷 Camera Mode
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="bg-gray-600 text-white py-2 px-6 rounded-md font-medium hover:bg-gray-700 transition-colors"
              >
                {showHistory ? 'New Batch' : 'Batch History'}
              </button>
            </div>
          </div>
        </header>

        {/* Camera Mode Overlay */}
        {showCameraMode && (
          <CameraCapture
            initialBoxId={boxId}
            onExit={() => setShowCameraMode(false)}
            onBatchComplete={loadBatchHistory}
          />
        )}

        {showHistory ? (
          <BatchHistory
            batches={batches}
            onLoadBatch={loadBatch}
            onDownloadCSV={downloadBatchCSV}
            onRefresh={loadBatchHistory}
            onResume={resumeBatch}
          />
        ) : (
          <>

        {!batchResult ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-6">
              <label htmlFor="box-id" className="block text-sm font-medium text-gray-700 mb-2">
                Box ID
              </label>
              <input
                id="box-id"
                type="text"
                value={boxId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBoxId(e.target.value)}
                placeholder="e.g., BOX34"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={processing}
              />
            </div>

            <div className="mb-6">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setUploadSource('local')}
                  disabled={processing}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    uploadSource === 'local'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Local Files
                </button>
                <button
                  onClick={() => setUploadSource('google')}
                  disabled={processing}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    uploadSource === 'google'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Google Drive
                </button>
              </div>

              {uploadSource === 'local' ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Images ({files.length} selected)
                  </label>
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragActive
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input {...getInputProps()} disabled={processing} />
                    <p className="text-gray-600">
                      {isDragActive
                        ? 'Drop the images here...'
                        : 'Drag & drop images here, or click to select'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Supports JPG, PNG, HEIC (large batches auto-split)
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select from Google Drive ({googleDriveFiles.length} selected)
                  </label>
                  <GoogleDrivePicker
                    onFilesSelected={handleGoogleDriveFiles}
                    disabled={processing}
                  />
                </>
              )}

              {uploadSource === 'local' && files.length > 0 && (
                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                  {files.map((file: File, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded"
                    >
                      <span className="text-sm text-gray-700 truncate flex-1">
                        {file.name}
                      </span>
                      {!processing && (
                        <button
                          onClick={() => removeFile(index)}
                          className="ml-2 text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {uploadSource === 'google' && googleDriveFiles.length > 0 && (
                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                  {googleDriveFiles.map((file, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded"
                    >
                      <span className="text-sm text-gray-700 truncate flex-1">
                        {file.filename}
                      </span>
                      {!processing && (
                        <button
                          onClick={() => setGoogleDriveFiles(googleDriveFiles.filter((_, i) => i !== index))}
                          className="ml-2 text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {processing && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {progress.status === 'uploading' 
                      ? `Uploading images... (${progress.current}/${progress.total})`
                      : progress.status === 'processing'
                      ? `Processing with AI... (${progress.current}/${progress.total})`
                      : `Processing... (${progress.current}/${progress.total})`}
                  </span>
                  <div className="flex items-center gap-4">
                    {progress.status === 'processing' && progress.current > 0 && (
                      <span className="text-sm text-blue-600 font-medium">
                        ETA: {calculateETA()}
                      </span>
                    )}
                    <span className="text-sm text-gray-600">
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`
                    }}
                  ></div>
                </div>
                
                {/* Processing Log */}
                {progress.status === 'processing' && (
                  <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-gray-500 text-xs">Processing Log:</div>
                      <div className="flex items-center gap-2">
                        {/* Heartbeat indicator */}
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-gray-500 text-xs">Live</span>
                        </div>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {processingLog.length === 0 ? (
                        <div className="text-gray-600">Starting processing...</div>
                      ) : (
                        processingLog.map((entry, idx) => (
                          <div key={idx} className="mb-1">
                            <span className="text-gray-500">[{entry.time}]</span>{' '}
                            <span>{entry.message}</span>
                          </div>
                        ))
                      )}
                      {progress.currentFilename && (
                        <div className="mt-2 text-yellow-400 border-t border-gray-700 pt-2">
                          → Currently: {progress.currentFilename}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Per-Image Progress List */}
                {progress.status === 'processing' && imageStatuses.length > 0 && (
                  <div className="mt-4">
                    <ImageProgressList items={imageStatuses} />
                  </div>
                )}
                
                {progress.status === 'uploading' && (
                  <p className="text-xs text-gray-500 mt-2">
                    Uploading images to server...
                  </p>
                )}
              </div>
            )}

            <button
              onClick={processBatch}
              disabled={processing || (uploadSource === 'local' && files.length === 0) || (uploadSource === 'google' && googleDriveFiles.length === 0) || !boxId.trim()}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {processing ? 'Processing...' : 'Process Batch'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              <p className="font-medium">Batch processed successfully!</p>
              <p className="text-sm mt-1">
                Processed: {batchResult.processed} / {batchResult.total_images} images
                {batchResult.failed > 0 && ` (${batchResult.failed} failed)`}
              </p>
              <p className="text-sm mt-1">You can download the CSV below.</p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={resetBatch}
                className="bg-blue-600 text-white py-2 px-6 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Process New Batch
              </button>
              <button
                onClick={() => downloadCSV(batchResult)}
                className="bg-gray-600 text-white py-2 px-6 rounded-md font-medium hover:bg-gray-700 transition-colors"
              >
                Download CSV Again
              </button>
            </div>

            <ReviewTable
              items={batchResult.items}
              batchId={batchResult.batch_id}
              onUpdate={async () => {
                // Reload batch data after update
                if (batchResult.batch_id) {
                  await loadBatch(batchResult.batch_id);
                }
              }}
            />
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
