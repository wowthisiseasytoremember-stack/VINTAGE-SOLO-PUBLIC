import React from 'react';
import { openEbayComps } from '../services/ebaySearch';

export interface CatalogItem {
  id?: number;
  batch_id?: string;
  filename: string;
  box_id: string;
  title: string;
  type: string;
  year?: string;
  notes?: string;
  confidence: string;
  processed_at: string;
  image_data?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  comps_quote?: string;
  condition_estimate?: string;
  raw_metadata?: Record<string, any>;
}

interface ItemCardProps {
  item: CatalogItem;
  onCardClick: (item: CatalogItem) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onCardClick }) => {
  return (
    <div 
      className="triage-card" 
      onClick={() => onCardClick(item)}
    >
      {/* Image */}
      {item.image_data ? (
        <img
          src={item.image_data.startsWith('data:') ? item.image_data : `data:image/jpeg;base64,${item.image_data}`}
          alt={item.title}
          className="triage-card-image"
        />
      ) : (
        <img 
          src={(() => {
            const typeMap: Record<string, string> = {
              'comic book': '/placeholders/comic.svg',
              'comic': '/placeholders/comic.svg',
              'toy': '/placeholders/toy.svg',
              'action figure': '/placeholders/toy.svg',
              'figure': '/placeholders/toy.svg',
              'card': '/placeholders/card.svg',
              'trading card': '/placeholders/card.svg',
              'vinyl': '/placeholders/vinyl.svg',
              'record': '/placeholders/vinyl.svg',
              'book': '/placeholders/book.svg',
              'photo': '/placeholders/photo.svg',
              'photograph': '/placeholders/photo.svg'
            };
            const lowerType = (item.type || '').toLowerCase();
            return typeMap[lowerType] || '/placeholders/other.svg';
          })()} 
          alt={item.title}
          className="triage-card-image"
          style={{ objectFit: 'cover' }}
        />
      )}

      {/* Footer */}
      <div className="triage-card-footer">
        <h3 className="triage-card-title">{item.title || 'Untitled'}</h3>
        <div className="triage-card-badges">
          <span 
            className="triage-card-badge" 
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); openEbayComps(item.title || '', item.year); }}
          >
            🔍 Comps
          </span>
          {item.year && (
            <span className="triage-card-badge">
              📅 {item.year}
            </span>
          )}
          {item.comps_quote && (
            <span className="triage-card-badge" style={{ background: '#FEF3C7', color: '#92400E', fontWeight: 800 }}>
              💰 ${item.comps_quote}
            </span>
          )}
          {/* Mom-Proofing: Cloud Checkmark (Always green for simplicity if item exists) */}
           <span className="triage-card-badge" style={{ background: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' }}>
             ☁️ Saved
           </span>
        </div>
      </div>
    </div>
  );
};

export default ItemCard;
