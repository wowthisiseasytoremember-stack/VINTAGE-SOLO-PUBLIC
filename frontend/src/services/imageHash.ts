/**
 * Simple perceptual hash for image deduplication
 * Uses a simplified average hash algorithm
 */

/**
 * Compute a simple hash of an image for duplicate detection
 * This creates a thumbnail and computes a perceptual hash
 */
export async function computeImageHash(base64Image: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Create small canvas for hashing (8x8)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = 8;
      canvas.height = 8;
      
      // Draw scaled image
      ctx.drawImage(img, 0, 0, 8, 8);
      
      // Get pixel data
      const imageData = ctx.getImageData(0, 0, 8, 8);
      const pixels = imageData.data;
      
      // Convert to grayscale values
      const grays: number[] = [];
      for (let i = 0; i < pixels.length; i += 4) {
        const gray = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
        grays.push(gray);
      }
      
      // Compute average
      const avg = grays.reduce((a, b) => a + b, 0) / grays.length;
      
      // Generate hash: 1 if above average, 0 if below
      let hash = '';
      for (const gray of grays) {
        hash += gray >= avg ? '1' : '0';
      }
      
      // Convert binary string to hex safely in 32-bit chunks to avoid precision issues
      const part1 = parseInt(hash.substring(0, 32), 2).toString(16).padStart(8, '0');
      const part2 = parseInt(hash.substring(32, 64), 2).toString(16).padStart(8, '0');
      resolve(part1 + part2);
    };
    
    img.onerror = () => {
      // Fallback: use simple string hash of first 1000 chars
      const simpleHash = base64Image.substring(0, 1000)
        .split('')
        .reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
        .toString(16);
      resolve(simpleHash);
    };
    
    img.src = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
  });
}

/**
 * Generate a valid thumbnail Data URL for an image
 */
export async function generateThumbnail(base64Image: string, size = 150): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Maintain aspect ratio
      const scale = size / Math.max(img.width, img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7)); // 70% quality jpeg
    };
    img.onerror = () => resolve('');
    img.src = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
  });
}


/**
 * Compare two hashes and return similarity (0-1)
 * 1 = identical, 0 = completely different
 */
export function hashSimilarity(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 0;
  
  let matches = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) matches++;
  }
  
  return matches / hash1.length;
}

/**
 * Check if two hashes are similar enough to be considered duplicates
 */
export function isDuplicate(hash1: string, hash2: string, threshold = 0.9): boolean {
  return hashSimilarity(hash1, hash2) >= threshold;
}
