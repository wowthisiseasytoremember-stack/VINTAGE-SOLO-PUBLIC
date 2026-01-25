// Firestore Sync Service
// Handles cloud persistence of user data

import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs,
  deleteDoc,
  writeBatch 
} from 'firebase/firestore';
import { db, isFirebaseConfigured as checkConfig } from './firebase';

// Global flag to disable sync if network is blocked (DNS/AdBlock)
let isOfflineMode = false;

export const isFirebaseConfigured = () => {
  if (isOfflineMode) return false;
  return checkConfig();
};

export const retryConnection = () => {
  console.log("🔄 User requested network retry...");
  isOfflineMode = false;
  return checkConfig();
};

const handleNetworkError = (error: any) => {
  const msg = error?.message || '';
  if (msg.includes('offline') || msg.includes('network') || msg.includes('Failed to fetch')) {
    if (!isOfflineMode) {
      console.warn("⚠️ Network/DNS Block detected. Switching to OFFLINE MODE.");
      isOfflineMode = true;
    }
  }
};



// Types matching the local DB schema
interface BatchData {
  batch_id: string;
  box_id: string;
  total_images: number;
  processed: number;
  failed: number;
  created_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface ItemData {
  id?: number;
  batch_id: string;
  filename: string;
  box_id: string;
  title: string;
  type: string;
  year: string;
  notes: string;
  confidence: string;
  processed_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  image_hash?: string;
  comps_quote?: string;
  condition_estimate?: string;
  raw_metadata?: Record<string, any>;
  developer_notes?: string;
  saved_comps?: string;
  // Note: image_data is NOT synced to cloud (too large)
}

interface InventoryData {
  id?: number;
  image_hash: string;
  title: string;
  type: string;
  year: string;
  notes: string;
  confidence: string;
  first_seen: string;
  last_seen: string;
  times_scanned: number;
  box_id: string;
  comps_quote?: string;
  condition_estimate?: string;
  raw_metadata?: Record<string, any>;
  // Note: thumbnail is NOT synced to cloud
}

export interface UserSettings {
  apiKeys: {
    openai?: string;
    gemini?: string;
    claude?: string;
  };
  lastBoxId?: string;
  theme?: 'light' | 'dark';
  dev_notes?: string;
}

// ========== SETTINGS (API KEYS) ==========

export async function saveUserSettings(userId: string, settings: UserSettings): Promise<void> {
  if (!isFirebaseConfigured() || !db) {
    console.warn('Firestore not available, skipping cloud sync');
    return;
  }

  try {
    const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
    await setDoc(settingsRef, {
      ...settings,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log('☁️ Settings synced to cloud');
  } catch (error) {
    console.error('Failed to save settings to Firestore:', error);
    throw error;
  }
}

export async function loadUserSettings(userId: string): Promise<UserSettings | null> {
  if (!isFirebaseConfigured() || !db) {
    return null;
  }

  try {
    const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
    const snapshot = await getDoc(settingsRef);
    
    if (snapshot.exists()) {
      console.log('☁️ Settings loaded from cloud');
      return snapshot.data() as UserSettings;
    }
    return null;
  } catch (error) {
    console.error('Failed to load settings from Firestore:', error);
    return null;
  }
}

// ========== BATCH SYNC ==========

export async function syncBatchToCloud(userId: string, batch: BatchData): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;

  try {
    const batchRef = doc(db, 'users', userId, 'batches', batch.batch_id);
    await setDoc(batchRef, {
      ...batch,
      syncedAt: new Date().toISOString()
    });
    console.log(`☁️ Batch ${batch.batch_id} synced`);
  } catch (error) {
    console.error('Failed to sync batch:', error);
    handleNetworkError(error);
  }
}

export async function loadBatchesFromCloud(userId: string): Promise<BatchData[]> {
  if (!isFirebaseConfigured() || !db) return [];

  try {
    const batchesRef = collection(db, 'users', userId, 'batches');
    const snapshot = await getDocs(batchesRef);
    return snapshot.docs.map(doc => doc.data() as BatchData);
  } catch (error) {
    console.error('Failed to load batches:', error);
    handleNetworkError(error);
    return [];
  }
}

export async function deleteBatchFromCloud(userId: string, batchId: string): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;

  try {
    const batchRef = doc(db, 'users', userId, 'batches', batchId);
    await deleteDoc(batchRef);
    
    // Also delete associated items
    const itemsRef = collection(db, 'users', userId, 'items');
    const snapshot = await getDocs(itemsRef);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach(docSnap => {
      const item = docSnap.data() as ItemData;
      if (item.batch_id === batchId) {
        batch.delete(docSnap.ref);
      }
    });
    
    await batch.commit();
    console.log(`☁️ Batch ${batchId} deleted from cloud`);
  } catch (error) {
    console.error('Failed to delete batch from cloud:', error);
  }
}

// ========== ITEM SYNC ==========

export async function syncItemToCloud(userId: string, item: ItemData): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;

