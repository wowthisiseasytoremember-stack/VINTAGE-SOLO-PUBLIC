import React, { useState } from 'react';
import { CatalogItem } from './ItemCard';
import { openEbayComps } from '../services/ebaySearch';

interface ItemDetailProps {
  item: CatalogItem;
  onClose: () => void;
  onSave?: (updatedItem: CatalogItem) => void;
  onDelete?: (item: CatalogItem) => void;
  onRetry?: (item: CatalogItem) => void;
}

const ItemDetail: React.FC<ItemDetailProps> = ({ item, onClose, onSave, onDelete, onRetry }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState<CatalogItem>({ ...item });
  const [isRetrying, setIsRetrying] = useState(false);

  const [showCompsPrompt, setShowCompsPrompt] = useState(false);
  const [tempComps, setTempComps] = useState(item.comps_quote || '');

  // Helper for placeholders
  const getPlaceholder = (type?: string) => {
     const t = (type || '').toLowerCase();
     if (t.includes('book')) return '/placeholders/book.svg';
     if (t.includes('comic')) return '/placeholders/comic.svg';
     if (t.includes('card')) return '/placeholders/card.svg';
     if (t.includes('toy') || t.includes('figure')) return '/placeholders/toy.svg';
     if (t.includes('vinyl') || t.includes('record')) return '/placeholders/vinyl.svg';
     if (t.includes('photo')) return '/placeholders/photo.svg';
     return '/placeholders/other.svg';
  };

  const handleRetry = async () => {
    if (onRetry) {
      setIsRetrying(true);
      await onRetry(item);
      setIsRetrying(false);
    }
  };

  const handleCompsSearch = () => {
    openEbayComps(item.title || '', item.year);
    // When the user returns from eBay, we want to prompt them
    // We achieve this by listening for window focus or just showing it after a short delay
    setTimeout(() => {
      setShowCompsPrompt(true);
    }, 1000);
  };

  const saveComps = () => {
    // Save to both compiled quote and saved_comps
    const updated = { 
        ...item, 
        comps_quote: tempComps,
        saved_comps: JSON.stringify({ quote: tempComps, date: new Date().toISOString() }) 
    };
    if (onSave) onSave(updated);
    setShowCompsPrompt(false);
  };

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
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" style={{ 
        maxHeight: '90vh', 
        overflowY: 'auto', 
        position: 'relative',
        paddingTop: '40px' 
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Close Button X */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '32px',
            height: '32px',
            borderRadius: '16px',
            background: 'rgba(0,0,0,0.05)',
            border: 'none',
            fontSize: '18px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}
        >
          ✕
        </button>

        {/* Main Image */}
        <div style={{
            width: '100%',
            maxHeight: '35vh',
            minHeight: '200px',
            background: '#F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
        }}>
            <img
                src={item.image_data ? (item.image_data.startsWith('data:') ? item.image_data : `data:image/jpeg;base64,${item.image_data}`) : getPlaceholder(item.type)}
                alt={item.title}
                style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
                }}
            />
        </div>

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

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  BOX ID / LOCATION
                </label>
                <input
                  type="text"
                  value={editedItem.box_id || ''}
                  onChange={(e) => setEditedItem({ ...editedItem, box_id: e.target.value })}
                />
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
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px' }}>
                  Identified As:
                </label>
                <h2 style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '24px',
                  fontWeight: 800,
                  margin: '0',
                  color: 'var(--text-main)',
                  lineHeight: 1.2
                }}>
                  {item.title || 'Untitled Item'}
                </h2>
              </div>

              {/* Badges Row */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <button
                  className="badge badge-btn"
                  onClick={handleCompsSearch}
                  style={{ padding: '8px 16px', background: '#DBEAFE', color: '#1E40AF', border: '1px solid #BFDBFE', fontSize: '13px', fontWeight: 700 }}
                >
                  🔍 View Price Comps
                </button>
                {item.comps_quote && <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 800 }}>💰 Est. ${item.comps_quote}</span>}
                {item.year && <span className="badge" style={{ padding: '8px 12px', background: '#F1F5F9', color: '#475569', fontSize: '13px' }}>📅 {item.year}</span>}
                {item.type && <span className="badge" style={{ padding: '8px 12px', background: '#F1F5F9', color: '#475569', fontSize: '13px' }}>📁 {item.type}</span>}
                {item.box_id && <span className="badge" style={{ padding: '8px 12px', background: '#ecfdf5', color: '#065f46', border: '1px solid #d1fae5' }}>📦 {item.box_id}</span>}
              </div>

              {/* Retry AI Button (Only for Failed Items) */}
              {(item.title === 'Manual Entry Required' || item.confidence === '0%') && onRetry && (
                <button 
                  onClick={handleRetry}
                  disabled={isRetrying}
                  style={{
                    width: '100%',
                    marginBottom: '20px',
                    padding: '16px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '16px',
                    fontWeight: 800,
                    fontSize: '16px',
                    cursor: isRetrying ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  {isRetrying ? (
                    <>
                      <div className="animate-spin" style={{ fontSize: '20px' }}>⏳</div>
                      AI Analyzing...
                    </>
                  ) : (
                    <>✨ Retry AI Search</>
                  )}
                </button>
              )}

              {/* Notes Section with Background */}
              <div style={{ background: '#F9FAFB', padding: '16px', borderRadius: '12px', border: '1px solid #F1F5F9', marginBottom: '20px' }}>
                <label style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Notes & Details
                </label>
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-main)',
                  margin: 0,
                  lineHeight: 1.6,
                  fontStyle: item.notes ? 'normal' : 'italic'
                }}>
                  {item.notes || 'No extra notes recorded.'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', opacity: 0.7 }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>AI Confidence:</span>
                <div style={{ flex: 1, height: '6px', background: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: item.confidence || '0%', background: '#10B981' }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#059669' }}>{item.confidence || '0%'}</span>
              </div>

              {/* Primary Actions */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <button 
                  className="btn-seamless btn-primary" 
                  onClick={() => setIsEditing(true)} 
                  style={{ flex: 2, padding: '14px', fontSize: '16px', fontWeight: 700 }}
                >
                  ✏️ Edit Info
                </button>
                <button 
                  className="btn-seamless btn-ghost" 
                  onClick={handleDelete}
                  style={{ flex: 1, padding: '14px', color: '#DC2626', border: '1px solid #FEE2E2', background: '#FEF2F2' }}
                >
                  🗑️ Delete
                </button>
              </div>
              <button
                className="btn-seamless btn-ghost"
                onClick={onClose}
                style={{ width: '100%', padding: '14px', fontWeight: 700, fontSize: '16px', border: '1px solid #E5E7EB' }}
              >
                Close & Go Back
              </button>
            </>
          )}
        </div>

        {/* COMPS QUOTE PROMPT OVERLAY */}
        {showCompsPrompt && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255,255,255,0.95)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>📊 Enter Estimated Value?</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>Based on the search, what is this item worth?</p>
            <input 
              type="text"
              placeholder="e.g. 25.00 or 40-60"
              autoFocus
              value={tempComps}
              onChange={e => setTempComps(e.target.value)}
              style={{ marginBottom: '16px', fontSize: '18px', textAlign: 'center', fontWeight: 700 }}
            />
            <button className="btn-seamless btn-primary" onClick={saveComps} style={{ width: '100%', marginBottom: '12px' }}>
              SAVE VALUE
            </button>
            <button className="btn-seamless btn-ghost" onClick={() => setShowCompsPrompt(false)} style={{ width: '100%' }}>
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemDetail;
