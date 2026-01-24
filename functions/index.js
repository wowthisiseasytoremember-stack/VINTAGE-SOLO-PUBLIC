const functions = require('firebase-functions');
const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');

admin.initializeApp();

const client = new vision.ImageAnnotatorClient();

/**
 * Identify ephemera using Google Cloud Vision API
 * This acts as a cost-effective "first pass" before falling back to LLMs
 */
exports.identifyWithVision = functions.https.onCall(async (data, context) => {
  // 1. Authentication Check
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 
      'The function must be called while authenticated.'
    );
  }

  const { base64Image } = data;
  if (!base64Image) {
    throw new functions.https.HttpsError(
      'invalid-argument', 
      'The function must be called with a "base64Image".'
    );
  }

  try {
    console.log(`Starting Vision API analysis for user: ${context.auth.uid}`);

    // 2. Call Google Cloud Vision API
    // We use both Text Detection (for OCR) and Label Detection (for category)
    const [result] = await client.annotateImage({
      image: { content: base64Image },
      features: [
        { type: 'TEXT_DETECTION' },
        { type: 'LABEL_DETECTION' }
      ]
    });

    const fullText = result.fullTextAnnotation ? result.fullTextAnnotation.text : '';
    const labels = result.labelAnnotations || [];

    // 3. Logic: Determine if we have "Sufficient" data
    // We look for coherent text or high-confidence labels
    const isSufficient = (fullText.length > 50) || (labels.some(l => l.score > 0.9 && (l.description === 'Postcard' || l.description === 'Photograph')));

    // 4. Format response
    // We try to map Vision results to our AIResult structure
    return {
      success: true,
      isSufficient,
      data: {
        title: extractTitleFromText(fullText) || (labels.length > 0 ? labels[0].description : 'Unknown Item'),
        type: mapLabelsToType(labels),
        year: extractYearFromText(fullText) || '',
        notes: `Vision OCR: ${fullText.substring(0, 100)}...`,
        confidence: `${Math.round((labels[0]?.score || 0.5) * 100)}%`
      },
      raw: {
        text: fullText,
        labels: labels.map(l => ({ description: l.description, score: l.score }))
      }
    };

  } catch (error) {
    console.error('Vision API Error:', error);
    throw new functions.https.HttpsError('internal', 'Vision API failed', error.message);
  }
});

// Helper: Extract a brief title from OCR text (first line or first few words)
function extractTitleFromText(text) {
  if (!text) return null;
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return null;
  return lines[0].substring(0, 50);
}

// Helper: Map Vision labels to our app's specific types
function mapLabelsToType(labels) {
  const labelNames = labels.map(l => l.description.toLowerCase());
  if (labelNames.includes('postcard')) return 'postcard';
  if (labelNames.includes('photograph') || labelNames.includes('snapshot')) return 'photo';
  if (labelNames.includes('book') || labelNames.includes('publication')) return 'book';
  if (labelNames.includes('document')) return 'document';
  return 'other';
}

// Helper: Attempt to find a year in the OCR text
function extractYearFromText(text) {
  const yearMatch = text.match(/\b(18|19|20)\d{2}\b/);
  return yearMatch ? yearMatch[0] : null;
}
