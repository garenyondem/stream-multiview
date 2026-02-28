"use client";

import { useStreams } from "@/lib/stream-context";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useCallback, useMemo } from "react";

// Hook to track mounted state without causing cascading renders
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export default function Viewer() {
  const { streamCount, streamUrls, setStreamUrls } = useStreams();
  const router = useRouter();
  const mounted = useMounted();
  const gridRef = useRef<HTMLDivElement>(null);

  // Redirect if no streams configured
  useEffect(() => {
    if (mounted && streamUrls.every((url) => url === "")) {
      router.push("/");
    }
  }, [mounted, streamUrls, router]);

  // Calculate grid layout based on number of active streams
  const activeUrls = streamUrls.filter((url) => url.trim() !== "");
  const activeCount = activeUrls.length || streamCount;

  // Calculate optimal grid dimensions based on count
  const getGridDimensions = (count: number): { cols: number; rows: number } => {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    return { cols: 4, rows: 3 }; // Up to 12
  };

  const { cols, rows } = getGridDimensions(activeCount);

  // State for custom column and row sizes (in fractions)
  // We store the sizes independently and pad with 1s when needed
  const [colSizes, setColSizes] = useState<number[]>([]);
  const [rowSizes, setRowSizes] = useState<number[]>([]);

  // Get effective sizes (padded with 1s if needed)
  const effectiveColSizes = useMemo(() => {
    return colSizes.length >= cols ? colSizes.slice(0, cols) : [...colSizes, ...Array(cols - colSizes.length).fill(1)];
  }, [colSizes, cols]);

  const effectiveRowSizes = useMemo(() => {
    return rowSizes.length >= rows ? rowSizes.slice(0, rows) : [...rowSizes, ...Array(rows - rowSizes.length).fill(1)];
  }, [rowSizes, rows]);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<"col" | "row" | null>(null);
  const dragInfo = useRef<{
    type: "col" | "row";
    index: number;
    startPos: number;
    startSizes: number[];
    totalSize: number;
  } | null>(null);
  const rafId = useRef<number | null>(null);
  const currentSizes = useRef<number[]>([]);

  const extractVideoId = (url: string): string | null => {
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
  };

  const getEmbedUrl = (videoId: string): string => {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&enablejsapi=1&rel=0`;
  };

  const handleBack = () => {
    router.push("/");
  };

  const handleClear = () => {
    setStreamUrls(Array(streamCount).fill(""));
    router.push("/");
  };

  // Update grid styles directly on DOM for smooth resizing
  const updateGridStyles = useCallback((sizes: number[], type: "col" | "row") => {
    if (!gridRef.current) return;
    const template = sizes.map(s => `${s}fr`).join(" ");
    if (type === "col") {
      gridRef.current.style.gridTemplateColumns = template;
    } else {
      gridRef.current.style.gridTemplateRows = template;
    }
  }, []);

  // Handle column resize start
  const handleColResizeStart = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const totalWidth = rect.width;

    dragInfo.current = {
      type: "col",
      index,
      startPos: e.clientX,
      startSizes: [...effectiveColSizes],
      totalSize: totalWidth,
    };
    currentSizes.current = [...effectiveColSizes];

    setDragType("col");
    setIsDragging(true);
  }, [effectiveColSizes]);

  // Handle row resize start
  const handleRowResizeStart = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const totalHeight = rect.height;

    dragInfo.current = {
      type: "row",
      index,
      startPos: e.clientY,
      startSizes: [...effectiveRowSizes],
      totalSize: totalHeight,
    };
    currentSizes.current = [...effectiveRowSizes];

    setDragType("row");
    setIsDragging(true);
  }, [effectiveRowSizes]);

  // Handle mouse move during drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragInfo.current) return;
      
      // Cancel any pending animation frame
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }

      // Schedule update for next frame
      rafId.current = requestAnimationFrame(() => {
        if (!dragInfo.current) return;
        
        const { type, index, startPos, startSizes, totalSize } = dragInfo.current;

        const delta = type === "col" ? e.clientX - startPos : e.clientY - startPos;
        const deltaFraction = delta / (totalSize / startSizes.length);

        const newSizes = [...startSizes];
        const currentSize = startSizes[index];
        const nextSize = startSizes[index + 1];

        // Calculate new sizes with constraints (min 10% each)
        let newCurrent = currentSize + deltaFraction;
        let newNext = nextSize - deltaFraction;

        const minSize = 0.1 * startSizes.length;
        if (newCurrent < minSize) {
          newNext -= minSize - newCurrent;
          newCurrent = minSize;
        }
        if (newNext < minSize) {
          newCurrent -= minSize - newNext;
          newNext = minSize;
        }

        newSizes[index] = newCurrent;
        newSizes[index + 1] = newNext;

        currentSizes.current = newSizes;
        updateGridStyles(newSizes, type);
      });
    };

    const handleMouseUp = () => {
      // Cancel any pending animation frame
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }

      // Save final sizes to state
      if (dragInfo.current) {
        if (dragInfo.current.type === "col") {
          setColSizes(currentSizes.current);
        } else {
          setRowSizes(currentSizes.current);
        }
      }

      setIsDragging(false);
      setDragType(null);
      dragInfo.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [isDragging, updateGridStyles]);

  // Reset sizes to equal distribution
  const resetSizes = () => {
    setColSizes([]);
    setRowSizes([]);
    if (gridRef.current) {
      gridRef.current.style.gridTemplateColumns = "";
      gridRef.current.style.gridTemplateRows = "";
    }
  };

  // Generate grid template strings
  const gridTemplateColumns = effectiveColSizes.map(s => `${s}fr`).join(" ");
  const gridTemplateRows = effectiveRowSizes.map(s => `${s}fr`).join(" ");

  if (!mounted) {
    return (
      <main className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen bg-black flex flex-col overflow-hidden">
      {/* Minimal Header */}
      <header className="bg-neutral-900/90 border-b border-neutral-800 px-4 py-2 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white">Stream MultiView</h1>
          <span className="text-xs text-neutral-500">
            {activeCount} stream{activeCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {(colSizes.length > 0 || rowSizes.length > 0) && (
            <button
              onClick={resetSizes}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded transition-colors"
            >
              Reset Layout
            </button>
          )}
          <button
            onClick={handleBack}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-medium rounded transition-colors border border-red-600/30"
          >
            Clear
          </button>
        </div>
      </header>

      {/* Stream Grid Container */}
      <div className="flex-1 relative">
        {/* Vertical Resize Handles */}
        {cols > 1 && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {Array.from({ length: cols - 1 }, (_, i) => {
              // Calculate position based on cumulative fractions
              const cumulativeFraction = effectiveColSizes.slice(0, i + 1).reduce((a, b) => a + b, 0);
              const totalFraction = effectiveColSizes.reduce((a, b) => a + b, 0);
              const leftPercent = (cumulativeFraction / totalFraction) * 100;
              
              return (
                <div
                  key={`v-${i}`}
                  className="absolute top-0 bottom-0 w-4 -ml-2 cursor-col-resize pointer-events-auto group"
                  style={{ left: `${leftPercent}%` }}
                  onMouseDown={(e) => handleColResizeStart(i, e)}
                  title="Drag to resize"
                >
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-transparent group-hover:bg-red-500/50 transition-colors" />
                </div>
              );
            })}
          </div>
        )}

        {/* Horizontal Resize Handles */}
        {rows > 1 && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {Array.from({ length: rows - 1 }, (_, i) => {
              const cumulativeFraction = effectiveRowSizes.slice(0, i + 1).reduce((a, b) => a + b, 0);
              const totalFraction = effectiveRowSizes.reduce((a, b) => a + b, 0);
              const topPercent = (cumulativeFraction / totalFraction) * 100;
              
              return (
                <div
                  key={`h-${i}`}
                  className="absolute left-0 right-0 h-4 -mt-2 cursor-row-resize pointer-events-auto group"
                  style={{ top: `${topPercent}%` }}
                  onMouseDown={(e) => handleRowResizeStart(i, e)}
                  title="Drag to resize"
                >
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-transparent group-hover:bg-red-500/50 transition-colors" />
                </div>
              );
            })}
          </div>
        )}

        {/* Stream Grid */}
        <div 
          ref={gridRef}
          className="w-full h-full grid gap-1 will-change-[grid-template-columns,grid-template-rows]"
          style={{
            gridTemplateColumns,
            gridTemplateRows,
          }}
        >
          {streamUrls.slice(0, activeCount).map((url, index) => {
            const videoId = extractVideoId(url);
            const isActive = url.trim() !== "" && videoId;

            return (
              <div
                key={index}
                className="relative bg-neutral-900 overflow-hidden"
              >
                {isActive ? (
                  <iframe
                    src={getEmbedUrl(videoId!)}
                    title={`Stream ${index + 1}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ border: "none" }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600">
                    <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-2">
                      <span className="text-lg font-bold text-neutral-500">
                        {index + 1}
                      </span>
                    </div>
                    <span className="text-xs">No stream</span>
                  </div>
                )}

                {/* Stream Label */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded backdrop-blur-sm">
                  <span className="text-xs font-medium text-white">
                    {index + 1}
                    {isActive && (
                      <span className="ml-1.5 w-1.5 h-1.5 bg-red-500 rounded-full inline-block animate-pulse" />
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="bg-neutral-900/90 border-t border-neutral-800 px-4 py-1.5 shrink-0 z-10">
        <p className="text-[10px] text-neutral-500 text-center">
          Hover over grid lines to resize • Click stream to unmute
        </p>
      </footer>

      {/* Global cursor style during drag */}
      {isDragging && (
        <style jsx global>{`
          body {
            cursor: ${dragType === "col" ? "col-resize" : "row-resize"} !important;
            user-select: none !important;
          }
        `}</style>
      )}
    </main>
  );
}
