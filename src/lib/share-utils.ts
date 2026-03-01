import { deflate, inflate } from "pako";

export interface StreamData {
  videoIds: string[];
  colSizes: number[];
  rowSizes: number[];
  layout?: "grid" | "stage";
  stageIndex?: number;
}

// Base91 character set - 91 URL-safe characters
// Excludes: ' " \ space < > { } | \ ` ^ and control chars
const BASE91_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  "0123456789" +
  "!#$%&()*+,-.:;<=>?@[]^_~";

const BASE91_LEN = 91;

/**
 * Encode bytes to base91 string
 */
function encodeBase91(bytes: Uint8Array): string {
  let result = "";
  let b = 0;
  let n = 0;

  for (let i = 0; i < bytes.length; i++) {
    b |= bytes[i] << n;
    n += 8;

    if (n > 13) {
      let v = b & 8191;
      if (v > 88) {
        b >>= 13;
        n -= 13;
      } else {
        v = b & 16383;
        b >>= 14;
        n -= 14;
      }
      result += BASE91_CHARS[v % BASE91_LEN];
      result += BASE91_CHARS[(v / BASE91_LEN) | 0];
    }
  }

  if (n > 0) {
    result += BASE91_CHARS[b % BASE91_LEN];
    if (n > 7 || b > 90) {
      result += BASE91_CHARS[(b / BASE91_LEN) | 0];
    }
  }

  return result;
}

/**
 * Decode base91 string to bytes
 */
function decodeBase91(str: string): Uint8Array | null {
  try {
    const bytes: number[] = [];
    let b = 0;
    let n = 0;
    let v = -1;

    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      const index = BASE91_CHARS.indexOf(c);

      if (index === -1) {
        return null; // Invalid character
      }

      if (v < 0) {
        v = index;
      } else {
        v += index * BASE91_LEN;
        b |= v << n;
        n += (v & 8191) > 88 ? 13 : 14;

        while (n > 7) {
          bytes.push(b & 255);
          b >>= 8;
          n -= 8;
        }

        v = -1;
      }
    }

    if (v >= 0) {
      bytes.push((b | (v << n)) & 255);
    }

    return new Uint8Array(bytes);
  } catch {
    return null;
  }
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
 * Compress stream data using zlib and encode as base91
 */
export function encodeStreamData(data: StreamData): string {
  // Sanitize data to remove undefined values and ensure proper array lengths
  const sanitized: StreamData = {
    videoIds: data.videoIds.filter((id): id is string => id !== undefined && id !== null),
    colSizes: (data.colSizes || []).filter((s): s is number => s !== undefined && !isNaN(s)),
    rowSizes: (data.rowSizes || []).filter((s): s is number => s !== undefined && !isNaN(s)),
    layout: data.layout ?? "grid",
    stageIndex: data.stageIndex ?? 0,
  };
  const jsonString = JSON.stringify(sanitized);
  const compressed = deflate(jsonString, { level: 9 });
  return encodeBase91(compressed);
}

/**
 * Decode base91 and decompress using zlib
 */
export function decodeStreamData(encoded: string): StreamData | null {
  try {
    const compressed = decodeBase91(encoded);
    if (!compressed) return null;

    const decompressed = inflate(compressed, { to: "string" });
    return JSON.parse(decompressed) as StreamData;
  } catch {
    return null;
  }
}
