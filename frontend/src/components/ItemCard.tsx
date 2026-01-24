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
        </div>
      </div>
    </div>
  );
};

export default ItemCard;