  try {
    // Use a combination of batch_id and filename as document ID
    const itemId = `${item.batch_id}_${item.filename}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const itemRef = doc(db, 'users', userId, 'items', itemId);
    
    // Don't sync image_data to cloud (too large)
    let { image_data, ...itemWithoutImage } = item as any;
    
    // 🛡️ Data Bomb Defense: Check for Firestore 1MB limit
    let payload = {
      ...itemWithoutImage,
      syncedAt: new Date().toISOString()
    };
    
    const size = new Blob([JSON.stringify(payload)]).size;
    if (size > 950000) { // Safety margin (950KB)
        console.warn(`⚠️ Item ${item.filename} exceeds 1MB cloud limit (${Math.round(size/1024)}KB). Stripping metadata.`);
        // Strip metadata and potentially other large fields
        const { raw_metadata, saved_comps, ...stripped } = itemWithoutImage;
        payload = { ...stripped, syncedAt: new Date().toISOString(), notes: "Metadata stripped (too large)" };
    }

    await setDoc(itemRef, payload);
  } catch (error) {
    console.error('Failed to sync item:', error);
  }
}

export async function loadItemsFromCloud(userId: string, batchId: string): Promise<ItemData[]> {
  if (!isFirebaseConfigured() || !db) return [];

  try {
    const itemsRef = collection(db, 'users', userId, 'items');
    const snapshot = await getDocs(itemsRef);
    return snapshot.docs
      .map(doc => doc.data() as ItemData)
      .filter(item => item.batch_id === batchId);
  } catch (error) {
    console.error('Failed to load items:', error);
    return [];
  }
}

export async function deleteItemFromCloud(userId: string, batchId: string, filename: string): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;

  try {
    const itemId = `${batchId}_${filename}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const itemRef = doc(db, 'users', userId, 'items', itemId);
    await deleteDoc(itemRef);
    console.log(`☁️ Item ${filename} deleted from cloud`);
  } catch (error) {
    console.error('Failed to delete item from cloud:', error);
  }
}


// ========== INVENTORY SYNC ==========

export async function syncInventoryToCloud(userId: string, item: InventoryData): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;

  try {
    const invRef = doc(db, 'users', userId, 'inventory', item.image_hash);
    
    // We NOW sync thumbnails because they are small (<5KB) and critical for UX
    // const { thumbnail, ...itemWithoutThumb } = item as any;
    
    await setDoc(invRef, {
      ...item,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to sync inventory item:', error);
  }
}

export async function loadInventoryFromCloud(userId: string): Promise<InventoryData[]> {
  if (!isFirebaseConfigured() || !db) return [];

  try {
    const invRef = collection(db, 'users', userId, 'inventory');
    const snapshot = await getDocs(invRef);
    return snapshot.docs.map(doc => doc.data() as InventoryData);
  } catch (error) {
    console.error('Failed to load inventory:', error);
    return [];
  }
}

// ========== FULL SYNC UTILITIES ==========

export async function syncAllToCloud(
  userId: string, 
  batches: BatchData[], 
  items: ItemData[], 
  inventory: InventoryData[]
): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;

  console.log('☁️ Starting full cloud sync...');
  
  // Sync batches
  for (const batch of batches) {
    await syncBatchToCloud(userId, batch);
  }
  
  // Sync items (without image data)
  for (const item of items) {
    await syncItemToCloud(userId, item);
  }
  
  // Sync inventory (without thumbnails)
  for (const inv of inventory) {
    await syncInventoryToCloud(userId, inv);
  }
  
  console.log('☁️ Full sync complete');
}

export async function loadAllFromCloud(userId: string): Promise<{
  batches: BatchData[];
  inventory: InventoryData[];
}> {
  if (!isFirebaseConfigured() || !db) return { batches: [], inventory: [] };

  try {
    const batches = await loadBatchesFromCloud(userId);
    const inventory = await loadInventoryFromCloud(userId);
    return { batches, inventory };
  } catch (error) {
    console.error('Failed to load all from cloud:', error);
    return { batches: [], inventory: [] };
  }
}
