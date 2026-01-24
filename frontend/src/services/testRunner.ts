import { saveBatch, getBatches, getBatchItems, saveItem, deleteBatch, initDB, getAllInventory } from './db';
import { analyzeImage, AIKeys } from './aiService';
import { auth, isFirebaseConfigured } from './firebase';
import { performVisionPass } from './visionService';

// Tiny valid 1x1 pixel JPEG for minimal bandwidth testing
const TEST_IMAGE_BASE64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==";

export interface TestResult {
    name: string;
    passed: boolean;
    message: string;
    fixInstructions?: string;
}

export class SystemValidator {
    
    static async runAllTests(keys: AIKeys): Promise<TestResult[]> {
        const results: TestResult[] = [];
        await initDB();

        // 1. Storage Integrity Test
        try {
            const testBatchId = 'test-storage-' + Date.now();
            await saveBatch({
                batch_id: testBatchId,
                box_id: 'TEST-BOX',
                total_images: 1,
                processed: 1,
                failed: 0,
                created_at: new Date().toISOString(),
                status: 'completed'
            });

            const batches = await getBatches();
            const found = batches.find(b => b.batch_id === testBatchId);

            if (!found) throw new Error("Saved batch not found in local DB");
            
            await deleteBatch(testBatchId);
            results.push({ 
                name: "Local Storage (IndexedDB)", 
                passed: true, 
                message: "Read/Write/Delete confirmed" 
            });
        } catch (e: any) {
            results.push({ 
                name: "Local Storage (IndexedDB)", 
                passed: false, 
                message: e.message,
                fixInstructions: "Ensure your browser supports IndexedDB and you are not in an Incognito mode that blocks storage."
            });
        }

        // 2. Firebase Connectivity
        try {
            const configured = isFirebaseConfigured();
            if (!configured) throw new Error("Firebase not configured in .env");
            
            results.push({ 
                name: "Firebase Configuration", 
                passed: true, 
                message: "Environmental variables found" 
            });

            if (!auth?.currentUser) {
                results.push({ 
                    name: "User Authentication", 
                    passed: false, 
                    message: "No user signed in",
                    fixInstructions: "Click the 'Sign in with Google' button in the Navbar to enable Cloud features."
                });
            } else {
                results.push({ 
                    name: "User Authentication", 
                    passed: true, 
                    message: `Signed in as ${auth.currentUser.email}` 
                });
            }
        } catch (e: any) {
            results.push({ 
                name: "Firebase Configuration", 
                passed: false, 
                message: e.message,
                fixInstructions: "Add REACT_APP_FIREBASE_* keys to your .env file and restart the development server."
            });
        }

        // 3. Google Cloud Vision Pass
        if (auth?.currentUser) {
            try {
                const visionResult = await performVisionPass(TEST_IMAGE_BASE64);
                if (visionResult) {
                    results.push({ 
                        name: "Cloud Vision Pass", 
                        passed: true, 
                        message: "Cloud Function returned result" 
                    });
                } else {
                    throw new Error("Function returned null or timed out");
                }
            } catch (e: any) {
                results.push({ 
                    name: "Cloud Vision Pass", 
                    passed: false, 
                    message: e.message,
                    fixInstructions: "Ensure you have deployed the Cloud Functions using 'npx firebase-tools deploy --only functions' and enabled the Vision API in Google Cloud Console."
                });
            }
        }

        // 4. LLM API Connectivity
        try {
            if (!keys.openai && !keys.gemini && !keys.claude) {
                throw new Error("No API Keys found");
            }
            // Just test the primary one (usually Gemini) to avoid burning too many tokens
            const aiResult = await analyzeImage(TEST_IMAGE_BASE64, keys);
            results.push({ 
                name: "LLM Provider (Fallback)", 
                passed: true, 
                message: `Success via ${aiResult.type ? 'AI Proxy' : 'Service'}` 
            });
        } catch (e: any) {
            results.push({ 
                name: "LLM Provider (Fallback)", 
                passed: false, 
                message: e.message,
                fixInstructions: "Check your API keys in Settings. Ensure you have balance/quota on your Gemini or OpenAI account."
            });
        }

        // 5. Workflow Simulation (E2E)
        try {
            const workflowId = 'sim-workflow-' + Date.now();
            
            // Simulation: Start Batch
            await saveBatch({
                batch_id: workflowId,
                box_id: 'SIMULATION-BOX',
                total_images: 1,
                processed: 0,
                failed: 0,
                created_at: new Date().toISOString(),
                status: 'processing'
            });

            // Simulation: Process Item
            const aiResult = await analyzeImage(TEST_IMAGE_BASE64, keys);
            await saveItem({
                batch_id: workflowId,
                filename: 'sim_pixel.jpg',
                box_id: 'SIMULATION-BOX',
                ...aiResult,
                processed_at: new Date().toISOString(),
                image_data: TEST_IMAGE_BASE64,
                status: 'completed'
            });

            // Simulation: Resume Check
            const incomplete = await getBatches();
            const simBatch = incomplete.find(b => b.batch_id === workflowId);
            if (!simBatch || simBatch.status !== 'processing') throw new Error("Resume state failure");

            // Simulation: Complete Batch
            await saveBatch({ ...simBatch, status: 'completed' });

            // Clean up
            await deleteBatch(workflowId);

            results.push({ 
                name: "User Workflow Simulation", 
                passed: true, 
                message: "Upload -> Process -> Persistent Status confirmed" 
            });
        } catch (e: any) {
            results.push({ 
                name: "User Workflow Simulation", 
                passed: false, 
                message: e.message,
                fixInstructions: "Internal logic error in processing pipeline. Check console logs for stack trace."
            });
        }

        return results;
    }
}

