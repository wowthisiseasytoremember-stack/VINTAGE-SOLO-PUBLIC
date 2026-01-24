import React from 'react';

interface BatchSummary {
  batch_id: string;
  box_id: string;
  total_images: number;
  processed: number;
  failed: number;
  created_at: string;
  thumbnail?: string;
}

interface BatchHistoryProps {
  batches: BatchSummary[];
  onLoadBatch: (batchId: string) => void;
  onDownloadCSV: (batchId: string) => void;
  onRefresh: () => void;
  onResume?: (batchId: string) => void;
  standalone?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

const BatchHistory: React.FC<BatchHistoryProps> = ({ batches, onLoadBatch, onDownloadCSV, onRefresh, onResume, standalone, hasMore, onLoadMore }: BatchHistoryProps) => {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateString; }
  };

  return (
    <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-700">
      <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-outfit">Archived Batches</h2>
          <p className="text-slate-400 text-xs font-medium">{standalone ? 'Device storage only' : 'Server & Device combined'}</p>
        </div>
        <button
          onClick={onRefresh}
          className="btn-seamless bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-black uppercase tracking-widest shadow-sm"
        >
          Refresh Feed
        </button>
      </div>

      {batches.length === 0 ? (
        <div className="p-20 text-center">
           <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-slate-300">🧊</span>
           </div>
           <p className="text-slate-400 font-bold">No history found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-white">
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 italic">Timeline</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Box Context</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Scope</th>
                <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {batches.map((batch) => {
                const isLocal = batch.batch_id.startsWith('local-');
                return (
                  <tr key={batch.batch_id} className="group hover:bg-indigo-50/30 transition-all cursor-default">
                    <td className="px-8 py-6">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '8px', 
                          backgroundColor: '#F3F4F6', 
                          flexShrink: 0,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {batch.thumbnail ? (
                            <img 
                              src={batch.thumbnail.startsWith('data:') ? batch.thumbnail : `data:image/jpeg;base64,${batch.thumbnail}`} 
                              alt="Batch preview" 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <span style={{ fontSize: '16px' }}>📦</span>
                          )}
                        </div>
                        <div>
                          <p className="text-slate-900 font-bold text-sm leading-none mb-1">{formatDate(batch.created_at)}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-slate-400 text-[10px] font-black tracking-widest uppercase">Captured</p>
                            {isLocal && <span className="text-[9px] bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded font-black tracking-tighter">LOCAL</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 group-hover:bg-white transition-colors">
                         <span className="text-sm">🏷️</span>
                         <span className="text-slate-900 font-black text-xs uppercase tracking-wider">{batch.box_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex flex-col items-center">
                         <p className="text-slate-900 font-black text-sm">{batch.processed}/{batch.total_images}</p>
                         <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden shadow-inner">
                            <div 
                              className="h-full bg-indigo-500 rounded-full" 
                              style={{ width: `${(batch.processed/batch.total_images)*100}%` }}
                            />
                         </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onLoadBatch(batch.batch_id)}
                          className="text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:bg-white hover:shadow-md px-3 py-2 rounded-lg transition-all"
                        >
                          Explore
                        </button>
                        {batch.processed < batch.total_images && onResume && !isLocal && (
                          <button
                            onClick={() => onResume(batch.batch_id)}
                            className="bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest px-3 py-2 rounded-lg shadow-lg shadow-amber-100 transition-all active:scale-95"
                          >
                            Resume
                          </button>
                        )}
                        {batch.processed === batch.total_images && (
                          <button
                            onClick={() => onDownloadCSV(batch.batch_id)}
                            className="text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:bg-white hover:shadow-md px-3 py-2 rounded-lg transition-all"
                          >
                            Export CSV
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {hasMore && onLoadMore && (
            <div className="p-6 text-center border-t border-slate-50">
              <button 
                onClick={onLoadMore}
                className="text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
              >
                ⬇️ Load Older History
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchHistory;
