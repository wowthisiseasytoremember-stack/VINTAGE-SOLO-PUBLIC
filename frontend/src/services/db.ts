import { openDB, DBSchema, IDBPDatabase, deleteDB } from 'idb';

// Types for inventory
export interface InventoryItem {
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
  thumbnail?: string; // Small base64 for display
  box_id: string;
}

interface VintageDB extends DBSchema {
  batches: {
    key: string; // batch_id
    value: {
      batch_id: string;
      box_id: string;
      total_images: number;
      processed: number;
      failed: number;
      created_at: string;
      status: 'pending' | 'processing' | 'completed' | 'failed';
    };
    indexes: { 'by-date': string };
  };
  items: {
    key: number; // auto-increment
    value: {
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
      image_data: Blob | string;
      status: 'pending' | 'processing' | 'completed' | 'failed';
      image_hash?: string; // Link to inventory
    };
    indexes: { 'by-batch': string; 'by-hash': string };
  };
  inventory: {
    key: number;
    value: InventoryItem;
    indexes: { 'by-hash': string };
  };
}

let dbPromise: Promise<IDBPDatabase<VintageDB>>;

export const initDB = async (retryCount = 0) => {
  try {
    dbPromise = openDB<VintageDB>('vintage-cataloger-db', 3, {
      upgrade(db, oldVersion, newVersion, tx) {
        try {
          console.log(`DB Upgrade: v${oldVersion} -> v${newVersion}`);
          
          if (oldVersion < 1) {
            const batchStore = db.createObjectStore('batches', { keyPath: 'batch_id' });
            batchStore.createIndex('by-date', 'created_at');

            const itemStore = db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
            itemStore.createIndex('by-batch', 'batch_id');
          }
          
          if (oldVersion < 2) {
            // Check if store exists to be safe
            if (!db.objectStoreNames.contains('inventory')) {
              const inventoryStore = db.createObjectStore('inventory', { keyPath: 'id', autoIncrement: true });
              inventoryStore.createIndex('by-hash', 'image_hash', { unique: true });
            }
          }

          // Version 3: image_hash index on items
          if (oldVersion < 3) {
            const itemStore = tx.objectStore('items');
            if (!itemStore.indexNames.contains('by-hash')) {
              itemStore.createIndex('by-hash', 'image_hash');
            }
          }
        } catch (err) {
          console.error("Critical Schema Upgrade Error:", err);
          throw err; // Abort transaction to trigger recovery
        }
      },
      blocked() {
        console.warn("DB Upgrade Blocked: Close other tabs!");
      },
      blocking() {
        console.warn("DB Blocking: Reloading...");
        dbPromise.then(db => db.close());
      },
      terminated() {
        console.error("DB Terminated unexpectedly");
      }
    });

    await dbPromise;
    console.log("✅ Database initialized successfully");

  } catch (error) {
    console.error("❌ DB Init Failed:", error);
    
    // Auto-Recovery: If upgrade failed, delete and restart
    if (retryCount < 2) {
      console.warn("⚠️ Attempting DB Self-Healing (Nuke & Pave)...");
      try {
        await deleteDB('vintage-cataloger-db');
      } catch (e) {
        console.error("Failed to delete DB:", e);
      }
      await new Promise(r => setTimeout(r, 500));
      return initDB(retryCount + 1);
    }
  }
};

// ========== BATCH OPERATIONS ==========
export const saveBatch = async (batch: VintageDB['batches']['value']) => {
  const db = await dbPromise;
  await db.put('batches', batch);
};

export const getBatches = async (limit = 50) => {
  const db = await dbPromise;
  // Get latest batches (descending date)
  // IndexedDB indexes are ascending. To get latest, we need to reverse.
  // Efficient way: use openCursor with 'prev' direction.
  const tx = db.transaction('batches', 'readonly');
  const index = tx.objectStore('batches').index('by-date');
  let cursor = await index.openCursor(null, 'prev');
  
  const results = [];
  while (cursor && results.length < limit) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }
  return results;
};

export const deleteBatch = async (batchId: string) => {
  const db = await dbPromise;
  await db.delete('batches', batchId);
  const items = await getBatchItems(batchId);
  for (const item of items) {
    if (item.id) await db.delete('items', item.id);
  }
};

export const getIncompleteBatches = async () => {
  const db = await dbPromise;
  const allBatches = await db.getAll('batches');
  return allBatches.filter(b => b.status === 'processing');
};

// ========== ITEM OPERATIONS ==========
export const saveItem = async (item: VintageDB['items']['value']) => {
  const db = await dbPromise;
  return await db.add('items', item);
};

export const updateItem = async (id: number, updates: Partial<VintageDB['items']['value']>) => {
  const db = await dbPromise;
  const item = await db.get('items', id);
  if (item) {
    await db.put('items', { ...item, ...updates });
  }
};

export const deleteItem = async (id: number) => {
  const db = await dbPromise;
  await db.delete('items', id);
};

export const getBatchItems = async (batchId: string) => {
  const db = await dbPromise;
  return await db.getAllFromIndex('items', 'by-batch', batchId);
};

export const getLatestItemByHash = async (hash: string) => {
  const db = await dbPromise;
  const items = await db.getAllFromIndex('items', 'by-hash', hash);
  if (items.length === 0) return null;
  // Sort by processed_at descending
  return items.sort((a, b) => new Date(b.processed_at).getTime() - new Date(a.processed_at).getTime())[0];
};

// ========== INVENTORY OPERATIONS ==========
export const addToInventory = async (item: Omit<InventoryItem, 'id'>) => {
  const db = await dbPromise;
  return await db.add('inventory', item as InventoryItem);
};

export const updateInventoryItem = async (id: number, updates: Partial<InventoryItem>) => {
  const db = await dbPromise;
  const item = await db.get('inventory', id);
  if (item) {
    await db.put('inventory', { ...item, ...updates });
  }
};

export const findByImageHash = async (hash: string): Promise<InventoryItem | undefined> => {
  const db = await dbPromise;
  return await db.getFromIndex('inventory', 'by-hash', hash);
};

export const getAllInventory = async (limit = 50, lastKey?: number): Promise<InventoryItem[]> => {
  const db = await dbPromise;
  const range = lastKey ? IDBKeyRange.lowerBound(lastKey, true) : null;
  // Get items by key (insertion order)
  return await db.getAll('inventory', range, limit);
};

export const getInventoryCount = async (): Promise<number> => {
  const db = await dbPromise;
  return await db.count('inventory');
};

export const deleteInventoryItem = async (id: number) => {
  const db = await dbPromise;
  await db.delete('inventory', id);
};
