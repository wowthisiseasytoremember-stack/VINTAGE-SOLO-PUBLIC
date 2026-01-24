import React, { useEffect, useRef } from 'react';

interface ItemStatus {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string | null;
}

interface ImageProgressListProps {
  items: ItemStatus[];
}

const ImageProgressList: React.FC<ImageProgressListProps> = ({ items }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const processingIndex = items.findIndex(item => item.status === 'processing');

  useEffect(() => {
    if (processingIndex >= 0 && scrollRef.current) {
      const element = scrollRef.current.children[processingIndex] as HTMLElement;
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [processingIndex]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing': return <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" />;
      case 'completed': return <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" />;
      case 'failed': return <div className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.4)]" />;
      default: return <div className="w-2 h-2 bg-slate-300 rounded-full" />;
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
      {items.map((item, index) => (
        <div 
          key={item.id} 
          className={`flex items-center gap-3 py-1 px-3 rounded-xl transition-all duration-300 ${item.status === 'processing' ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-white/5 border border-transparent'}`}
        >
          {getStatusIcon(item.status)}
          <span className={`text-[11px] font-bold flex-1 truncate ${item.status === 'completed' ? 'text-slate-400' : 'text-white'}`}>
            {item.filename}
          </span>
          {item.status === 'processing' && (
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">Analysing</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default ImageProgressList;
