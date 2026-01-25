import React, { useState, useRef, useEffect, useCallback } from 'react';



interface CameraCaptureProps {
  initialBoxId?: string;
  onExit: () => void;
  onBatchComplete?: () => void; // Legacy
  onFilesCaptured?: (files: File[], boxId: string) => void;
  standalone?: boolean;
}

interface QueueItem {
  id: string;
  file: Blob;
  filename: string;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ initialBoxId = '', onExit, onBatchComplete, onFilesCaptured, standalone = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [boxId, setBoxId] = useState(initialBoxId);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Batch State
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera not supported. Secure connection (HTTPS) required.');
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setCameraError(err.name === 'NotAllowedError' ? 'Camera permission denied.' : `Camera access failed: ${err.message}`);
    }
  }, [facingMode]);

  useEffect(() => {
    if (!showReview) startCamera();
    return () => streamRef.current?.getTracks().forEach(track => track.stop());
  }, [startCamera, showReview]);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;
    setIsCapturing(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsCapturing(false); return; }
    
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) { setIsCapturing(false); return; }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `capture_${timestamp}.jpg`;
      const itemId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newItem: QueueItem = { id: itemId, file: blob, filename, status: 'queued' };
      setQueue(prev => [...prev, newItem]);
      setLastPreview(URL.createObjectURL(blob));
      
      if (navigator.vibrate) navigator.vibrate(50);
      setIsCapturing(false);
    }, 'image/jpeg', 0.85);
  }, [isCapturing]);

  const handleFinishSession = async () => {
    if (queue.length === 0) {
      onExit();
      return;
    }
    
    setIsProcessingBatch(true);

    try {
      if (onFilesCaptured) {
        // Convert Blobs to Files
        const files = queue.map(item => new File([item.file], item.filename, { type: 'image/jpeg' }));
        onFilesCaptured(files, boxId || 'CAMERA-SESSION');
        // Parent will close the camera
      } else {
        // Fallback or legacy behavior (should not happen in new flow)
        console.warn("No capture handler provided to CameraCapture");
        if (onBatchComplete) onBatchComplete();
        onExit(); 
      }
    } catch (err) {
      console.error("Batch handoff failed:", err);
      onExit();
    }
  };

  const toggleDelete = (id: string) => {
    setSelectedForDelete(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmDelete = () => {
    setQueue(prev => prev.filter(q => !selectedForDelete.has(q.id)));
    setSelectedForDelete(new Set());
    if (queue.length - selectedForDelete.size === 0) setShowReview(false);
  };

  // ========== STYLES ==========
  const containerStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' };
  const topBarStyle: React.CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' };
  const inputStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.3)', fontSize: '16px', fontWeight: 700, width: '180px' };
  const closeButtonStyle: React.CSSProperties = { width: '48px', height: '48px', backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.3)', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const videoStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
  const bottomBarStyle: React.CSSProperties = { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: '30px 20px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' };
  const statsBarStyle: React.CSSProperties = { display: 'flex', gap: '16px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '10px 20px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.2)' };
  const shutterButtonStyle: React.CSSProperties = { width: '80px', height: '80px', borderRadius: '50%', border: '6px solid #fff', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const exitButtonStyle: React.CSSProperties = { width: '100%', maxWidth: '280px', padding: '16px', borderRadius: '20px', border: queue.length > 0 ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.2)', backgroundColor: queue.length > 0 ? '#4f46e5' : 'rgba(255,255,255,0.1)', color: queue.length > 0 ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', cursor: 'pointer' };

  return (
    <div style={containerStyle}>
      <div style={topBarStyle}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: standalone ? '#3b82f6' : '#22c55e', borderRadius: '50%' }} />
            <span style={{ fontSize: '10px', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '2px' }}>{standalone ? 'Fast Mode' : 'Live'}</span>
          </div>
          <input type="text" value={boxId} onChange={(e) => setBoxId(e.target.value)} placeholder="BOX-ID" style={inputStyle} />
        </div>
        {!isProcessingBatch && (
          <button onClick={onExit} style={closeButtonStyle}>✕</button>
        )}
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        {cameraError ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center' }}>
            <div><p style={{ color: '#fff', fontSize: '18px' }}>{cameraError}</p></div>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted style={videoStyle} />
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* REVIEW OVERLAY */}
      {showReview && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#000', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>Review ({queue.length})</h3>
            <button onClick={() => setShowReview(false)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Resume Camera</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {queue.map(item => (
              <div 
                key={item.id} 
                onClick={() => toggleDelete(item.id)}
                style={{ 
                  position: 'relative', 
                  aspectRatio: '1', 
                  borderRadius: '8px', 
                  overflow: 'hidden', 
                  border: selectedForDelete.has(item.id) ? '3px solid #ef4444' : '1px solid #333',
                  opacity: selectedForDelete.has(item.id) ? 0.6 : 1
                }}
              >
                <img src={URL.createObjectURL(item.file)} alt="capture" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {selectedForDelete.has(item.id) && (
                  <div style={{ position: 'absolute', top: '4px', right: '4px', background: '#ef4444', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'white' }}>✕</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: '20px', borderTop: '1px solid #333', display: 'flex', gap: '12px' }}>
            {selectedForDelete.size > 0 ? (
              <button 
                onClick={confirmDelete}
                style={{ flex: 1, padding: '16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px' }}
              >
                Delete Selected ({selectedForDelete.size})
              </button>
            ) : (
              <button 
                onClick={handleFinishSession}
                disabled={isProcessingBatch}
                style={{ flex: 1, padding: '16px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', opacity: isProcessingBatch ? 0.5 : 1 }}
              >
                {isProcessingBatch ? 'Saving...' : `✨ Identify ${queue.length} Items`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* VIEWFINDER UI (Hidden when reviewing) */}
      {!showReview && (
        <div style={bottomBarStyle}>
          <div style={statsBarStyle}>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 800 }}>📂 BOX: {boxId || 'No Name'} • {queue.length} PHOTOS</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px', width: '100%', marginBottom: '10px' }}>
            <div 
              onClick={() => queue.length > 0 && setShowReview(true)}
              style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', border: '3px solid #fff', cursor: 'pointer' }}
            >
              {lastPreview ? <img src={lastPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🖼️</div>}
            </div>
            
            <button onClick={capturePhoto} disabled={isCapturing} style={{ ...shutterButtonStyle, width: '90px', height: '90px' }}>
              <div style={{ width: '65px', height: '65px', borderRadius: '50%', backgroundColor: '#fff', transform: isCapturing ? 'scale(0.8)' : 'scale(1)', transition: 'transform 0.1s' }} />
            </button>

            <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '24px' }}>🔄</button>
          </div>

          <div style={{ width: '100%', display: 'flex', gap: '12px', padding: '0 10px' }}>
            <button 
              onClick={onExit} 
              style={{ ...exitButtonStyle, flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              Cancel
            </button>
            <button 
              onClick={queue.length > 0 ? handleFinishSession : undefined} 
              disabled={queue.length === 0}
              style={{ 
                ...exitButtonStyle, 
                flex: 2, 
                backgroundColor: queue.length > 0 ? '#22c55e' : 'rgba(255,255,255,0.05)', 
                color: '#fff', 
                fontSize: '16px',
                opacity: queue.length > 0 ? 1 : 0.3
              }}
            >
              {queue.length > 0 ? `✨ SAVE & IDENTIFY (${queue.length})` : 'Take some photos first'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;
