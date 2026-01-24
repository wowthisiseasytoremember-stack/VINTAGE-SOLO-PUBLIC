import React, { useState } from 'react';

import { updateItem as updateItemLocal } from '../services/db';

interface ProcessedItem {
  id?: number;
  filename: string;
  box_id: string;
  title: string;
  type: string;
  year?: string;
  notes?: string;
  confidence: string;
  processed_at: string;
  image_data?: string; // Base64
}

interface ReviewTableProps {
  items: ProcessedItem[];
  batchId?: string;
  onUpdate?: () => void;
}

const ReviewTable: React.FC<ReviewTableProps> = ({ items, onUpdate }: ReviewTableProps) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<ProcessedItem>>({});
  const [imagePreviews, setImagePreviews] = useState<{ [key: number]: string }>({});

  const saveEdit = async (itemId: number) => {
    try {
      await updateItemLocal(itemId, editValues);
      setEditingId(null);
      setEditValues({});
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  const getConfidenceStyle = (confidence: string | undefined | null) => {
    const conf = String(confidence ?? '').toLowerCase();
    if (conf.includes('high') || parseInt(conf) >= 70) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (conf.includes('medium') || (parseInt(conf) >= 40 && parseInt(conf) < 70)) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (conf.includes('low') || parseInt(conf) < 40) return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const loadImagePreview = async (item: ProcessedItem, index: number) => {
    const itemId = item.id !== undefined ? item.id : index;
    if (imagePreviews[itemId]) return;

    if (item.image_data) {
      const url = item.image_data.startsWith('data:') 
        ? item.image_data 
        : `data:image/jpeg;base64,${item.image_data}`;
      setImagePreviews(prev => ({ ...prev, [itemId]: url }));
    }
  };

  const startEdit = (item: ProcessedItem, index: number) => {
    setEditingId(item.id !== undefined ? item.id : index);
    setEditValues({ title: item.title, type: item.type, year: item.year || '', notes: item.notes || '' });
  };

  return (
    <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-700">
      <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-xl font-bold text-slate-900 font-outfit">Validated Artifacts</h2>
        <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">{items.length} Total</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-white">
              <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Artifact</th>
              <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Details</th>
              <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Confidence</th>
              <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.map((item, index) => {
              const itemId = item.id !== undefined ? item.id : index;
              const isEditing = editingId === itemId;
              const imageUrl = imagePreviews[itemId] || (item.image_data ? `data:image/jpeg;base64,${item.image_data}` : null);

              return (
                <tr key={index} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-16 h-20 bg-slate-100 rounded-xl overflow-hidden shadow-inner flex items-center justify-center cursor-pointer border border-slate-200 transition-transform active:scale-95"
                        onClick={() => !imageUrl ? loadImagePreview(item, index) : window.open(imageUrl)}
                      >
                        {imageUrl ? (
                           <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                           <span className="text-[10px] font-black text-slate-400">LOAD</span>
                        )}
                      </div>
                      <div className="max-w-[120px]">
                        <p className="text-slate-900 font-bold text-sm truncate" title={item.filename}>{item.filename}</p>
                        <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">{item.processed_at.split('T')[0]}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-6">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input 
                          type="text" value={editValues.title} 
                          onChange={e => setEditValues({...editValues, title: e.target.value})}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <select 
                            value={editValues.type} 
                            onChange={e => setEditValues({...editValues, type: e.target.value})}
                            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500"
                          >
                            {['book','comic','map','ad','magazine','postcard','poster','document','other'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <input 
                            type="text" value={editValues.year} 
                            onChange={e => setEditValues({...editValues, year: e.target.value})}
                            className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                            placeholder="YYYY"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-xs">
                        <h4 className="text-slate-900 font-bold text-sm leading-tight mb-1">{item.title || 'Untitled'}</h4>
                        <div className="flex gap-2 items-center">
                           <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">{item.type}</span>
                           <span className="text-[10px] font-black text-slate-400 uppercase">{item.year || 'Unknown Year'}</span>
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-6 font-mono text-xs">
                    <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase ${getConfidenceStyle(item.confidence)}`}>
                      {item.confidence}
                    </span>
                  </td>

                  <td className="px-8 py-6 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-3">
                        <button onClick={() => saveEdit(itemId)} className="text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:text-emerald-700">Save</button>
                        <button onClick={() => {setEditingId(null); setEditValues({});}} className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Cancel</button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => startEdit(item, index)}
                        className="opacity-0 group-hover:opacity-100 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Correct
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReviewTable;
