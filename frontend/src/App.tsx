import React, { useState, useCallback, useEffect } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import NewSessionCard from './components/NewSessionCard';
import ItemCard, { CatalogItem } from './components/ItemCard';
import ItemDetail from './components/ItemDetail';
import BatchHistory from './components/BatchHistory';
import CameraCapture from './components/CameraCapture';
import ImageProgressList, { ItemStatus } from './components/ImageProgressList';

// Self-Contained Services
import { initDB, saveBatch, saveItem, getBatches, getBatchItems, updateItem, deleteItem, getIncompleteBatches, findByImageHash, addToInventory, updateInventoryItem, getAllInventory, InventoryItem, getLatestItemByHash } from './services/db';
import { analyzeImage, AIKeys, AIProvider } from './services/aiService';
import { SystemValidator, TestResult } from './services/testRunner';
import { computeImageHash, generateThumbnail } from './services/imageHash';
import { extractPhotoMetadata, extractFromBuffer } from './services/metadataService';

// Firebase & Cloud Sync
import { useAuth } from './contexts/AuthContext';
import { 
  saveUserSettings, 
  loadUserSettings, 
  syncBatchToCloud, 
  syncItemToCloud, 
  syncInventoryToCloud,
  deleteItemFromCloud,
  loadAllFromCloud,
  syncAllToCloud,
  retryConnection
} from './services/firestoreSync';
import { uploadToQueue, waitForItem, isServerProcessingAvailable } from './services/serverQueue';

interface BatchSummary {
  batch_id: string;
  box_id: string;
  total_images: number;
  processed: number;
  failed: number;
  created_at: string;
}



type ViewType = 'home' | 'history' | 'inventory' | 'settings' | 'progress';
type InventorySortOption = 'created_at-desc' | 'created_at-asc' | 'title-asc' | 'title-desc' | 'year-asc' | 'year-desc' | 'box_id-asc' | 'box_id-desc';

