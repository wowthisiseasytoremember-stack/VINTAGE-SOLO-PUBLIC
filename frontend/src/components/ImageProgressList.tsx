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

  // Auto-scroll to currently processing item
  useEffect(() => {
    if (processingIndex >= 0 && scrollRef.current) {
      const element = scrollRef.current.children[processingIndex] as HTMLElement;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [processingIndex]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="text-gray-400">⏳</span>;
      case 'processing':
        return <span className="text-blue-500 animate-spin">🔄</span>;
      case 'completed':
        return <span className="text-green-500">✅</span>;
      case 'failed':
        return <span className="text-red-500">❌</span>;
      default:
        return <span className="text-gray-400">⏳</span>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-50 border-gray-200';
      case 'processing':
        return 'bg-blue-50 border-blue-300 animate-pulse';
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-700">Pending</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs rounded bg-blue-200 text-blue-700">Processing</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded bg-green-200 text-green-700">Completed</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs rounded bg-red-200 text-red-700">Failed</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-700">Pending</span>;
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
        No images to track
      </div>
    );
  }

  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;
  const processingCount = items.filter(i => i.status === 'processing').length;
  const pendingCount = items.filter(i => i.status === 'pending').length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Image Progress</h3>
          <div className="flex gap-4 text-xs text-gray-600">
            <span className="text-green-600">✅ {completedCount}</span>
            <span className="text-blue-600">🔄 {processingCount}</span>
            <span className="text-gray-500">⏳ {pendingCount}</span>
            {failedCount > 0 && <span className="text-red-600">❌ {failedCount}</span>}
          </div>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="max-h-96 overflow-y-auto divide-y divide-gray-100"
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`px-4 py-3 border-l-4 transition-colors ${getStatusColor(item.status)}`}
          >
            <div className="flex items-center gap-3">
              <div className="text-xl flex-shrink-0">
                {getStatusIcon(item.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {item.filename}
                  </span>
                  {getStatusBadge(item.status)}
                </div>
                {item.error_message && (
                  <div className="text-xs text-red-600 mt-1 truncate" title={item.error_message}>
                    Error: {item.error_message}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageProgressList;
