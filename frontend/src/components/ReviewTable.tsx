import React, { useState } from 'react';
import axios from 'axios';

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
}

interface ReviewTableProps {
  items: ProcessedItem[];
  batchId?: string;
  onUpdate?: () => void;
}

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const ReviewTable: React.FC<ReviewTableProps> = ({ items, batchId, onUpdate }: ReviewTableProps) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<ProcessedItem>>({});
  const [imagePreviews, setImagePreviews] = useState<{ [key: number]: string }>({});

  const getConfidenceColor = (confidence: string) => {
    switch (confidence.toLowerCase()) {
      case 'high':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const loadImagePreview = async (itemId: number) => {
    if (!batchId || !itemId || imagePreviews[itemId]) return;
    
    try {
      const response = await axios.get(
        `${API_URL}/api/batches/${batchId}/items/${itemId}/image`,
        { responseType: 'blob' }
      );
      const imageUrl = URL.createObjectURL(response.data);
      setImagePreviews(prev => ({ ...prev, [itemId]: imageUrl }));
    } catch (error) {
      console.error('Error loading image:', error);
    }
  };

  const startEdit = (item: ProcessedItem, index: number) => {
    const itemId = item.id || index;
    setEditingId(itemId);
    setEditValues({
      title: item.title,
      type: item.type,
      year: item.year || '',
      notes: item.notes || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async (itemId: number) => {
    if (!batchId) return;
    
    try {
      await axios.put(
        `${API_URL}/api/batches/${batchId}/items/${itemId}`,
        editValues
      );
      setEditingId(null);
      setEditValues({});
      if (onUpdate) onUpdate();
    } catch (error: any) {
      console.error('Error updating item:', error);
      alert('Failed to update item: ' + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Processed Items</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Image
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Filename
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Year
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item: ProcessedItem, index: number) => {
              const itemId = item.id !== undefined ? item.id : index;
              const isEditing = editingId === itemId;
              const imageUrl = imagePreviews[itemId];
              
              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    {batchId && itemId ? (
                      <div className="relative">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.filename}
                            className="w-16 h-16 object-cover rounded cursor-pointer"
                            onClick={() => {
                              const img = new Image();
                              img.src = imageUrl;
                              const w = window.open('');
                              if (w) w.document.write(`<img src="${imageUrl}" style="max-width:100%;height:auto;" />`);
                            }}
                            onError={() => {
                              // Remove broken image URL
                              setImagePreviews(prev => {
                                const newPreviews = { ...prev };
                                delete newPreviews[itemId];
                                return newPreviews;
                              });
                            }}
                          />
                        ) : (
                          <button
                            onClick={() => loadImagePreview(itemId)}
                            className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500 hover:bg-gray-300"
                          >
                            Load
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded"></div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.filename}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editValues.title || ''}
                        onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      item.title || <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {isEditing ? (
                      <select
                        value={editValues.type || ''}
                        onChange={(e) => setEditValues({ ...editValues, type: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="book">book</option>
                        <option value="comic">comic</option>
                        <option value="map">map</option>
                        <option value="ad">ad</option>
                        <option value="magazine">magazine</option>
                        <option value="postcard">postcard</option>
                        <option value="poster">poster</option>
                        <option value="document">document</option>
                        <option value="other">other</option>
                      </select>
                    ) : (
                      item.type || <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editValues.year || ''}
                        onChange={(e) => setEditValues({ ...editValues, year: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="YYYY"
                      />
                    ) : (
                      item.year || <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                    {isEditing ? (
                      <textarea
                        value={editValues.notes || ''}
                        onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        rows={2}
                      />
                    ) : (
                      <div className="truncate" title={item.notes || ''}>
                        {item.notes || <span className="text-gray-400">—</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getConfidenceColor(
                        item.confidence
                      )}`}
                    >
                      {item.confidence}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(itemId)}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-gray-600 hover:text-gray-800 font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(item, index)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Edit
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
