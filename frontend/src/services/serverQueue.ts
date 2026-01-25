// Server-Side Processing Queue Service
// Uploads items to Firestore queue -> Cloud Function processes -> App polls results

import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  where,
  getDocs,
  Unsubscribe
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export interface QueueItem {
  id: string;
  batchId: string;
  filename: string;
  boxId: string;
  base64Image: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
}

export interface ProcessedResult {
  title: string;
  type: string;
  year: string;
  notes: string;
  confidence: string;
  raw_metadata?: any;
}

/**
 * Upload an item to the server-side processing queue
 * The Cloud Function will automatically pick it up
 */
export async function uploadToQueue(
  userId: string,
  batchId: string,
  filename: string,
  boxId: string,
  base64Image: string
): Promise<string> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase not configured');
  }

  const itemId = `${batchId}_${filename}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const queueRef = doc(db, 'users', userId, 'processingQueue', itemId);
  
  await setDoc(queueRef, {
    batchId,
    filename,
    boxId,
    base64Image,
    status: 'pending',
    createdAt: new Date().toISOString()
  });
  
  console.log(`📤 Uploaded ${filename} to server queue`);
  return itemId;
}

/**
 * Listen for a specific item's completion
 * Returns a promise that resolves when the item is processed
 */
export function waitForItem(
  userId: string, 
  itemId: string,
  timeoutMs: number = 60000
): Promise<ProcessedResult | null> {
  return new Promise((resolve, reject) => {
    if (!isFirebaseConfigured() || !db) {
      reject(new Error('Firebase not configured'));
      return;
    }

    const itemRef = doc(db, 'users', userId, 'processingQueue', itemId);
    let unsub: Unsubscribe;
    
    const timeout = setTimeout(() => {
      unsub?.();
      console.warn(`⏱️ Timeout waiting for ${itemId}`);
      resolve(null); // Return null on timeout, caller should fallback
    }, timeoutMs);
    
    unsub = onSnapshot(itemRef, (snap) => {
      const data = snap.data();
      if (!data) return;
      
      if (data.status === 'completed') {
        clearTimeout(timeout);
        unsub();
        console.log(`✅ Server processed ${itemId}`);
        resolve({
          title: data.result?.title || 'Unknown',
          type: data.result?.type || 'other',
          year: data.result?.year || '',
          notes: data.result?.notes || '',
          confidence: data.result?.confidence || '50%',
          raw_metadata: data.result?.raw_metadata
        });
      } else if (data.status === 'failed') {
        clearTimeout(timeout);
        unsub();
        console.warn(`❌ Server failed for ${itemId}: ${data.error}`);
        resolve(null); // Return null on failure, caller should fallback
      }
    }, (error) => {
      clearTimeout(timeout);
      console.error('Snapshot error:', error);
      resolve(null);
    });
  });
}

/**
 * Check if server-side processing is available
 * (User is logged in + Firebase configured)
 */
export function isServerProcessingAvailable(userId?: string): boolean {
  return !!(userId && isFirebaseConfigured() && db);
}

/**
 * Get pending items count for a batch
 */
export async function getPendingCount(userId: string, batchId: string): Promise<number> {
  if (!isFirebaseConfigured() || !db) return 0;
  
  const q = query(
    collection(db, 'users', userId, 'processingQueue'),
    where('batchId', '==', batchId),
    where('status', '==', 'pending')
  );
  
  const snap = await getDocs(q);
  return snap.size;
}
