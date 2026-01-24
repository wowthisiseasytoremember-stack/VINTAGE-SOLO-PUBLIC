import React from 'react';

export interface TriageItem {
  id?: number;
  filename: string;
  box_id: string;
  title: string;
  type: string;
  year?: string;
  notes?: string;
  confidence: string;
  processed_at: string;
  image_data?: string;
  status?: 'research' | 'approved' | 'rejected';
}

interface TriageCardProps {
  item: TriageItem;
  onCardClick: (item: TriageItem) => void;
  onApprove: (item: TriageItem) => void;
  onReject: (item: TriageItem) => void;
}

const TriageCard: React.FC<TriageCardProps> = ({
  item,
  onCardClick,
  onApprove,
  onReject
}) => {
  const getStatusClass = () => {
    switch (item.status) {
      case 'approved': return 'approved';
      case 'rejected': return 'rejected';
      default: return 'research';
    }
  };

  const getStatusText = () => {
    switch (item.status) {
      case 'approved': return 'APPROVED';
      case 'rejected': return 'REJECTED';
      default: return 'NEEDS RESEARCH';
    }
  };

  return (
    <div className="triage-card" onClick={() => onCardClick(item)}>
      {/* Status Header Strip */}
      <div className={`status-strip ${getStatusClass()}`}>
        <span>{getStatusText()}</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="status-btn reject"
            onClick={(e) => { e.stopPropagation(); onReject(item); }}
            title="Reject"
          >
            ✕
          </button>
          <button
            className="status-btn approve"
            onClick={(e) => { e.stopPropagation(); onApprove(item); }}
            title="Approve"
          >
            ✓
          </button>
        </div>
      </div>

      {/* Image */}
      {item.image_data ? (
        <img
          src={item.image_data}
          alt={item.title}
          className="triage-card-image"
        />
      ) : (
        <div 
          className="triage-card-image" 
          style={{ 
            background: '#F3F4F6', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '32px',
            opacity: 0.3
          }}
        >
          📷
        </div>
      )}

      {/* Footer */}
      <div className="triage-card-footer">
        <h3 className="triage-card-title">{item.title || 'Untitled'}</h3>
        <div className="triage-card-badges">
          <span className="triage-card-badge">
            🔍 No Comps
          </span>
          {item.year && (
            <span className="triage-card-badge">
              📅 {item.year}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TriageCard;
