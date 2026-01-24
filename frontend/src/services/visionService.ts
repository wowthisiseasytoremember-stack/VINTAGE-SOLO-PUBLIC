// Vision Service for calling Firebase Cloud Function
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app, isFirebaseConfigured } from './firebase';
import { AIResult } from './aiService';

/**
 * Result from the Cloud Vision pass
 */
export interface VisionPassResult {
  isSufficient: boolean;
  data: AIResult;
  raw?: any;
}

/**
 * Call the Firebase Cloud Function to perform Vision API analysis
 */
export async function performVisionPass(base64Image: string): Promise<VisionPassResult | null> {
  if (!isFirebaseConfigured() || !app) {
    console.warn('Firebase not configured, skipping Vision pass');
    return null;
  }

  try {
    const functions = getFunctions(app);
    const identifyWithVision = httpsCallable(functions, 'identifyWithVision');
    
    console.log('📡 Calling Cloud Vision Pass (with 5s timeout)...');
    
    // Create a timeout promise
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Vision API timed out (DNS/Network Block)')), 5000)
    );

    // Race the function call against the timeout
    const result = await Promise.race([
      identifyWithVision({ base64Image }),
      timeout
    ]) as any;
    
    return result.data as VisionPassResult;
  } catch (error) {
    console.warn('Vision pass failed (possibly not deployed):', error);
    return null;
  }
}
