import React from 'react';
import { TriageItem } from './TriageCard';
import { openEbayComps } from '../services/ebaySearch';

interface TriageCardDetailProps {
  item: TriageItem;
  onClose: () => void;
  onApprove: (item: TriageItem) => void;
  onReject: (item: TriageItem) => void;
  onEdit?: (item: TriageItem) => void;
}

const TriageCardDetail: React.FC<TriageCardDetailProps> = ({
  item,
  onClose,
  onApprove,
  onReject,
  onEdit
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Status Header */}
        <div className={`status-strip ${getStatusClass()}`} style={{ padding: '12px 16px' }}>
          <span style={{ fontSize: '13px' }}>{getStatusText()}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="status-btn reject"
              onClick={() => onReject(item)}
              title="Reject"
              style={{ width: '36px', height: '36px', fontSize: '18px' }}
            >
              ✕
            </button>
            <button
              className="status-btn approve"
              onClick={() => onApprove(item)}
              title="Approve"
              style={{ width: '36px', height: '36px', fontSize: '18px' }}
            >
              ✓
            </button>
          </div>
        </div>

        {/* Main Image */}
        {item.image_data ? (
          <img
            src={item.image_data}
            alt={item.title}
            style={{
              width: '100%',
              maxHeight: '50vh',
              objectFit: 'contain',
              background: '#F3F4F6'
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '200px',
            background: '#F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            opacity: 0.3
          }}>
            📷
          </div>
        )}

        {/* Info Panel */}
        <div style={{ padding: '20px' }}>
          <h2 style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '22px',
            fontWeight: 700,
            margin: '0 0 16px 0',
            color: 'var(--text-main)'
          }}>
            {item.title || 'Untitled Item'}
          </h2>

          {/* Badges Row */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {/* eBay Search Button */}
            <button
              className="badge badge-btn"
              onClick={() => openEbayComps(item.title || '')}
            >
              🔍 No Comps Found
            </button>

            {/* Year Badge */}
            {item.year && (
              <span className="badge">
                📅 {item.year}
              </span>
            )}

            {/* Type Badge */}
            {item.type && (
              <span className="badge">
                📁 {item.type}
              </span>
            )}
          </div>

          {/* Notes */}
          {item.notes && (
            <p style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              margin: '0 0 16px 0',
              lineHeight: 1.6
            }}>
              {item.notes}
            </p>
          )}

          {/* Confidence */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px'
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              AI Confidence:
            </span>
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--primary)'
            }}>
              {item.confidence || 'N/A'}
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {onEdit && (
              <button
                className="btn-seamless btn-ghost"
                onClick={() => onEdit(item)}
                style={{ flex: 1 }}
              >
                ✏️ Edit
              </button>
            )}
            <button
              className="btn-seamless btn-ghost"
              onClick={onClose}
              style={{ flex: 1 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TriageCardDetail;
