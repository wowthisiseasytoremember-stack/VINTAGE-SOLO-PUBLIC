import React, { useState } from 'react';
import { CatalogItem } from './ItemCard';
import { openEbayComps } from '../services/ebaySearch';

interface ItemDetailProps {
  item: CatalogItem;
  onClose: () => void;
  onSave?: (updatedItem: CatalogItem) => void;
  onDelete?: (item: CatalogItem) => void;
}

const ItemDetail: React.FC<ItemDetailProps> = ({ item, onClose, onSave, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState<CatalogItem>({ ...item });

  const handleSave = () => {
    if (onSave) {
      onSave(editedItem);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onDelete && window.confirm('Delete this item? This cannot be undone.')) {
      onDelete(item);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Main Image */}
        {item.image_data ? (
          <img
            src={item.image_data.startsWith('data:') ? item.image_data : `data:image/jpeg;base64,${item.image_data}`}
            alt={item.title}
            style={{
              width: '100%',
              maxHeight: '40vh',
              objectFit: 'contain',
              background: '#F3F4F6'
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '150px',
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
          {isEditing ? (
            /* Edit Mode */
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  TITLE
                </label>
                <input
                  type="text"
                  value={editedItem.title}
                  onChange={(e) => setEditedItem({ ...editedItem, title: e.target.value })}
                  style={{ fontSize: '16px', fontWeight: 600 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    YEAR
                  </label>
                  <input
                    type="text"
                    value={editedItem.year || ''}
                    onChange={(e) => setEditedItem({ ...editedItem, year: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    TYPE
                  </label>
                  <input
                    type="text"
                    value={editedItem.type}
                    onChange={(e) => setEditedItem({ ...editedItem, type: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  NOTES
                </label>
                <textarea
                  value={editedItem.notes || ''}
                  onChange={(e) => setEditedItem({ ...editedItem, notes: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-seamless btn-primary" onClick={handleSave} style={{ flex: 1 }}>
                  💾 Save
                </button>
                <button className="btn-seamless btn-ghost" onClick={() => { setEditedItem({ ...item }); setIsEditing(false); }} style={{ flex: 1 }}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            /* View Mode */
            <>
              <h2 style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '20px',
                fontWeight: 700,
                margin: '0 0 12px 0',
                color: 'var(--text-main)'
              }}>
                {item.title || 'Untitled Item'}
              </h2>

              {/* Badges Row */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <button
                  className="badge badge-btn"
                  onClick={() => openEbayComps(item.title || '', item.year)}
                >
                  🔍 eBay Sold
                </button>
                {item.year && <span className="badge">📅 {item.year}</span>}
                {item.type && <span className="badge">📁 {item.type}</span>}
              </div>

              {/* Notes */}
              {item.notes && (
                <p style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  margin: '0 0 12px 0',
                  lineHeight: 1.5
                }}>
                  {item.notes}
                </p>
              )}

              {/* Confidence */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '16px',
                fontSize: '12px'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>AI Confidence:</span>
                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{item.confidence || 'N/A'}</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-seamless btn-ghost" onClick={() => setIsEditing(true)} style={{ flex: 1 }}>
                  ✏️ Edit
                </button>
                <button 
                  className="btn-seamless btn-ghost" 
                  onClick={handleDelete}
                  style={{ flex: 1, color: 'var(--status-error)' }}
                >
                  🗑️ Delete
                </button>
              </div>
              <button
                className="btn-seamless btn-ghost"
                onClick={onClose}
                style={{ width: '100%', marginTop: '8px' }}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemDetail;