// Helper to get type-specific placeholder images
const getPlaceholderForType = (type?: string): string => {
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
  const lowerType = (type || '').toLowerCase();
  return typeMap[lowerType] || '/placeholders/other.svg';
};

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
  const [processingQueue, setProcessingQueue] = useState<ItemStatus[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [devNotes, setDevNotes] = useState(localStorage.getItem('dev_notes') || '');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [appStatus, setAppStatus] = useState<'initializing' | 'syncing' | 'ready' | 'error'>('initializing');

  // ========== AI USAGE TRACKING ==========
  const [aiUsage, setAiUsage] = useState({
    gemini: parseInt(localStorage.getItem('usage_gemini') || '0'),
    openai: parseInt(localStorage.getItem('usage_openai') || '0'),
    claude: parseInt(localStorage.getItem('usage_claude') || '0')
  });

  const [batchStartTime, setBatchStartTime] = useState<Date | null>(null);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [incompleteBatch, setIncompleteBatch] = useState<any>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isDbInitialized, setIsDbInitialized] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [inventoryLastDate, setInventoryLastDate] = useState<string | undefined>(undefined);
  const [inventorySort, setInventorySort] = useState<InventorySortOption>('created_at-desc');

  // Helper to show a toast
  const showToast = useCallback((message: string, duration = 3000) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), duration);
  }, []);

  // Debounced Save for Dev Notes
  const saveDevNotes = useCallback(async (notes: string) => {
      localStorage.setItem('dev_notes', notes);
      if (user) {
          await saveUserSettings(user.uid, { dev_notes: notes } as any);
      }
  }, [user]);

  // ========== DATA LOADING HELPERS ==========
  const loadBatchHistory = useCallback(async (limit = 10) => {
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
    
    // Auto-load recent items for Home Screen (if empty)
    if (batchesWithThumbs.length > 0 && items.length === 0) {
      const latestBatchId = batchesWithThumbs[0].batch_id;
      const batchItems = await getBatchItems(latestBatchId);
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
        status: item.status,
        comps_quote: item.comps_quote
      })));
    }
  }, [items.length]);

  const loadInventory = useCallback(async (reset = true) => {
    const limit = 50;
    const lastDate = reset ? undefined : inventoryLastDate;
    
    // Pass sort option to DB
    const newItems = await getAllInventory(limit, lastDate, inventorySort);
    
    if (reset) {
      setInventory(newItems);
    } else {
      setInventory(prev => [...prev, ...newItems]);
    }
    
    if (newItems.length > 0) {
      const lastItem = newItems[newItems.length - 1];
      setInventoryLastDate(lastItem.last_seen);
    }
  }, [inventoryLastDate, inventorySort]);

  // Keep usage in sync with localStorage
  useEffect(() => {
    localStorage.setItem('usage_gemini', aiUsage.gemini.toString());
    localStorage.setItem('usage_openai', aiUsage.openai.toString());
    localStorage.setItem('usage_claude', aiUsage.claude.toString());
  }, [aiUsage]);

  // UX Hardening: Back Button Trap
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      // If we are in process, or just generally to prevent exit
      if (currentView !== 'home') {
          setCurrentView('home');
          window.history.pushState(null, '', window.location.pathname);
      } else {
          // Toast warning
          showToast("Press Back again to Exit", 2000);
          // Allow exit if pressed again quickly? Hard to implement perfectly in browser PWA without native wrappers
          // But pushing state prevents immediate exit
          window.history.pushState(null, '', window.location.pathname); 
      }
    };
    
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentView, showToast]);

  // SW Update Listener
  useEffect(() => {
    const handleSWUpdate = () => {
      showToast("✨ New Update Available! Reloading...", 2000);
      setTimeout(() => window.location.reload(), 2000); // Auto-reload for mom
    };
    window.addEventListener('sw-update', handleSWUpdate);
    return () => window.removeEventListener('sw-update', handleSWUpdate);
  }, [showToast]);

  // Sync-on-Focus (Magic Sync)
  useEffect(() => {
    const handleFocus = async () => {
      // Only sync if we are relatively idle and logged in
      if (!processing && user && appStatus === 'ready') {
        console.log("👁️ App focused - Checking for magic sync...");
        
        // 1. Get current local state accurately
        const localBatches = await getBatches(10);
        
        // 2. Peek at cloud
        const { batches: cloudBatches } = await loadAllFromCloud(user.uid);
        
            // 3. Compare smartly: ONLY notify if we get *genuinely new* stuff from OTHER devices
            // Note: In a real PWA, we'd check a "deviceId" metadata on the cloud batch.
            // FIX: If the batch exists locally but maybe with slightly different details, we ignore it.
            
            if (cloudBatches.length > localBatches.length) {
                setAppStatus('syncing'); 
                let addedCount = 0;
                const localIds = new Set(localBatches.map(b => b.batch_id));

                for (const b of cloudBatches) { 
                  if (!localIds.has(b.batch_id)) {
                    await saveBatch(b); 
                    addedCount++;
                  }
                }
            
            // STRICT CHECK: Only show toast if we actually added something new
            if (addedCount > 0) {
              showToast(`✨ Synced ${addedCount} new batch${addedCount > 1 ? 'es' : ''} from cloud`);
              loadBatchHistory();
            } else {
              console.log("Sync checked: No new content to merge.");
            }
            setAppStatus('ready');
        }
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, processing, appStatus, loadBatchHistory, showToast]);

  const handleForcePush = async () => {
    if (!user) {
      showToast("❌ Please sign in first");
      return;
    }
    setAppStatus('syncing');
    showToast("📤 Starting Manual Push...");
    
    try {
      const localBatches = await getBatches(500);
      for (const b of localBatches) {
        await syncBatchToCloud(user.uid, b);
        const bItems = await getBatchItems(b.batch_id);
        for (const item of bItems) {
          await syncItemToCloud(user.uid, item);
        }
      }
      const localInv = await getAllInventory(1000);
      for (const item of localInv) {
        await syncInventoryToCloud(user.uid, item);
      }
      showToast("✅ Cloud Push Complete!");
    } catch (err) {
      console.error(err);
      showToast("❌ Push Failed");
    } finally {
      setAppStatus('ready');
    }
  };

  const handleForcePull = async () => {
    if (!user) {
      showToast("❌ Please sign in first");
      return;
    }
    setAppStatus('syncing');
    showToast("📥 Starting Manual Pull...");
    
    try {
      const { batches: cloudBatches, inventory: cloudInv } = await loadAllFromCloud(user.uid);
      for (const b of cloudBatches) { await saveBatch(b); }
      for (const item of cloudInv) { await addToInventory(item); }
      await loadBatchHistory();
      await loadInventory();
      showToast(`✅ Pull Complete! (${cloudBatches.length} batches, ${cloudInv.length} items)`);
    } catch (err) {
      console.error(err);
      showToast("❌ Pull Failed");
    } finally {
      setAppStatus('ready');
    }
  };

  const incrementUsage = (provider: AIProvider) => {
    setAiUsage(prev => ({ ...prev, [provider]: prev[provider] + 1 }));
  };





  // ========== DATA LOADING HELPERS ==========


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
      status: item.status,
      comps_quote: item.comps_quote
    })));
    setCurrentView('home');
  };



  const handleInventoryItemClick = async (item: InventoryItem) => {
    const fullItem = await getLatestItemByHash(item.image_hash);
    if (fullItem) {
      setSelectedItem({
        ...fullItem,
        image_data: fullItem.image_data.toString().startsWith('data:') 
          ? fullItem.image_data 
          : `data:image/jpeg;base64,${fullItem.image_data}`
      } as any);
    } else {
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
        image_data: item.thumbnail || '',
        status: 'completed',
        comps_quote: item.comps_quote
      });
    }
  };

  const handleStartNew = () => {
    setItems([]);
    setBoxId('');
  };

  // Initialize DB and load history
  // CRITICAL: This must complete before ANY other DB or Cloud ops run
  useEffect(() => {
    const boot = async () => {
      try {
        setStatusMessage('Initializing database...');
        await initDB();
        setIsDbInitialized(true); // Signal that DB is safe to use
        setStatusMessage('Loading history...');
        await loadBatchHistory();
        
        // Initial Check for incomplete batches
        const incomplete = await getIncompleteBatches();
        if (incomplete.length > 0) {
          const lastIncomplete = incomplete[0]; // Assuming the first one is the most recent or relevant
          setIncompleteBatch(lastIncomplete);
      
          // LOGIC FIX: Only show resume prompt if this is a "fresh" start
          // We use sessionStorage which clears when the tab/browser is closed
          const hasSeenPrompt = sessionStorage.getItem('has_seen_resume_prompt');
          
          if (!hasSeenPrompt) {
            setShowResumePrompt(true);
            sessionStorage.setItem('has_seen_resume_prompt', 'true');
          } else {
            console.log("Skipping resume prompt (already seen this session)");
          }
        }
        
        // If no user, we're done initializing (local only mode)
        if (!user) {
          setAppStatus('ready');
          setStatusMessage('Ready (Offline Mode)');
        }
      } catch (err) {
        console.error("Critical Boot Error:", err);
        setDbError(true);
        setAppStatus('error');
        setStatusMessage('Database Error!');
      }
    };
    boot();
  }, [loadBatchHistory, user]);

  // ========== CLOUD SYNC: LOAD SETTINGS & CLOUD DATA ==========
  useEffect(() => {
    const loadCloudData = async () => {
      // STOP: Do not touch DB until it is initialized
      if (!isDbInitialized) return;

      if (user && !keysLoadedFromCloud) {
        console.log('☁️ User logged in, syncing cloud data...');
        setAppStatus('syncing');
        setStatusMessage('Syncing with cloud...');
        
        // 1. Sync Settings (API Keys)
        const cloudSettings = await loadUserSettings(user.uid);
        if (cloudSettings?.apiKeys) {
          setAiKeys(prev => ({ ...prev, ...cloudSettings.apiKeys }));
          Object.entries(cloudSettings.apiKeys).forEach(([provider, val]) => {
            if (val) localStorage.setItem(`ai_key_${provider}`, val);
          });
        }
        if (cloudSettings?.dev_notes) {
            setDevNotes(cloudSettings.dev_notes);
            localStorage.setItem('dev_notes', cloudSettings.dev_notes);
        }

        // 2. Fetch all history/inventory from cloud (for multi-device support)
        try {
          setStatusMessage('Merging cloud data...');
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
            loadInventory(true);
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
          
          setAppStatus('ready');
          setStatusMessage('Ready ✓');
          showToast('✅ Synced with cloud successfully!');
        } catch (err) {
          console.error('Failed to pull cloud data:', err);
          setAppStatus('error');
          setStatusMessage('Sync Failed!');
          showToast('❌ Cloud sync failed. Data saved locally.');
        }

        setKeysLoadedFromCloud(true);
      } else if (!user) {
        setKeysLoadedFromCloud(false);
      }
    };
    loadCloudData();
  }, [user, keysLoadedFromCloud, isDbInitialized, loadBatchHistory, loadInventory, showToast]);



  // Refresh data when switching views
  useEffect(() => {
    if (currentView === 'history') loadBatchHistory();
    if (currentView === 'inventory') loadInventory(true);
    if (currentView === 'home') loadBatchHistory(); // Load recent items for dashboard
  }, [currentView, inventorySort, loadBatchHistory, loadInventory]);

  // Save boxId to localStorage
  useEffect(() => {
    if (boxId) localStorage.setItem('boxId', boxId);
  }, [boxId]);


  const processBatch = async (overrideFiles?: File[], overrideBoxId?: string) => {
    const filesToProcess = overrideFiles || (files.length > 0 ? files : []);
    const targetBoxId = overrideBoxId || boxId || 'Uncategorized';

    if (!filesToProcess || filesToProcess.length === 0) {
      console.warn("processBatch called with no files.");
      return;
    }
    
    const totalFiles = filesToProcess.length;
    const batchId = `local-${Date.now()}`;
    const startTime = new Date();
    
    setProcessing(true);
    setCurrentView('progress');
    setItems([]); 
    setBatchStartTime(startTime);
    setProgress({ current: 0, total: totalFiles, currentFilename: '' });
    
    const initialQueue: ItemStatus[] = filesToProcess.map((f, idx) => ({
      id: Date.now() + idx,
      filename: f.name,
      status: 'pending'
    }));
    setProcessingQueue(initialQueue);

    const results: CatalogItem[] = [];
    let serverFailedForBatch = false; // If server fails once, skip for rest of batch
    
    await saveBatch({
      batch_id: batchId,
      box_id: targetBoxId,
      total_images: totalFiles,
      processed: 0,
      failed: 0,
      created_at: startTime.toISOString(),
      status: 'processing'
    });

    const DELAY_MS = 1500;
    const processedHashesInBatch = new Map<string, any>(); 
    
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const queueId = initialQueue[i].id;
      
      setProgress(prev => ({ ...prev, current: i, currentFilename: file.name }));
      setProcessingQueue(prev => prev.map(p => p.id === queueId ? { ...p, status: 'processing' } : p));
      
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
        const base64Data = await base64Promise;
        const imageHash = await computeImageHash(base64Data);
        
        const dbExisting = await findByImageHash(imageHash);
        const batchExisting = processedHashesInBatch.get(imageHash);
        const existingItem = batchExisting || dbExisting;
        
        let aiData: any;
        let isDupe = false;
        
        if (existingItem) {
          console.log(`Duplicate detected: ${existingItem.title}`);
          showToast(`♻️ Duplicate: "${existingItem.title}" already in inventory`);
          aiData = {
            title: existingItem.title,
            type: existingItem.type,
            year: existingItem.year,
            notes: `[Duplicate] ${existingItem.notes || ''}`,
            confidence: existingItem.confidence,
            condition_estimate: existingItem.condition_estimate || '',
            raw_metadata: existingItem.raw_metadata || {}
          };
          isDupe = true;
          
          if (existingItem.id && !batchExisting) {
            await updateInventoryItem(existingItem.id, {
              last_seen: new Date().toISOString(),
              times_scanned: (existingItem.times_scanned || 1) + 1
            });
          }
        } else {
          // NEW: Try server-side processing first (survives tab close)
          // But skip if server already failed for this batch
          let serverResult = null;
          if (user && isServerProcessingAvailable(user.uid) && !serverFailedForBatch) {
            try {
              if (i === 0) showToast('☁️ Processing in cloud (survives tab close)');
              console.log('🌐 Attempting server-side processing...');
              const queueItemId = await uploadToQueue(user.uid, batchId, file.name, targetBoxId, base64Data);
              serverResult = await waitForItem(user.uid, queueItemId, 30000); // 30s timeout for first
              if (!serverResult) {
                serverFailedForBatch = true; // Disable server for rest of batch
                showToast('📱 Server busy, using local AI');
              }
            } catch (e) {
              console.warn('Server processing failed, falling back to local:', e);
              serverFailedForBatch = true; // Disable server for rest of batch
            }
          }
          
          // Use server result OR fall back to local AI
          if (serverResult) {
            aiData = serverResult;
            console.log('✅ Used server-side result');
          } else {
            // FALLBACK: Local AI processing (always works)
            incrementUsage(aiKeys.openai ? 'openai' : (aiKeys.gemini ? 'gemini' : 'claude'));
            aiData = await analyzeImage(base64Data, aiKeys);
            console.log('📱 Used local AI processing');
          }
          
          const photoMeta = await extractPhotoMetadata(file);
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
            box_id: targetBoxId,
            condition_estimate: aiData.condition_estimate || '',
            raw_metadata: {
              ...(aiData.raw_metadata || {}),
              photo_metadata: photoMeta,
              system_info: {
                original_filename: file.name,
                file_size: file.size,
                last_modified: new Date(file.lastModified).toISOString(),
                batch_id: batchId,
                captured_at: new Date().toISOString()
              }
            }
          };
          await addToInventory(inventoryData);
          processedHashesInBatch.set(imageHash, inventoryData);
          if (user) syncInventoryToCloud(user.uid, inventoryData);
        }

        const item: CatalogItem = {
          id: queueId,
          batch_id: batchId,
          filename: file.name,
          box_id: targetBoxId,
          title: aiData.title,
          type: aiData.type,
          year: aiData.year || '',
          notes: aiData.notes || '',
          confidence: aiData.confidence,
          processed_at: new Date().toISOString(),
          image_data: `data:image/jpeg;base64,${base64Data}`,
          status: 'completed',
          condition_estimate: aiData.condition_estimate || '',
          raw_metadata: aiData.raw_metadata || {}
        };

        results.push(item);
        setItems(prev => [...prev, item]);

        const itemRecord = {
          batch_id: batchId,
          filename: file.name,
          box_id: targetBoxId,
          title: aiData.title,
          type: aiData.type,
          year: aiData.year || '',
          notes: aiData.notes || '',
          confidence: aiData.confidence,
          processed_at: item.processed_at,
          image_data: base64Data,
          status: 'completed' as const,
          image_hash: imageHash,
          condition_estimate: aiData.condition_estimate || '',
          raw_metadata: aiData.raw_metadata || {}
        };
        await saveItem(itemRecord);
        if (user) syncItemToCloud(user.uid, itemRecord);

        const batchUpdate = {
          batch_id: batchId,
          box_id: targetBoxId,
          total_images: totalFiles,
          processed: i + 1,
          failed: 0,
          created_at: startTime.toISOString(),
          status: 'processing' as const
        };
        await saveBatch(batchUpdate);
        if (user) syncBatchToCloud(user.uid, batchUpdate);

        setProgress(prev => ({ ...prev, current: i + 1 }));
        setProcessingQueue(prev => prev.map(p => p.id === queueId ? { ...p, status: 'completed' } : p));
        
        if (i < filesToProcess.length - 1 && !isDupe) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }

      } catch (err: any) {
        console.error(`Batch item error [${queueId}]:`, err);
        setProcessingQueue(prev => prev.map(p => p.id === queueId ? { ...p, status: 'failed', error_message: err.message } : p));
      }
    }

    const finalBatch = {
      batch_id: batchId,
      box_id: targetBoxId,
      total_images: totalFiles,
      processed: results.length,
      failed: totalFiles - results.length,
      created_at: startTime.toISOString(),
      status: 'completed' as const
    };
    await saveBatch(finalBatch);
    if (user) syncBatchToCloud(user.uid, finalBatch);

    setFiles([]);
    setProcessing(false);
    loadBatchHistory();
  };
  const resumeBatch = async (batch: any) => {
    const batchId = batch.batch_id;
    const targetBoxId = batch.box_id;
    const allItems = await getBatchItems(batchId);
    const pendingItems = allItems.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) {
      const finalBatch = { ...batch, status: 'completed' as const };
      await saveBatch(finalBatch);
      if (user) syncBatchToCloud(user.uid, finalBatch);
      await loadBatch(batchId);
      return;
    }

    setProcessing(true);
    setCurrentView('progress');
    setBatchStartTime(new Date());
    setProgress({ current: allItems.length - pendingItems.length, total: allItems.length, currentFilename: '' });
    
    // Pre-populate queue with status
    const initialQueue: ItemStatus[] = allItems.map(item => ({
      id: item.id!,
      filename: item.filename,
      status: item.status
    }));
    setProcessingQueue(initialQueue);

    const DELAY_MS = 1500;

    for (let i = 0; i < pendingItems.length; i++) {
      const itemRecord = pendingItems[i];
      const queueId = itemRecord.id!;
      
      setProgress(prev => ({ ...prev, currentFilename: itemRecord.filename }));
      setProcessingQueue(prev => prev.map(p => p.id === queueId ? { ...p, status: 'processing' } : p));

      try {
        const base64Data = typeof itemRecord.image_data === 'string' 
          ? itemRecord.image_data 
          : await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(itemRecord.image_data as Blob);
            });

        // Compute hash
        const imageHash = await computeImageHash(base64Data);
        
        // Extract EXIF from blob/base64
        let photoMeta = {};
        try {
          const arrayBuffer = typeof itemRecord.image_data === 'string' 
            ? Uint8Array.from(atob(itemRecord.image_data), c => c.charCodeAt(0)).buffer
            : await (itemRecord.image_data as Blob).arrayBuffer();
          
          photoMeta = await extractFromBuffer(arrayBuffer);
        } catch (e) {
          console.warn('Resume metadata extract failed', e);
        }

        // AI Analyze
        incrementUsage(aiKeys.openai ? 'openai' : (aiKeys.gemini ? 'gemini' : 'claude'));
        const aiData = await analyzeImage(base64Data, aiKeys);
        
        const thumbnail = await generateThumbnail(`data:image/jpeg;base64,${base64Data}`);
        
        // Update Inventory
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
          box_id: targetBoxId,
          condition_estimate: aiData.condition_estimate || '',
          raw_metadata: {
            ...(aiData.raw_metadata || {}), // Defensive spread
            photo_metadata: photoMeta,
            system_info: {
              original_filename: itemRecord.filename,
              batch_id: batchId,
              resumed_at: new Date().toISOString()
            }
          }
        };
        await addToInventory(inventoryData);
        if (user) syncInventoryToCloud(user.uid, inventoryData);

        // Update Item Record
        const updatedItem = {
          ...itemRecord,
          ...aiData,
          status: 'completed' as const,
          image_hash: imageHash,
          condition_estimate: aiData.condition_estimate || '',
          raw_metadata: inventoryData.raw_metadata
        };
        await updateItem(queueId, updatedItem);
        if (user) syncItemToCloud(user.uid, updatedItem);

        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
        setProcessingQueue(prev => prev.map(p => p.id === queueId ? { ...p, status: 'completed' } : p));
        
        if (i < pendingItems.length - 1) await new Promise(r => setTimeout(r, DELAY_MS));

      } catch (err: any) {
        console.error("Resume error:", err);
        setProcessingQueue(prev => prev.map(p => p.id === queueId ? { ...p, status: 'failed', error_message: err.message } : p));
      }
    }

    // Finalize Batch
    const finalBatch = {
      ...batch,
      processed: allItems.length,
      status: 'completed' as const
    };
    await saveBatch(finalBatch);
    if (user) syncBatchToCloud(user.uid, finalBatch);
    
    setProcessing(false);
    loadBatchHistory();
  };



  const handleRetryAI = async (item: CatalogItem) => {
    if (!item.image_data) return;
    
    // Extract base64
    const base64 = item.image_data.toString().includes('base64,') 
      ? item.image_data.toString().split('base64,')[1] 
      : item.image_data.toString();

    // Re-run Analysis
    incrementUsage(aiKeys.openai ? 'openai' : (aiKeys.gemini ? 'gemini' : 'claude'));
    const aiData = await analyzeImage(base64, aiKeys);
    
    // Construct updates
    const updatedFields = {
      title: aiData.title,
      type: aiData.type,
      year: aiData.year,
      notes: aiData.notes,
      confidence: aiData.confidence
    };

    // Update Local State (Immediate Feedback)
    setSelectedItem(prev => prev ? { ...prev, ...updatedFields } : null);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updatedFields } : i));

    // Update DBs
    if (item.id) {
      await updateItem(item.id, updatedFields);
      // Sync item to cloud
      if (user) syncItemToCloud(user.uid, { ...item, ...updatedFields } as any);
    }
    
    // Update Inventory if linked
    if ((item as any).image_hash) {
      const invItem = await findByImageHash((item as any).image_hash);
      if (invItem && invItem.id) {
        await updateInventoryItem(invItem.id, {
          title: aiData.title,
          type: aiData.type,
          year: aiData.year || '',
          notes: aiData.notes || '',
          confidence: aiData.confidence,
          last_seen: new Date().toISOString()
        });
      }
    }
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
        notes: updatedItem.notes || '',
        box_id: updatedItem.box_id,
        comps_quote: updatedItem.comps_quote,
        saved_comps: updatedItem.saved_comps // Persist detailed comps history
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
          status: 'completed',
          comps_quote: updatedItem.comps_quote,
          saved_comps: updatedItem.saved_comps
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
    
    const escapeCSV = (value: any): string => {
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
          onFilesCaptured={(files, capturedBoxId) => {
            setShowCameraFullscreen(false);
            processBatch(files, capturedBoxId);
          }}
          standalone={true}
        />
      )}

      {/* Navbar */}
      <Navbar 
        onMenuClick={() => setShowMenu(!showMenu)} 
        currentView={currentView}
        onBack={() => setCurrentView('home')}
      />
      
      {/* Status Bar */}
      {appStatus !== 'ready' && (
        <div style={{
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 600,
          textAlign: 'center',
          backgroundColor: appStatus === 'error' ? '#ef4444' : appStatus === 'syncing' ? '#f59e0b' : '#22c55e',
          color: 'white',
          transition: 'all 0.3s ease'
        }}>
          {statusMessage}
        </div>
      )}

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
                  await resumeBatch(incompleteBatch);
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
                  if (user) syncBatchToCloud(user.uid, { ...incompleteBatch, status: 'completed' });
                  setShowResumePrompt(false);
                  setIncompleteBatch(null);
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
          {(['home', 'inventory'] as ViewType[]).map(view => (
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
              {view === 'home' ? '📦 Catalog' : view === 'inventory' ? '📋 Inventory' : '⚙️ Settings'}
            </button>
          ))}
          {/* Show Progress option when actively processing */}
          {processing && (
            <button
              onClick={() => { setCurrentView('progress'); setShowMenu(false); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 20px',
                border: 'none',
                background: '#FEF3C7',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: 700,
                color: '#92400E',
                cursor: 'pointer'
              }}
            >
              ⏳ View Progress ({progress.current}/{progress.total})
            </button>
          )}
          <div style={{ padding: '8px 16px', borderTop: '1px solid #eee' }}>
             <small style={{ color: '#999' }}>Settings</small>
          </div>
          <button 
            onClick={() => { setCurrentView('settings'); setShowMenu(false); }}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 20px',
              border: 'none',
              background: currentView === 'settings' ? '#F3F4F6' : 'transparent',
              textAlign: 'left',
              fontSize: '14px',
              fontWeight: currentView === 'settings' ? 600 : 400,
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            ⚙️ App Settings
          </button>
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
                
                {/* Live Processed Items */}
                {items.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                      Processed ({items.length})
                    </h4>
                    <div className="grid-cols-3" style={{ gap: '8px' }}>
                      {items.map(item => (
                        <div 
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          style={{
                            position: 'relative',
                            background: 'var(--card-bg)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            aspectRatio: '1'
                          }}
                        >
                          <img 
                            src={item.image_data || getPlaceholderForType(item.type)} 
                            alt={item.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          {item.notes?.includes('[Duplicate]') && (
                            <span style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              background: '#f59e0b',
                              color: 'white',
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700
                            }}>DUP</span>
                          )}
                          {item.title === 'Manual Entry Required' && (
                            <span style={{
                              position: 'absolute',
                              top: '4px',
                              left: '4px',
                              background: '#ef4444',
                              color: 'white',
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700
                            }}>NEEDS AI</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty State: Show New Session Card */}
            {!processing && !hasItems && (
              <>
                <NewSessionCard
                  boxId={boxId}
                  onBoxIdChange={setBoxId}
                  onFilesSelected={setFiles}
                  onStartCataloging={() => processBatch()}
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

            {/* Dashboard State: Show New Session Card FIRST */}
            {!processing && hasItems && (
              <>
                <NewSessionCard
                  boxId={boxId}
                  onBoxIdChange={setBoxId}
                  onFilesSelected={setFiles}
                  onStartCataloging={() => processBatch()}
                  isProcessing={processing}
                  selectedCount={files.length}
                />

                {/* Section Header with Sorting (More Compact) */}
                <div style={{ padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 8px' }}>
                  <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '16px', margin: 0, color: 'var(--text-main)' }}>
                    Recent activity
                  </h3>
                  <select
                    id="sort-dashboard"
                    value={inventorySort}
                    onChange={(e) => setInventorySort(e.target.value as InventorySortOption)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #E5E7EB',
                      fontSize: '11px',
                      backgroundColor: 'white',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="created_at-desc">Newest</option>
                    <option value="title-asc">A-Z</option>
                    <option value="year-desc">Year</option>
                    <option value="box_id-asc">Box</option>
                  </select>
                </div>

                {/* Item Grid (NOW HORIZONTAL SCROLL) */}
                <div className="horizontal-scroll">
                  {items
                    .sort((a, b) => {
                      if (inventorySort === 'title-asc') return (a.title || '').localeCompare(b.title || '');
                      if (inventorySort === 'title-desc') return (b.title || '').localeCompare(a.title || '');
                      if (inventorySort === 'year-asc') return (a.year || '').localeCompare(b.year || '');
                      if (inventorySort === 'year-desc') return (b.year || '').localeCompare(a.year || '');
                      if (inventorySort === 'box_id-asc') return (a.box_id || '').localeCompare(b.box_id || '');
                      if (inventorySort === 'box_id-desc') return (b.box_id || '').localeCompare(a.box_id || '');
                      if (inventorySort === 'created_at-asc') return (a.processed_at || '').localeCompare(b.processed_at || '');
                      return (b.processed_at || '').localeCompare(a.processed_at || '');
                    })
                    .map((item, index) => (
                      <ItemCard
                        key={item.id || index}
                        item={item}
                        onCardClick={setSelectedItem}
                      />
                    ))}
                </div>

                {/* Export Button (Subtle) */}
                <div style={{ padding: '16px', textAlign: 'center' }}>
                  <button
                    className="btn-seamless btn-ghost"
                    style={{ width: 'auto', fontSize: '12px', padding: '8px 16px' }}
                    onClick={() => {
                      const escapeCSV = (v: any) => {
                        if (v === null || v === undefined) return '';
                        const str = String(v);
                        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                          return `"${str.replace(/"/g, '""')}"`;
                        }
                        return str;
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

        {/* PROGRESS QUEUE VIEW */}
        {currentView === 'progress' && (
          <div style={{ padding: '20px' }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', marginBottom: '16px' }}>Processing Queue</h2>
            
            {processingQueue.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <p className="empty-state-text">Queue is empty. Everything processed!</p>
                <button className="btn-seamless btn-primary" onClick={() => setCurrentView('home')} style={{ marginTop: '16px' }}>
                  Back to Dashboard
                </button>
              </div>
            ) : (
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {processing ? 'Running...' : 'Finished'}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {processingQueue.filter(i => i.status === 'completed').length} / {processingQueue.length} Completed
                  </span>
                </div>
                
                {/* Re-use ImageProgressList but possibly bigger styling if needed, currently it's compact */}
                <ImageProgressList items={processingQueue} />
                
                {!processing && (
                  <button 
                    className="btn-seamless btn-primary" 
                    onClick={() => {
                      setProcessingQueue([]);
                      loadBatchHistory();
                      setCurrentView('home'); 
                    }}
                    style={{ marginTop: '20px', width: '100%' }}
                  >
                    Clear & Go Home
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* INVENTORY VIEW */}
        {currentView === 'inventory' && (
          <div className="card" style={{ margin: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: 800, margin: 0 }}>🗄️ Inventory</h2>
          <button className="btn-seamless btn-ghost" onClick={() => loadInventory(true)} style={{ padding: '6px 10px', fontSize: '12px' }}>
            🔄 Refresh
          </button>
        </div>

            {inventory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p className="empty-state-text">No items in inventory yet. Start cataloging to build your collection.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label htmlFor="sort-inventory" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>Sort:</label>
                  <select
                    id="sort-inventory"
                    value={inventorySort}
                    onChange={(e) => setInventorySort(e.target.value as InventorySortOption)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #E5E7EB',
                      fontSize: '13px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="title-asc">Title (A-Z)</option>
                    <option value="title-desc">Title (Z-A)</option>
                    <option value="year-asc">Year (Oldest First)</option>
                    <option value="year-desc">Year (Newest First)</option>
                    <option value="box_id-asc">Box ID (A-Z)</option>
                    <option value="box_id-desc">Box ID (Z-A)</option>
                    <option value="created_at-desc">Date Added (Newest First)</option>
                    <option value="created_at-asc">Date Added (Oldest First)</option>
                  </select>
                </div>
                <div className="triage-grid">
                  {inventory.map((item, idx) => (
                    <ItemCard
                      key={item.id || idx}
                      item={{
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
                        image_data: item.thumbnail || '',
                        status: 'completed',
                        comps_quote: item.comps_quote
                      }}
                      onCardClick={() => handleInventoryItemClick(item)}
                    />
                  ))}
                </div>
              </>
            )}
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
              Settings
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Keys are saved locally on your device. The app tries each provider in order.
            </p>
            
            <details style={{ 
                background: '#F9FAFB', 
                border: '1px solid #E5E7EB', 
                borderRadius: '8px', 
                padding: '12px',
                marginBottom: '20px'
            }}>
                <summary style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}>
                    🔧 Advanced: API Keys & Diagnostics
                </summary>
                
                <div style={{ marginTop: '16px' }}>
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
            
            <div style={{ marginBottom: '24px', background: 'var(--canvas-bg)', padding: '16px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>📊 AI Usage & Cost Estimate</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '8px', background: 'white', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Gemini (Mostly Free)</div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>{aiUsage.gemini} <small style={{ fontSize: '10px', color: '#059669' }}>LIMITS APPLY</small></div>
                </div>
                <div style={{ padding: '8px', background: 'white', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>OpenAI (Paid)</div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>{aiUsage.openai} <small style={{ fontSize: '10px', color: '#DC2626' }}>~${(aiUsage.openai * 0.01).toFixed(2)}</small></div>
                </div>
              </div>
              <button 
                onClick={() => setAiUsage({ gemini: 0, openai: 0, claude: 0 })}
                style={{ marginTop: '12px', fontSize: '11px', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Reset Counters
              </button>
            </div>
            
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '20px', marginBottom: '24px' }}>
               <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>
                 📜 Processing History
               </h3>
               <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
                  <BatchHistory 
                    batches={batches}
                    onResume={(batch) => {
                      setIncompleteBatch(batch);
                      resumeBatch(batch);
                    }}
                    onDownloadCSV={downloadBatchCSV}
                    onDelete={async (batchId) => {
                       // Delete local logic would act here
                       // Since BatchHistory is currently view-only props, we might need a prop on BatchHistory? 
                       // Wait, BatchHistory takes `onDelete`? No, let's check BatchHistory props.
                       // For now, we just view it.
                       alert("Delete from history coming soon.");
                    }}
                  />
               </div>
            </div>

            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '20px', marginBottom: '24px' }}>
               <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>
                 📜 Processing History
               </h3>
               <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
                  <BatchHistory 
                    batches={batches}
                    onResume={(batch) => {
                      setIncompleteBatch(batch);
                      resumeBatch(batch);
                    }}
                    onDownloadCSV={downloadBatchCSV}
                    onLoadBatch={() => {}} // Not needed in settings view context
                    onRefresh={loadBatchHistory}
                  />
               </div>
            </div>

            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '20px', marginBottom: '24px' }}>
              <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                📝 Developer & Workflow Notes
              </label>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Keep track of bugs, desired workflows, and future ideas here. Auto-saves locally.
              </p>
              <textarea 
                value={devNotes}
                onChange={e => {
                    setDevNotes(e.target.value);
                    saveDevNotes(e.target.value);
                }}
                placeholder="Record bugs, workflow ideas, and future features here..."
                style={{ 
                  width: '100%', 
                  minHeight: '150px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  background: '#F9FAFB'
                }}
              />
            </div>

            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #E5E7EB' }}>
               <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#DC2626', marginBottom: '12px' }}>
                 Danger Zone
               </h3>
               <button 
                  onClick={async () => {
                      if (window.confirm("Are you sure? This will delete all LOCAL data and reload. (Cloud data is safe)")) {
                          localStorage.clear();
                          const { deleteDB } = await import('idb');
                          await deleteDB('vintage-cataloger-db');
                          if ('serviceWorker' in navigator) {
                              const registrations = await navigator.serviceWorker.getRegistrations();
                              for(let registration of registrations) {
                                  await registration.unregister();
                              }
                          }
                          window.location.reload();
                      }
                  }}
                  style={{
                      width: '100%',
                      padding: '12px',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      border: '1px solid #FECACA',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer'
                  }}
               >
                   ☢️ Force Clear Cache & Reset
               </button>
            </div>
            
            </div> {/* End of inner content div */}
            </details> {/* End of Advanced Section */}

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

              {/* Manual Cloud Controls */}
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <button
                  className="btn-seamless btn-primary"
                  onClick={handleForcePush}
                  style={{ flex: 1, background: '#8B5CF6', border: 'none' }}
                >
                  ☁️ Force Push
                </button>
                <button
                  className="btn-seamless btn-ghost"
                  onClick={handleForcePull}
                  style={{ flex: 1, border: '1px solid #8B5CF6', color: '#8B5CF6' }}
                >
                  📥 Force Pull
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

      </main>

      {/* Detail Modal */}
      {selectedItem && (
        <ItemDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSave={handleEditItem}
          onDelete={handleDeleteItem}
          onRetry={handleRetryAI}
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
      
      {/* Floating Progress Pill - Shown when processing but not on progress view */}
      {processing && currentView !== 'progress' && (
        <button
          onClick={() => setCurrentView('progress')}
          style={{
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
            cursor: 'pointer',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'pulse 2s infinite'
          }}
        >
          <span style={{ fontSize: '16px' }}>⏳</span>
          Processing {progress.current}/{progress.total} • Tap to View
        </button>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(17, 24, 39, 0.9)', /* Sleek Dark Gray */
          color: 'white',
          padding: '10px 20px',
          borderRadius: '100px', /* Pill shape */
          fontSize: '13px',
          fontWeight: 700,
          zIndex: 200,
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.1)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          maxWidth: '90%',
          textAlign: 'center',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toastMessage.includes('Synced') ? '✨' : toastMessage.includes('✅') ? '✅' : 'ℹ️'} {toastMessage}
        </div>
      )}
    </div>
  );
}

export default App;
