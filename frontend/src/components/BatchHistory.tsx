import React from 'react';

interface BatchSummary {
  batch_id: string;
  box_id: string;
  total_images: number;
  processed: number;
  failed: number;
  created_at: string;
}

interface BatchHistoryProps {
  batches: BatchSummary[];
  onLoadBatch: (batchId: string) => void;
  onDownloadCSV: (batchId: string) => void;
  onRefresh: () => void;
  onResume?: (batchId: string) => void;
}

const BatchHistory: React.FC<BatchHistoryProps> = ({ batches, onLoadBatch, onDownloadCSV, onRefresh, onResume }: BatchHistoryProps) => {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Batch History</h2>
        <button
          onClick={onRefresh}
          className="bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors text-sm"
        >
          Refresh
        </button>
      </div>

      {batches.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No batches yet. Process your first batch to see it here!</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Box ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Images
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Processed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Failed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {batches.map((batch) => (
                <tr key={batch.batch_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(batch.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {batch.box_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {batch.total_images}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="text-green-600 font-medium">{batch.processed}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {batch.failed > 0 ? (
                      <span className="text-red-600 font-medium">{batch.failed}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onLoadBatch(batch.batch_id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View
                      </button>
                      {batch.processed < batch.total_images && onResume && (
                        <button
                          onClick={() => onResume(batch.batch_id)}
                          className="text-orange-600 hover:text-orange-800"
                          title="Resume incomplete batch"
                        >
                          Resume
                        </button>
                      )}
                      {batch.processed === batch.total_images && (
                        <button
                          onClick={() => onDownloadCSV(batch.batch_id)}
                          className="text-green-600 hover:text-green-800"
                        >
                          Download CSV
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BatchHistory;
