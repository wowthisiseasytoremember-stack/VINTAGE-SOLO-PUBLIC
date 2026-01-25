import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface NewSessionCardProps {
  boxId: string;
  onBoxIdChange: (value: string) => void;
  onFilesSelected: (files: File[]) => void;
  onStartCataloging: () => void;
  isProcessing?: boolean;
  selectedCount?: number;
}

const NewSessionCard: React.FC<NewSessionCardProps> = ({
  boxId,
  onBoxIdChange,
  onFilesSelected,
  onStartCataloging,
  isProcessing = false,
  selectedCount = 0
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesSelected(acceptedFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    disabled: isProcessing
  });

  return (
    <div className="card" style={{ margin: '16px', padding: '24px', position: 'relative' }}>
      <h2 style={{
        fontFamily: 'Outfit, sans-serif',
        fontSize: '24px',
        fontWeight: 800,
        margin: '0 0 8px 0',
        color: 'var(--text-main)'
      }}>
        ✨ Start Cataloging
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
        Identify your vintage items in seconds using AI.
      </p>

      {/* Step 1: Box Name */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Step 1: Where is this from?
        </label>
        <input
          type="text"
          placeholder="e.g. Atttc Box #1, Garage Shelf B"
          value={boxId}
          onChange={(e) => onBoxIdChange(e.target.value)}
          disabled={isProcessing}
          style={{ 
            padding: '12px 16px',
            fontSize: '15px',
            border: boxId ? '2px solid var(--primary)' : '2px solid #E5E7EB',
            transition: 'border-color 0.2s'
          }}
        />
      </div>

      {/* Step 2: Photos */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Step 2: Take or Pick Photos
        </label>
        <div
          {...getRootProps()}
          className={`dropzone-container ${isDragActive ? 'active' : ''}`}
          style={{ 
            padding: '40px 20px',
            borderStyle: 'dashed',
            borderWidth: '2px',
            borderColor: selectedCount > 0 ? 'var(--primary)' : '#E5E7EB',
            background: selectedCount > 0 ? 'rgba(79, 70, 229, 0.03)' : 'transparent',
            borderRadius: '16px'
          }}
        >
          <input {...getInputProps()} />
          <span style={{ 
            fontSize: '48px', 
            marginBottom: '12px',
            display: 'block',
            textAlign: 'center'
          }}>
            {selectedCount > 0 ? '✅' : '📸'}
          </span>
          <p style={{
            margin: 0,
            color: 'var(--text-main)',
            fontSize: '15px',
            fontWeight: 500,
            textAlign: 'center'
          }}>
            {isDragActive 
              ? 'Drop them here!' 
              : selectedCount > 0 
                ? `${selectedCount} Photo${selectedCount > 1 ? 's' : ''} Ready!`
                : 'Tap to Launch Camera'
            }
          </p>
          {!selectedCount && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '8px' }}>
              Or select from your gallery
            </p>
          )}
        </div>
      </div>

      {/* Step 3: Start */}
      <button
        className="btn-seamless btn-primary"
        onClick={onStartCataloging}
        disabled={isProcessing || selectedCount === 0}
        style={{ 
          padding: '16px',
          fontSize: '18px',
          fontWeight: 800,
          boxShadow: selectedCount > 0 ? '0 10px 15px -3px rgba(79, 70, 229, 0.3)' : 'none',
          transform: selectedCount > 0 ? 'scale(1.02)' : 'none',
          transition: 'all 0.2s ease',
          opacity: (isProcessing || selectedCount === 0) ? 0.6 : 1
        }}
      >
        {isProcessing ? '⌛ ANALYZING...' : `Step 3: RUN AI IDENTIFICATION`}
      </button>
    </div>
  );
};

export default NewSessionCard;
