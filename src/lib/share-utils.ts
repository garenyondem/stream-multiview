import { deflate, inflate } from "pako";

export interface StreamData {
  videoIds: string[];
  colSizes: number[];
  rowSizes: number[];
  layout: "grid" | "stage";
  stageIndex: number;
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
 * Returns empty string if no valid ID found (never null)
 */
export function extractVideoId(url: string): string {
  if (!url || typeof url !== "string") return "";
  
  const patterns = [
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]+)/,
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]+)/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return "";
}

/**
 * Compress stream data using zlib and encode as base91
 */
export function encodeStreamData(data: StreamData): string {
  // Ensure all values have defaults - never undefined
  const safeVideoIds = Array.isArray(data.videoIds) ? data.videoIds : [];
  const safeColSizes = Array.isArray(data.colSizes) ? data.colSizes : [];
  const safeRowSizes = Array.isArray(data.rowSizes) ? data.rowSizes : [];
  const safeLayout = data.layout === "stage" ? "stage" : "grid";
  const safeStageIndex = typeof data.stageIndex === "number" && !isNaN(data.stageIndex)
    ? Math.max(0, data.stageIndex)
    : 0;
  
  // Sanitize arrays to remove invalid values
  const sanitized: StreamData = {
    videoIds: safeVideoIds.filter((id): id is string =>
      typeof id === "string" && id.length > 0
    ),
    colSizes: safeColSizes.filter((s): s is number =>
      typeof s === "number" && !isNaN(s) && s > 0
    ),
    rowSizes: safeRowSizes.filter((s): s is number =>
      typeof s === "number" && !isNaN(s) && s > 0
    ),
    layout: safeLayout,
    stageIndex: safeStageIndex,
  };
  
  const jsonString = JSON.stringify(sanitized);
  const compressed = deflate(jsonString, { level: 9 });
  return encodeBase91(compressed);
}

/**
 * Decode base91 and decompress using zlib
 * Always returns a valid StreamData with defaults, never null
 */
export function decodeStreamData(encoded: string): StreamData {
  const defaultData: StreamData = {
    videoIds: [],
    colSizes: [],
    rowSizes: [],
    layout: "grid",
    stageIndex: 0,
  };
  
  try {
    if (!encoded || typeof encoded !== "string") return defaultData;
    
    const compressed = decodeBase91(encoded);
    if (!compressed) return defaultData;

    const decompressed = inflate(compressed, { to: "string" });
    const parsed = JSON.parse(decompressed);
    
    // Ensure all fields have valid defaults
    return {
      videoIds: Array.isArray(parsed.videoIds)
        ? parsed.videoIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
        : [],
      colSizes: Array.isArray(parsed.colSizes)
        ? parsed.colSizes.filter((s: unknown): s is number => typeof s === "number" && !isNaN(s) && s > 0)
        : [],
      rowSizes: Array.isArray(parsed.rowSizes)
        ? parsed.rowSizes.filter((s: unknown): s is number => typeof s === "number" && !isNaN(s) && s > 0)
        : [],
      layout: parsed.layout === "stage" ? "stage" : "grid",
      stageIndex: typeof parsed.stageIndex === "number" && !isNaN(parsed.stageIndex)
        ? Math.max(0, parsed.stageIndex)
        : 0,
    };
  } catch {
    return defaultData;
  }
}
