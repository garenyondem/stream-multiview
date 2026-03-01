import { deflate, inflate } from "pako";

export interface StreamData {
  videoIds: string[];
  colSizes: number[];
  rowSizes: number[];
  layout?: "grid" | "stage";
  stageIndex?: number;
}

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]+)/,
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]+)/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Compress stream data using zlib and encode as base64
 */
export function encodeStreamData(data: StreamData): string {
  const jsonString = JSON.stringify(data);
  const compressed = deflate(jsonString, { level: 9 });
  
  // Convert Uint8Array to binary string, then to base64
  const binaryString = Array.from(compressed)
    .map(byte => String.fromCharCode(byte))
    .join("");
  
  return btoa(binaryString)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Decode base64 and decompress using zlib
 */
export function decodeStreamData(encoded: string): StreamData | null {
  try {
    // Restore base64 padding and characters
    let base64 = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    
    // Add padding if needed
    while (base64.length % 4) {
      base64 += "=";
    }
    
    // Decode base64 to binary string
    const binaryString = atob(base64);
    
    // Convert binary string to Uint8Array
    const compressed = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      compressed[i] = binaryString.charCodeAt(i);
    }
    
    // Decompress
    const decompressed = inflate(compressed, { to: "string" });
    
    return JSON.parse(decompressed) as StreamData;
  } catch {
    return null;
  }
}
