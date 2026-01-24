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
    <div className="card" style={{ margin: '16px', padding: '20px' }}>
      <h2 style={{
        fontFamily: 'Outfit, sans-serif',
        fontSize: '22px',
        fontWeight: 700,
        margin: '0 0 16px 0',
        color: 'var(--text-main)'
      }}>
        New Session
      </h2>

      {/* Box Name Input */}
      <input
        type="text"
        placeholder="Box Name (Optional)"
        value={boxId}
        onChange={(e) => onBoxIdChange(e.target.value)}
        disabled={isProcessing}
        style={{ marginBottom: '16px' }}
      />

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`dropzone-container ${isDragActive ? 'active' : ''}`}
        style={{ marginBottom: '16px' }}
      >
        <input {...getInputProps()} />
        <span style={{ 
          fontSize: '40px', 
          marginBottom: '12px',
          opacity: 0.4
        }}>
          📷
        </span>
        <p style={{
          margin: 0,
          color: 'var(--text-secondary)',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          {isDragActive 
            ? 'Drop photos here...' 
            : selectedCount > 0 
              ? `${selectedCount} photo${selectedCount > 1 ? 's' : ''} selected`
              : 'Tap to Take Photos or Select from Gallery'
          }
        </p>
      </div>

      {/* Start Button */}
      <button
        className="btn-seamless btn-primary"
        onClick={onStartCataloging}
        disabled={isProcessing || selectedCount === 0}
      >
        {isProcessing ? 'Processing...' : 'START CATALOGING'}
      </button>
    </div>
  );
};

export default NewSessionCard;
