import { performVisionPass } from './visionService';

export interface AIResult {
  title: string;
  type: string;
  year: string;
  notes: string;
  confidence: string;
}

export type AIProvider = 'openai' | 'gemini' | 'claude';

export interface AIKeys {
  openai?: string;
  gemini?: string;
  claude?: string;
}

const PROMPT = `Identify this vintage object. Return ONLY a JSON object with: 
"title" (brief name), 
"type" (document, photo, postcard, book, other), 
"year" (estimate if not clear, e.g. "c. 1920s"), 
"notes" (1-2 sentences context),
"confidence" (percentage 0-100%).
Be accurate as a cataloging expert.`;

export async function analyzeImage(
  base64Image: string,
  keys: AIKeys,
  priority: AIProvider[] = ['gemini', 'openai', 'claude']
): Promise<AIResult> {
  let lastError: any = null;

  // 1. VISION API FIRST PASS ("Sit on Top" Strategy)
  try {
    const visionResult = await performVisionPass(base64Image);
    if (visionResult && visionResult.isSufficient) {
      console.log('✅ Vision API pass was sufficient, skipping LLMs.');
      return visionResult.data;
    } else if (visionResult) {
      console.log('ℹ️ Vision API data insufficient, falling back to LLMs...');
    }
  } catch (err) {
    console.warn('Vision pass error (falling back):', err);
  }

  // 2. LLM FALLBACK LOGIC
  // Debug: log which keys are available
  console.log('Available AI keys:', {
    gemini: keys.gemini ? '✓ Set' : '✗ Missing',
    openai: keys.openai ? '✓ Set' : '✗ Missing',
    claude: keys.claude ? '✓ Set' : '✗ Missing'
  });

  for (const provider of priority) {
    const key = keys[provider];
    if (!key) {
      console.log(`Skipping ${provider} - no key configured`);
      continue;
    }

    try {
      console.log(`Attempting analysis with ${provider.toUpperCase()}...`);
      let result;
      switch (provider) {
        case 'openai':
          result = await callOpenAI(base64Image, key);
          break;
        case 'gemini':
          result = await callGemini(base64Image, key);
          break;
        case 'claude':
          result = await callClaude(base64Image, key);
          break;
      }
      if (result) {
        console.log(`${provider.toUpperCase()} succeeded!`);
        return result;
      }
    } catch (err) {
      console.warn(`${provider} failed:`, err);
      lastError = err;
      // Continue to next provider
    }
  }

  // LAST RESORT: Return a "basic" result so the user can still edit/save
  console.error("All AI providers failed. Falling back to Manual Entry.", lastError);
  return {
    title: "Manual Entry Required",
    type: "other",
    year: "Unknown",
    notes: "AI analysis was unavailable (check keys/connectivity). Please edit this item.",
    confidence: "0%"
  };
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
  return JSON.parse(data.choices[0].message.content);
}

async function callGemini(base64Content: string, apiKey: string): Promise<AIResult> {
  // Try multiple Gemini models in case one is unavailable
  const models = [
    'gemini-1.5-flash',
    'gemini-1.5-pro', 
    'gemini-pro-vision',
    'gemini-pro'
  ];
  
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
      return JSON.parse(text);
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
  return JSON.parse(text);
}
