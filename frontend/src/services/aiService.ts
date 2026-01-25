import { performVisionPass } from './visionService';

export interface AIResult {
  title: string;
  type: string;
  year: string;
  notes: string;
  confidence: string;
  condition_estimate?: string;
  raw_metadata?: Record<string, any>;
}

export type AIProvider = 'openai' | 'gemini' | 'claude';

export interface AIKeys {
  openai?: string;
  gemini?: string;
  claude?: string;
}

const PROMPT = `Identify this vintage object. Return ONLY a JSON object with: 
"title" (brief name), 
"type" (document, photo, postcard, book, toy, card, etc.), 
"year" (estimate, e.g. "c. 1920s"), 
"notes" (1-2 sentences context),
"confidence" (percentage 0-100%),
"condition_estimate" (brief mention of visible wear),
"raw_metadata" (an object with extra context like publisher, material, dimensions estimate, or specific markings if visible).
Be accurate as a cataloging expert. Provide deep context in raw_metadata if possible.`;

export async function analyzeImage(
  base64Image: string,
  keys: AIKeys,
  priority: AIProvider[] = ['gemini', 'openai', 'claude']
): Promise<AIResult> {
  if (!base64Image || base64Image.length < 50) {
    throw new Error("No image data provided for analysis");
  }

  let lastError: any = null;

  // 1. LLM FIRST STRATEGY (User Requirement: Google Cloud Vision is too slow/blocking)
  // We skip the explicit Vision API pass and go straight to the priority loop.


  // 2. LLM FALLBACK LOGIC
  // Debug: log which keys are available
  console.log('Available AI keys:', {
    gemini: keys.gemini ? '✓ Set' : '✗ Missing',
    openai: keys.openai ? '✓ Set' : '✗ Missing',
    claude: keys.claude ? '✓ Set' : '✗ Missing'
  });

  for (const provider of priority) {
    let key = keys[provider];
    if (!key) {
      console.log(`Skipping ${provider} - no key configured`);
      continue;
    }
    key = key.trim(); // 🟢 Fix for "Sticky Fingers" (Whitespace in Key)

    try {
      console.log(`Attempting analysis with ${provider.toUpperCase()}...`);
      // Resize image before sending to AI (reduces upload size, speeds up requests)
      const resizedImage = await resizeImageForAI(base64Image);
      let result;
      switch (provider) {
        case 'openai':
          result = await callOpenAI(resizedImage, key);
          break;
        case 'gemini':
          result = await callGemini(resizedImage, key);
          break;
        case 'claude':
          result = await callClaude(resizedImage, key);
          break;
      }
      if (result) {
        console.log(`${provider.toUpperCase()} succeeded!`);
        return result;
      }
    } catch (err) {
      console.warn(`${provider} failed, trying next...`, err);
      lastError = err;
      // Continue to next provider
    }
  }

  // LAST RESORT: Return a "basic" result so the user can still edit/save
  console.error("All AI providers failed. Falling back to Local Heuristics (Zero-Timeout).", lastError);
  return generateLocalFallback(base64Image, lastError);
}

function generateLocalFallback(base64Image: string, error: any): AIResult {
  const sizeKB = Math.round(base64Image.length / 1024);
  const timestamp = new Date().toLocaleTimeString();
  
  return {
    title: `Unidentified Item (${timestamp})`,
    type: "unknown",
    year: "Unknown",
    notes: `AI Analysis unavailable. Item captured at ${timestamp}. Size: ~${sizeKB}KB. Error: ${error?.message || 'Timeout/Network'}`,
    confidence: "10%", // Low confidence to indicate fallback
    condition_estimate: "Not assessed",
    raw_metadata: {
        fallback_mode: true,
        error_details: error?.message,
        capture_time: new Date().toISOString()
    }
  };

}

// Resize image to reduce upload size (AI doesn't need HD)
async function resizeImageForAI(base64Image: string, maxDimension = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Calculate new dimensions
      let width = img.width;
      let height = img.height;
      if (width > height && width > maxDimension) {
        height = (height / width) * maxDimension;
        width = maxDimension;
      } else if (height > maxDimension) {
        width = (width / height) * maxDimension;
        height = maxDimension;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Get resized base64 (without data URL prefix)
      const resized = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      console.log(`Image resized: ${img.width}x${img.height} → ${Math.round(width)}x${Math.round(height)}`);
      resolve(resized);
    };
    // 🛡️ Trojan Horse Defense: Fail fast if it's not a valid image
    img.onerror = () => {
        console.warn("Image load failed - possibly corrupted or not an image file.");
        reject(new Error("Invalid image data"));
    };
    img.src = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
  });
}

// Helper for Network Resilience
async function fetchWithTimeout(resource: RequestInfo, options: RequestInit = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Network timeout: The request took too long. Check your internet connection or DNS settings.');
    }
    throw error;
  }
}

async function callOpenAI(base64Content: string, apiKey: string): Promise<AIResult> {
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Content}` } }
          ]
        }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('OpenAI Error Details:', errorBody);
    throw new Error(`OpenAI error: ${response.status} ${response.statusText} - ${errorBody}`);
  }
  const data = await response.json();
  return cleanAIResponse(data.choices[0].message.content);
}

async function callGemini(base64Content: string, apiKey: string): Promise<AIResult> {
  // First, discover available models
  let models: string[] = [];
  try {
    console.log('Discovering available Gemini models...');
    const listResponse = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET' }
    );
    if (listResponse.ok) {
      const listData = await listResponse.json();
      // Filter for models that support generateContent and preferably vision
      models = (listData.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', ''));
      console.log('Available Gemini models:', models);
    }
  } catch (err) {
    console.warn('Failed to list models, using fallback:', err);
  }
  
  // Fallback to known models if discovery failed
  if (models.length === 0) {
    models = [
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro-vision'
    ];
  }
  
  for (const model of models) {
    try {
      console.log(`Trying Gemini model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: "image/jpeg", data: base64Content } }
            ]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Gemini ${model} returned ${response.status}: ${errorText.substring(0, 100)}`);
        continue; // Try next model
      }
      
      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      console.log(`Gemini ${model} succeeded!`);
      return cleanAIResponse(text);
    } catch (err) {
      console.warn(`Gemini ${model} failed:`, err);
      // Continue to next model
    }
  }
  
  throw new Error('All Gemini models failed');
}

async function callClaude(base64Content: string, apiKey: string): Promise<AIResult> {
  // Claude usually requires a proxy due to strict CORS. 
  // We'll try direct but warn that it might need a bridge.
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true' // Some SDKs/Wrappers look for this
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Content } }
        ]
      }]
    })
  });

  if (!response.ok) throw new Error(`Claude error: ${response.statusText}`);
  const data = await response.json();
  // Claude returns content as an array of parts
  const text = data.content[0].text;
  return cleanAIResponse(text);
}

// Robust JSON Cleaner for AI responses
function cleanAIResponse(text: string): any {
  try {
    // 1. Strip Markdown code blocks
    let clean = text.replace(/```json\n?/g, '').replace(/```/g, '');
    
    // 2. Trim whitespace
    clean = clean.trim();
    
    // 3. Attempt parse
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON Parse Failed on:", text);
    // Attempt relaxed parsing or partial recovery? 
    // For now, simpler is better. If it fails, it fails, but we handled the markdown case.
    throw new Error("Failed to parse AI JSON response");
  }
}
