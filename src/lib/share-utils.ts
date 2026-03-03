import { deflate, inflate } from "pako";

export interface StreamData {
  videoIds: string[];
  colSizes: number[];
  rowSizes: number[];
  layout: "grid" | "stage";
  stageIndex: number;
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
 * Compress stream data using zlib and encode as base64
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

  // Convert Uint8Array to base64 string
  const binary = Array.from(compressed)
    .map((b) => String.fromCharCode(b))
    .join("");
  const base64 = btoa(binary);

  // Convert to URL-safe base64 (replace + with -, / with _, remove = padding)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decode base64 and decompress using zlib
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

    // Convert URL-safe base64 back to standard base64
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }

    // Decode base64 to binary string, then to Uint8Array
    const binary = atob(base64);
    const compressed = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      compressed[i] = binary.charCodeAt(i);
    }

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
