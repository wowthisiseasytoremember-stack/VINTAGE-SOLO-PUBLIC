import React, { useState, useCallback, useEffect } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import NewSessionCard from './components/NewSessionCard';
import ItemCard, { CatalogItem } from './components/ItemCard';
import ItemDetail from './components/ItemDetail';
import BatchHistory from './components/BatchHistory';
import CameraCapture from './components/CameraCapture';

// Self-Contained Services
import { initDB, saveBatch, saveItem, getBatches, getBatchItems, updateItem, deleteItem, getIncompleteBatches, findByImageHash, addToInventory, updateInventoryItem, getAllInventory, InventoryItem, getLatestItemByHash } from './services/db';
import { analyzeImage, AIKeys, AIProvider } from './services/aiService';
import { SystemValidator, TestResult } from './services/testRunner';
import { computeImageHash, generateThumbnail } from './services/imageHash';

// Firebase & Cloud Sync
import { useAuth } from './contexts/AuthContext';
import { 
  saveUserSettings, 
  loadUserSettings, 
  syncBatchToCloud, 
  syncItemToCloud, 
  syncInventoryToCloud,
  deleteItemFromCloud,
  deleteBatchFromCloud,
  loadAllFromCloud,
  syncAllToCloud,
  retryConnection
} from './services/firestoreSync';

interface BatchSummary {
  batch_id: string;
  box_id: string;
  total_images: number;
  processed: number;
  failed: number;
  created_at: string;
}

type ViewType = 'home' | 'history' | 'inventory' | 'settings';

