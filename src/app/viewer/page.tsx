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
  const iframeRefs = useRef<(HTMLIFrameElement | null)[]>([]);

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
  const [colSizes, setColSizes] = useState<number[]>([]);
  const [rowSizes, setRowSizes] = useState<number[]>([]);

  // Get effective sizes (padded with 1s if needed)
  const effectiveColSizes = useMemo(() => {
    return colSizes.length >= cols ? colSizes.slice(0, cols) : [...colSizes, ...Array(cols - colSizes.length).fill(1)];
  }, [colSizes, cols]);

  const effectiveRowSizes = useMemo(() => {
    return rowSizes.length >= rows ? rowSizes.slice(0, rows) : [...rowSizes, ...Array(rows - rowSizes.length).fill(1)];
  }, [rowSizes, rows]);

  // Drag state - minimal React state, mostly refs for performance
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef<{
    type: "col" | "row";
    index: number;
    startSizes: number[];
    gridRect: DOMRect;
    startClientPos: number;
  } | null>(null);
  
  // Refs to DOM elements for direct manipulation
  const colHandleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rowHandleRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  const handleRefresh = () => {
    // Reload all iframes by resetting their src
    iframeRefs.current.forEach((iframe, index) => {
      if (iframe && streamUrls[index]?.trim()) {
        const videoId = extractVideoId(streamUrls[index]);
        if (videoId) {
          iframe.src = getEmbedUrl(videoId);
        }
      }
    });
  };

  // Calculate divider position as percentage
  const getDividerPosition = useCallback((sizes: number[], index: number): number => {
    const cumulativeFraction = sizes.slice(0, index + 1).reduce((a, b) => a + b, 0);
    const totalFraction = sizes.reduce((a, b) => a + b, 0);
    return (cumulativeFraction / totalFraction) * 100;
  }, []);

  // Update a divider's visual position directly via DOM
  const updateDividerPosition = useCallback((type: "col" | "row", index: number, percent: number) => {
    const refs = type === "col" ? colHandleRefs : rowHandleRefs;
    const handle = refs.current[index];
    if (handle) {
      if (type === "col") {
        handle.style.left = `${percent}%`;
      } else {
        handle.style.top = `${percent}%`;
      }
    }
  }, []);

  // Update all divider positions based on current sizes
  const updateAllDividerPositions = useCallback(() => {
    for (let i = 0; i < cols - 1; i++) {
      const pos = getDividerPosition(effectiveColSizes, i);
      updateDividerPosition("col", i, pos);
    }
    for (let i = 0; i < rows - 1; i++) {
      const pos = getDividerPosition(effectiveRowSizes, i);
      updateDividerPosition("row", i, pos);
    }
  }, [cols, rows, effectiveColSizes, effectiveRowSizes, getDividerPosition, updateDividerPosition]);

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

  // Handle resize start
  const handleResizeStart = useCallback((type: "col" | "row", index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const sizes = type === "col" ? effectiveColSizes : effectiveRowSizes;
    const clientPos = type === "col" ? e.clientX : e.clientY;

    dragInfo.current = {
      type,
      index,
      startSizes: [...sizes],
      gridRect: rect,
      startClientPos: clientPos,
    };

    setIsDragging(true);

    // Highlight the active divider
    const refs = type === "col" ? colHandleRefs : rowHandleRefs;
    const handle = refs.current[index];
    if (handle) {
      const line = handle.querySelector(".divider-line") as HTMLElement;
      if (line) {
        line.classList.add("bg-red-500");
        line.classList.remove("bg-neutral-600/40", "group-hover:bg-red-500/70");
      }
    }
  }, [effectiveColSizes, effectiveRowSizes]);

  // Mouse move handler - uses refs only, no React state
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragInfo.current || !gridRef.current) return;
    
    const { type, index, startSizes, gridRect, startClientPos } = dragInfo.current;
    const clientPos = type === "col" ? e.clientX : e.clientY;
    const totalSize = type === "col" ? gridRect.width : gridRect.height;
    
    const delta = clientPos - startClientPos;
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

    // Apply immediately to DOM
    updateGridStyles(newSizes, type);

    // Update divider visual position
    const dividerPos = getDividerPosition(newSizes, index);
    updateDividerPosition(type, index, dividerPos);
  }, [updateGridStyles, getDividerPosition, updateDividerPosition]);

  // Mouse up handler - saves state once at the end
  const handleMouseUp = useCallback(() => {
    if (!dragInfo.current) return;

    const { type, index } = dragInfo.current;
    const sizes = type === "col" ? effectiveColSizes : effectiveRowSizes;

    // Get current sizes from grid style
    if (gridRef.current) {
      const template = type === "col" 
        ? gridRef.current.style.gridTemplateColumns 
        : gridRef.current.style.gridTemplateRows;
      
      if (template) {
        const currentSizes = template.split(" ").map(s => parseFloat(s));
        if (type === "col") {
          setColSizes(currentSizes);
        } else {
          setRowSizes(currentSizes);
        }
      }
    }

    // Remove highlight from divider
    const refs = type === "col" ? colHandleRefs : rowHandleRefs;
    const handle = refs.current[index];
    if (handle) {
      const line = handle.querySelector(".divider-line") as HTMLElement;
      if (line) {
        line.classList.remove("bg-red-500");
        line.classList.add("bg-neutral-600/40", "group-hover:bg-red-500/70");
      }
    }

    dragInfo.current = null;
    setIsDragging(false);
  }, [effectiveColSizes, effectiveRowSizes]);

  // Setup global mouse events
  useEffect(() => {
    if (!isDragging) return;

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

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
            onClick={handleRefresh}
            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium rounded transition-colors border border-blue-600/30 flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
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
              const leftPercent = getDividerPosition(effectiveColSizes, i);
              
              return (
                <div
                  key={`v-${i}`}
                  ref={el => { colHandleRefs.current[i] = el; }}
                  className="absolute top-0 bottom-0 w-6 -ml-3 cursor-col-resize pointer-events-auto group z-30 transition-none"
                  style={{ left: `${leftPercent}%` }}
                  onMouseDown={(e) => handleResizeStart("col", i, e)}
                  title="Drag to resize"
                >
                  <div className="divider-line absolute inset-y-4 left-1/2 -translate-x-1/2 w-1.5 rounded-full bg-neutral-600/40 group-hover:bg-red-500/70 transition-colors" />
                </div>
              );
            })}
          </div>
        )}

        {/* Horizontal Resize Handles */}
        {rows > 1 && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {Array.from({ length: rows - 1 }, (_, i) => {
              const topPercent = getDividerPosition(effectiveRowSizes, i);
              
              return (
                <div
                  key={`h-${i}`}
                  ref={el => { rowHandleRefs.current[i] = el; }}
                  className="absolute left-0 right-0 h-6 -mt-3 cursor-row-resize pointer-events-auto group z-30 transition-none"
                  style={{ top: `${topPercent}%` }}
                  onMouseDown={(e) => handleResizeStart("row", i, e)}
                  title="Drag to resize"
                >
                  <div className="divider-line absolute inset-x-4 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-neutral-600/40 group-hover:bg-red-500/70 transition-colors" />
                </div>
              );
            })}
          </div>
        )}

        {/* Stream Grid */}
        <div 
          ref={gridRef}
          className="w-full h-full grid gap-1"
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
                    ref={el => { iframeRefs.current[index] = el; }}
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
            cursor: col-resize !important;
            user-select: none !important;
          }
        `}</style>
      )}
    </main>
  );
}