function App() {
  // ========== AUTH STATE ==========
  const { user } = useAuth();

  // ========== VIEW STATE ==========
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [showCameraFullscreen, setShowCameraFullscreen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  
  // ========== AI KEYS STATE ==========
  const [aiKeys, setAiKeys] = useState<AIKeys>({
    openai: localStorage.getItem('ai_key_openai') || process.env.REACT_APP_OPENAI_API_KEY || '',
    gemini: localStorage.getItem('ai_key_gemini') || process.env.REACT_APP_GEMINI_API_KEY || '',
    claude: localStorage.getItem('ai_key_claude') || process.env.REACT_APP_CLAUDE_API_KEY || ''
  });
  const [keysLoadedFromCloud, setKeysLoadedFromCloud] = useState(false);

  // ========== CORE STATE ==========
  const [boxId, setBoxId] = useState(localStorage.getItem('boxId') || '');
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentFilename: '' });
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [batchStartTime, setBatchStartTime] = useState<Date | null>(null);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [incompleteBatch, setIncompleteBatch] = useState<any>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isDbInitialized, setIsDbInitialized] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [inventoryLastKey, setInventoryLastKey] = useState<number | undefined>(undefined);
  const [hasMoreInventory, setHasMoreInventory] = useState(true);

  // Initialize DB and load history
  // CRITICAL: This must complete before ANY other DB or Cloud ops run
  useEffect(() => {
    const boot = async () => {
      try {
        await initDB();
        setIsDbInitialized(true); // Signal that DB is safe to use
        await loadBatchHistory();
        
        // Initial Check for incomplete batches
        const incomplete = await getIncompleteBatches();
        if (incomplete.length > 0) {
          setIncompleteBatch(incomplete[0]);
          setShowResumePrompt(true);
        }
      } catch (err) {
        console.error("Critical Boot Error:", err);
        setDbError(true);
      }
    };
    boot();
  }, []);

  // ========== CLOUD SYNC: LOAD SETTINGS & CLOUD DATA ==========
  useEffect(() => {
    const loadCloudData = async () => {
      // STOP: Do not touch DB until it is initialized
      if (!isDbInitialized) return;

      if (user && !keysLoadedFromCloud) {
        console.log('☁️ User logged in, syncing cloud data...');
        
        // 1. Sync Settings (API Keys)
        const cloudSettings = await loadUserSettings(user.uid);
        if (cloudSettings?.apiKeys) {
          setAiKeys(prev => ({ ...prev, ...cloudSettings.apiKeys }));
          Object.entries(cloudSettings.apiKeys).forEach(([provider, val]) => {
            if (val) localStorage.setItem(`ai_key_${provider}`, val);
          });
        }

        // 2. Fetch all history/inventory from cloud (for multi-device support)
        try {
          const { batches: cloudBatches, inventory: cloudInv } = await loadAllFromCloud(user.uid);
          
          if (cloudBatches.length > 0) {
            console.log(`☁️ Found ${cloudBatches.length} batches in cloud. Merging...`);
            for (const b of cloudBatches) {
              await saveBatch(b);
            }
            loadBatchHistory();
          }
          
          if (cloudInv.length > 0) {
            console.log(`☁️ Found ${cloudInv.length} inventory items in cloud. Merging...`);
            for (const item of cloudInv) {
              const existing = await findByImageHash(item.image_hash);
              if (!existing) {
                await addToInventory(item);
              } else if (existing.id) {
                // Update local with cloud metadata if newer
                await updateInventoryItem(existing.id, item);
              }
            }
            loadInventory();
          }

          // 3. Fallback: If cloud is empty but local has data, push local to cloud
          if (cloudBatches.length === 0 && cloudInv.length === 0) {
            const localBatches = await getBatches();
            const localInventory = await getAllInventory();
            if (localBatches.length > 0 || localInventory.length > 0) {
              console.log('☁️ First cloud session detected. pushing local data...');
              await syncAllToCloud(user.uid, localBatches, [], localInventory);
            }
          }
        } catch (err) {
          console.error('Failed to pull cloud data:', err);
        }

        setKeysLoadedFromCloud(true);
      } else if (!user) {
        setKeysLoadedFromCloud(false);
      }
    };
    loadCloudData();
  }, [user, keysLoadedFromCloud, isDbInitialized]);



  // Refresh data when switching views
  useEffect(() => {
    if (currentView === 'history') loadBatchHistory();
    if (currentView === 'inventory') loadInventory();
  }, [currentView]);

  // Save boxId to localStorage
  useEffect(() => {
    if (boxId) localStorage.setItem('boxId', boxId);
  }, [boxId]);

  // ========== INVENTORY ==========


  const loadInventory = async (reset = true) => {
    const limit = 50;
    const lastKey = reset ? undefined : inventoryLastKey;
    const newItems = await getAllInventory(limit, lastKey);
    
    if (reset) {
      setInventory(newItems);
    } else {
      setInventory(prev => [...prev, ...newItems]);
    }
    
    if (newItems.length > 0) {
      const lastItem = newItems[newItems.length - 1];
      setInventoryLastKey(lastItem.id); // inventory key is 'id' (number)
    }
    
    setHasMoreInventory(newItems.length === limit);
  };

  // ========== PROCESSING LOGIC ==========
  const processBatch = async () => {
    if (files.length === 0) return;
    
    const totalFiles = files.length;
    const batchId = `local-${Date.now()}`;
    const startTime = new Date();
    
    setProcessing(true);
    setBatchStartTime(startTime);
    setProgress({ current: 0, total: totalFiles, currentFilename: '' });

    const results: CatalogItem[] = [];
    
    // Save Batch Start in DB
    await saveBatch({
      batch_id: batchId,
      box_id: boxId || 'Uncategorized',
      total_images: totalFiles,
      processed: 0,
      failed: 0,
      created_at: startTime.toISOString(),
      status: 'processing'
    });

    const CHUNK_SIZE = 5;
    const DELAY_MS = 1500;
    const processedHashesInBatch = new Map<string, any>(); // Improve in-batch dedupe
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(prev => ({ ...prev, current: i, currentFilename: file.name }));
      
      try {
        // Convert to Base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        const base64Data = await base64Promise;

        // Compute image hash for duplicate detection
        const imageHash = await computeImageHash(base64Data);
        
        // Check if we've seen this image before (Global DB or current batch)
        const dbExisting = await findByImageHash(imageHash);
        const batchExisting = processedHashesInBatch.get(imageHash);
        const existingItem = batchExisting || dbExisting;
        
        let aiData;
        let isDupe = false;
        
        if (existingItem) {
          // Duplicate found! Use existing data
          console.log(`Duplicate detected: ${existingItem.title}`);
          aiData = {
            title: existingItem.title,
            type: existingItem.type,
            year: existingItem.year,
            notes: `[Duplicate] ${existingItem.notes || ''}`,
            confidence: existingItem.confidence
          };
          isDupe = true;
          
          if (existingItem.id && !batchExisting) { // Only update DB if it's from global DB
            await updateInventoryItem(existingItem.id, {
              last_seen: new Date().toISOString(),
              times_scanned: (existingItem.times_scanned || 1) + 1
            });
          }
        } else {
          // New image - AI Analyze
          aiData = await analyzeImage(base64Data, aiKeys);
          
          // Generate real thumbnail
          const thumbnail = await generateThumbnail(`data:image/jpeg;base64,${base64Data}`);
          const inventoryData = {
            image_hash: imageHash,
            title: aiData.title,
            type: aiData.type,
            year: aiData.year || '',
            notes: aiData.notes || '',
            confidence: aiData.confidence,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            times_scanned: 1,
            thumbnail: thumbnail,
            box_id: boxId || 'Uncategorized'
          };
          await addToInventory(inventoryData);
          processedHashesInBatch.set(imageHash, inventoryData);
          
          if (user) syncInventoryToCloud(user.uid, inventoryData);
        }
        
        const item: CatalogItem = {
          id: Date.now() + i,
          batch_id: batchId, // Added for cloud sync
          filename: file.name,
          box_id: boxId || 'Uncategorized',
          ...aiData,
          processed_at: new Date().toISOString(),
          image_data: `data:image/jpeg;base64,${base64Data}`
        };

        results.push(item);

        // Save Item to DB immediately (resume support)
        const itemRecord = {
          batch_id: batchId,
          filename: file.name,
          box_id: boxId || 'Uncategorized',
          title: aiData.title,
          type: aiData.type,
          year: aiData.year || '',
          notes: aiData.notes || '',
          confidence: aiData.confidence,
          processed_at: item.processed_at,
          image_data: base64Data,
          status: 'completed' as const,
          image_hash: imageHash
        };
        await saveItem(itemRecord);

        // Sync item to cloud
        if (user) {
          syncItemToCloud(user.uid, itemRecord);
        }

        // Update batch progress in DB (for resume)
        const batchUpdate = {
          batch_id: batchId,
          box_id: boxId || 'Uncategorized',
          total_images: totalFiles,
          processed: i + 1,
          failed: 0,
          created_at: startTime.toISOString(),
          status: 'processing' as const
        };
        await saveBatch(batchUpdate);
        
        // Sync to cloud
        if (user) {
          syncBatchToCloud(user.uid, batchUpdate);
        }

        setProgress(prev => ({ ...prev, current: i + 1 }));
        
        // Rate limiting: add delay between API calls (not after last item, not for dupes)
        if (i < files.length - 1 && !isDupe) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }

      } catch (err: any) {
        console.error("Processing error:", err);
      }
    }

    // Update Batch in DB
    const finalBatch = {
      batch_id: batchId,
      box_id: boxId || 'Uncategorized',
      total_images: totalFiles,
      processed: results.length,
      failed: totalFiles - results.length,
      created_at: startTime.toISOString(),
      status: 'completed' as const
    };
    await saveBatch(finalBatch);
    
    // Sync final batch to cloud
    if (user) {
      syncBatchToCloud(user.uid, finalBatch);
    }

    setItems(results);
    setFiles([]);
    setProcessing(false);
    loadBatchHistory();
  };

  const handleInventoryItemClick = async (item: InventoryItem) => {
    const fullItem = await getLatestItemByHash(item.image_hash);
    if (fullItem) {
      // Convert to CatalogItem for the detail view
      setSelectedItem({
        ...fullItem,
        image_data: fullItem.image_data.toString().startsWith('data:') 
          ? fullItem.image_data 
          : `data:image/jpeg;base64,${fullItem.image_data}`
      } as any);
    } else {
      // Fallback: Create a mock CatalogItem using the info we have
      setSelectedItem({
        id: item.id || 0,
        batch_id: 'inventory',
        filename: 'inventory_item.jpg',
        box_id: item.box_id,
        title: item.title,
        type: item.type,
        year: item.year,
        notes: item.notes,
        confidence: item.confidence,
        processed_at: item.last_seen,
        image_data: item.thumbnail || '', // Detail view handles base64
        status: 'completed'
      });
    }
  };

  // ========== DATA LOADING ==========
  const loadBatchHistory = async (limit = 10) => {
    const localBatches = await getBatches(limit);
    const batchesWithThumbs = await Promise.all(localBatches.map(async (b) => {
      const items = await getBatchItems(b.batch_id);
      const firstItem = items.find(i => i.image_data);
      return {
        batch_id: b.batch_id,
        box_id: b.box_id,
        total_images: b.total_images,
        processed: b.processed,
        failed: b.failed,
        created_at: b.created_at,
        thumbnail: firstItem ? (typeof firstItem.image_data === 'string' ? firstItem.image_data : undefined) : undefined
      };
    }));
    setBatches(batchesWithThumbs);
  };

  const loadBatch = async (batchId: string) => {
    const batchItems = await getBatchItems(batchId);
    setItems(batchItems.map(item => ({
      id: item.id,
      batch_id: item.batch_id,
      filename: item.filename,
      box_id: item.box_id,
      title: item.title,
      type: item.type,
      year: item.year,
      notes: item.notes,
      confidence: item.confidence,
      processed_at: item.processed_at,
      image_data: typeof item.image_data === 'string' ? item.image_data : undefined,
      status: item.status
    })));
    setCurrentView('home');
  };

  const handleStartNew = () => {
    setItems([]);
    setBoxId('');
  };

  // ========== EDIT & DELETE ==========
  const handleEditItem = async (updatedItem: CatalogItem) => {
    // Update in state
    setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    setSelectedItem(updatedItem);
    // Persist to DB
    if (updatedItem.id) {
      const updates = {
        title: updatedItem.title,
        type: updatedItem.type,
        year: updatedItem.year || '',
        notes: updatedItem.notes || ''
      };
      await updateItem(updatedItem.id, updates);
      
      // Sync update to cloud
      if (user && updatedItem.batch_id) {
        await syncItemToCloud(user.uid, {
          batch_id: updatedItem.batch_id,
          filename: updatedItem.filename,
          box_id: updatedItem.box_id,
          title: updatedItem.title,
          type: updatedItem.type,
          year: updatedItem.year || '',
          notes: updatedItem.notes || '',
          confidence: updatedItem.confidence,
          processed_at: updatedItem.processed_at,
          status: 'completed'
        });
      }
    }
  };

  const handleDeleteItem = async (itemToDelete: CatalogItem) => {
    // Remove from state
    setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
    setSelectedItem(null);
    // Delete from DB
    if (itemToDelete.id) {
      await deleteItem(itemToDelete.id);
      
      // Sync deletion to cloud
      if (user && itemToDelete.batch_id) {
        deleteItemFromCloud(user.uid, itemToDelete.batch_id, itemToDelete.filename);
      }
    }
  };

  // ========== CSV DOWNLOAD ==========
  const downloadBatchCSV = async (batchId: string) => {
    const batchItems = await getBatchItems(batchId);
    
    const escapeCSV = (value: string): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      ['filename', 'box_id', 'title', 'type', 'year', 'notes', 'confidence', 'processed_at'],
      ...batchItems.map(item => [
        escapeCSV(item.filename),
        escapeCSV(item.box_id),
        escapeCSV(item.title || ''),
        escapeCSV(item.type || ''),
        escapeCSV(item.year || ''),
        escapeCSV(item.notes || ''),
        escapeCSV(item.confidence || ''),
        escapeCSV(item.processed_at)
      ])
    ];

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `batch_${batchId}.csv`;
    link.click();
  };

  // ========== KEY MANAGEMENT ==========
  const updateKey = async (provider: AIProvider, val: string) => {
    const newKeys = { ...aiKeys, [provider]: val };
    setAiKeys(newKeys);
    localStorage.setItem(`ai_key_${provider}`, val);
    
    // Sync to cloud if logged in
    if (user) {
      await saveUserSettings(user.uid, {
        apiKeys: { [provider]: val }
      });
    }
  };

  // ========== ETA CALCULATION ==========
  const calculateETA = (): string => {
    if (!batchStartTime || progress.current === 0 || progress.total === 0) return 'Calculating...';
    const elapsed = (new Date().getTime() - batchStartTime.getTime()) / 1000;
    const avgTimePerImage = elapsed / progress.current;
    const remaining = progress.total - progress.current;
    const etaSeconds = remaining * avgTimePerImage;
    return etaSeconds < 60 ? `~${Math.round(etaSeconds)}s` : `~${Math.floor(etaSeconds/60)}m`;
  };

  // Check if we have items to show
  const hasItems = items.length > 0;

  if (dbError) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1>⚠️ System Recovery</h1>
        <p>The local database has entered an invalid state (likely due to a bad update).</p>
        <button 
          onClick={async () => {
            const { deleteDB } = await import('idb');
            await deleteDB('vintage-cataloger-db');
            window.location.reload();
          }}
          style={{
            backgroundColor: '#ef4444', color: 'white', padding: '16px 24px', 
            borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginTop: '20px'
          }}
        >
          🗑️ Reset Database & Fix
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: 'var(--canvas-bg)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Fullscreen Camera Mode */}
      {showCameraFullscreen && (
        <CameraCapture 
          initialBoxId={boxId} 
          onExit={() => setShowCameraFullscreen(false)} 
          onBatchComplete={loadBatchHistory} 
          standalone={true}
        />
      )}

      {/* Navbar */}
      <Navbar onMenuClick={() => setShowMenu(!showMenu)} />

      {/* Resume Prompt Modal */}
      {showResumePrompt && incompleteBatch && (
        <div className="modal-overlay" onClick={() => setShowResumePrompt(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '350px' }}>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', margin: '0 0 12px' }}>
              📦 Resume Session?
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              You have an incomplete batch from <strong>{new Date(incompleteBatch.created_at).toLocaleDateString()}</strong>:
              <br />
              {incompleteBatch.processed} of {incompleteBatch.total_images} items processed
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn-seamless btn-primary"
                onClick={async () => {
                  // Load the incomplete batch
                  await loadBatch(incompleteBatch.batch_id);
                  setShowResumePrompt(false);
                }}
                style={{ flex: 1 }}
              >
                Resume
              </button>
              <button 
                className="btn-seamless btn-ghost"
                onClick={() => {
                  // Mark batch as completed (user chose not to resume)
                  saveBatch({ ...incompleteBatch, status: 'completed' });
                  setShowResumePrompt(false);
                }}
                style={{ flex: 1 }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Dropdown */}
      {showMenu && (
        <div style={{
          position: 'absolute',
          top: '56px',
          right: '16px',
          background: 'var(--card-surface)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-lg)',
          padding: '8px 0',
          zIndex: 50,
          minWidth: '160px'
        }}>
          {(['home', 'history', 'inventory', 'settings'] as ViewType[]).map(view => (
            <button
              key={view}
              onClick={() => { setCurrentView(view); setShowMenu(false); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 20px',
                border: 'none',
                background: currentView === view ? '#F3F4F6' : 'transparent',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: currentView === view ? 600 : 400,
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              {view === 'home' ? '📦 Catalog' : view === 'history' ? '📚 History' : view === 'inventory' ? '📋 Inventory' : '⚙️ Settings'}
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        
        {/* HOME VIEW */}
        {currentView === 'home' && (
          <>
            {/* Processing State */}
            {processing && (
              <div className="card" style={{ margin: '16px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontFamily: 'Outfit, sans-serif' }}>
                  AI Analyzing...
                </h3>
                <div style={{ 
                  height: '8px', 
                  background: '#E5E7EB', 
                  borderRadius: '4px', 
                  overflow: 'hidden',
                  marginBottom: '12px'
                }}>
                  <div style={{ 
                    height: '100%', 
                    background: 'var(--primary)', 
                    width: `${(progress.current / progress.total) * 100}%`,
                    transition: 'width 0.3s'
                  }} />
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                  {progress.current} / {progress.total} • ETA: {calculateETA()}
                </p>
                {progress.currentFilename && (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                    Processing: {progress.currentFilename}
                  </p>
                )}
                
                <button 
                  onClick={() => {
                    setProcessing(false);
                    // Also reload history to show whatever partial progress happened
                    loadBatchHistory();
                  }}
                  style={{
                    marginTop: '16px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  🛑 Cancel
                </button>
              </div>
            )}

            {/* Empty State: Show New Session Card */}
            {!processing && !hasItems && (
              <>
                <NewSessionCard
                  boxId={boxId}
                  onBoxIdChange={setBoxId}
                  onFilesSelected={setFiles}
                  onStartCataloging={processBatch}
                  isProcessing={processing}
                  selectedCount={files.length}
                />

                {/* Recent Identifications (Empty) */}
                <div style={{ padding: '0 16px' }}>
                  <h3 style={{ 
                    fontFamily: 'Outfit, sans-serif', 
                    fontSize: '18px', 
                    margin: '24px 0 16px',
                    color: 'var(--text-main)'
                  }}>
                    Recent Identifications
                  </h3>
                  <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <p className="empty-state-text">
                      No items yet. Start cataloging to see results here.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Dashboard State: Show Grid */}
            {!processing && hasItems && (
              <>
                {/* Slim New Session Button */}
                <div style={{ padding: '16px' }}>
                  <button 
                    className="btn-seamless btn-ghost"
                    onClick={handleStartNew}
                    style={{ width: '100%' }}
                  >
                    ➕ Start New Session
                  </button>
                </div>

                {/* Section Header */}
                <div style={{ padding: '0 16px' }}>
                  <h3 style={{ 
                    fontFamily: 'Outfit, sans-serif', 
                    fontSize: '18px', 
                    margin: '0 0 12px',
                    color: 'var(--text-main)'
                  }}>
                    Recent Identifications
                  </h3>
                </div>

                {/* Item Grid */}
                <div className="triage-grid">
                  {items.map((item, index) => (
                    <ItemCard
                      key={item.id || index}
                      item={item}
                      onCardClick={setSelectedItem}
                    />
                  ))}
                </div>

                {/* Export Button */}
                <div style={{ padding: '16px' }}>
                  <button
                    className="btn-seamless btn-primary"
                    onClick={() => {
                      const escapeCSV = (v: string) => {
                        if (!v) return '';
                        if (v.includes(',') || v.includes('"')) return `"${v.replace(/"/g, '""')}"`;
                        return v;
                      };
                      const rows = [
                        ['filename', 'box_id', 'title', 'type', 'year', 'notes', 'confidence'],
                        ...items.map(i => [
                          escapeCSV(i.filename), escapeCSV(i.box_id), escapeCSV(i.title),
                          escapeCSV(i.type), escapeCSV(i.year || ''), escapeCSV(i.notes || ''),
                          escapeCSV(i.confidence)
                        ])
                      ];
                      const csv = rows.map(r => r.join(',')).join('\n');
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `${items[0]?.box_id || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
                      link.click();
                    }}
                  >
                    📥 Export CSV
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* HISTORY VIEW */}
        {currentView === 'history' && (
          <div style={{ padding: '16px' }}>
            <BatchHistory 
              batches={batches} 
              onLoadBatch={loadBatch} 
              onDownloadCSV={downloadBatchCSV}
              onRefresh={() => loadBatchHistory(10)} 
              standalone={true} 
              hasMore={batches.length >= 10 && batches.length % 10 === 0}
              onLoadMore={() => loadBatchHistory(batches.length + 10)}
            />
          </div>
        )}

        {/* SETTINGS VIEW */}
        {currentView === 'settings' && (
          <div className="card" style={{ margin: '16px', padding: '20px' }}>
            <h2 style={{ 
              fontFamily: 'Outfit, sans-serif', 
              fontSize: '20px', 
              margin: '0 0 8px',
              color: 'var(--text-main)'
            }}>
              AI Provider Keys
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Keys are saved locally on your device. The app tries each provider in order.
            </p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                GEMINI API KEY (Recommended)
              </label>
              <input 
                type="password" 
                value={aiKeys.gemini} 
                onChange={e => updateKey('gemini', e.target.value)} 
                placeholder="AIza..."
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                OPENAI API KEY
              </label>
              <input 
                type="password" 
                value={aiKeys.openai} 
                onChange={e => updateKey('openai', e.target.value)} 
                placeholder="sk-..."
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                CLAUDE API KEY (Optional)
              </label>
              <input 
                type="password" 
                value={aiKeys.claude} 
                onChange={e => updateKey('claude', e.target.value)} 
                placeholder="sk-ant-..."
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
            </div>

            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>
                System Diagnostics
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn-seamless btn-ghost"
                  onClick={async () => {
                    setRunningTests(true);
                    setTestResults(null);
                    const results = await SystemValidator.runAllTests(aiKeys);
                    setTestResults(results);
                    setRunningTests(false);
                  }}
                  disabled={runningTests}
                  style={{ flex: 1 }}
                >
                  {runningTests ? 'Running...' : 'Run Self-Test'}
                </button>
                <button 
                  className="btn-seamless btn-ghost"
                  onClick={() => {
                    retryConnection();
                    alert("Network mode reset. Try syncing again.");
                  }}
                  style={{ flex: 1, color: '#3b82f6' }}
                >
                  🔄 Retry Network
                </button>
              </div>

              
              {testResults && (
                <div style={{ marginTop: '16px', background: '#F9FAFB', borderRadius: '12px', padding: '16px', border: '1px solid #E5E7EB' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Diagnostic Results
                  </h4>
                  {testResults.map((r, i) => (
                    <div key={i} style={{ marginBottom: '16px', borderBottom: i === testResults.length - 1 ? 'none' : '1px solid #F3F4F6', paddingBottom: i === testResults.length - 1 ? 0 : '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px' }}>
                        <span>{r.passed ? '✅' : '❌'}</span>
                        <span style={{ fontWeight: 700 }}>{r.name}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: r.passed ? '#059669' : '#DC2626', margin: '0 0 8px 24px', fontWeight: 500 }}>
                        {r.message}
                      </p>
                      {!r.passed && r.fixInstructions && (
                        <div style={{ 
                          marginLeft: '24px', 
                          background: '#FEF2F2', 
                          padding: '10px', 
                          borderRadius: '8px', 
                          border: '1px solid #FEE2E2',
                          fontSize: '11px',
                          color: '#991B1B'
                        }}>
                          <strong>How to fix:</strong> {r.fixInstructions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* INVENTORY VIEW */}
        {currentView === 'inventory' && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '20px', margin: 0 }}>
                📋 All Unique Items ({inventory.length})
              </h2>
              <button className="btn-seamless btn-ghost" onClick={() => loadInventory(true)} style={{ padding: '8px 12px' }}>
                🔄 Refresh
              </button>
            </div>
            {inventory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p className="empty-state-text">No items in inventory yet. Start cataloging to build your collection.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {inventory.map((item, idx) => (
                  <div 
                    key={item.id || idx} 
                    className="card hover-scale" 
                    onClick={() => handleInventoryItemClick(item)}
                    style={{ 
                      padding: '12px', 
                      display: 'flex', 
                      gap: '12px', 
                      cursor: 'pointer',
                      border: '1px solid #F1F5F9',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ 
                      width: '64px', 
                      height: '64px', 
                      borderRadius: '12px', 
                      backgroundColor: '#F3F4F6', 
                      overflow: 'hidden',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {item.thumbnail ? (
                        <img 
                          src={item.thumbnail.startsWith('data:') ? item.thumbnail : `data:image/jpeg;base64,${item.thumbnail}`} 
                          alt={item.title} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: '20px' }}>📦</span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>{item.title}</h4>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        {item.year && <span className="badge" style={{ fontSize: '10px', padding: '2px 8px' }}>📅 {item.year}</span>}
                        {item.type && <span className="badge" style={{ fontSize: '10px', padding: '2px 8px', background: '#F1F5F9', color: '#64748B' }}>📁 {item.type}</span>}
                        <span className="badge" style={{ fontSize: '10px', padding: '2px 8px', background: '#DBEAFE', color: '#1E40AF' }}>🔄 {item.times_scanned}x</span>
                        <span className="badge" style={{ fontSize: '10px', padding: '2px 8px', background: '#F0FDF4', color: '#166534' }}>⭐ {item.confidence}</span>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 4px', fontStyle: 'italic' }}>
                        "{item.notes?.length > 100 ? item.notes.substring(0, 100) + '...' : item.notes}"
                      </p>
                      <p style={{ fontSize: '10px', color: '#94A3B8', margin: 0, fontWeight: 500 }}>
                        Box: <strong>{item.box_id}</strong> • Last seen {new Date(item.last_seen).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ alignSelf: 'center', color: '#CBD5E1' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedItem && (
        <ItemDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSave={handleEditItem}
          onDelete={handleDeleteItem}
        />
      )}

      {/* Camera FAB */}
      <button 
        onClick={() => setShowCameraFullscreen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '28px',
          background: 'var(--primary)',
          color: 'white',
          border: 'none',
          boxShadow: 'var(--shadow-lg)',
          fontSize: '24px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40
        }}
      >
        📷
      </button>
    </div>
  );
}

export default App;
