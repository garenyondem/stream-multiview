/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
"use client";

import { useStreams } from "@/lib/stream-context";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useCallback, useMemo } from "react";
import { extractVideoId, decodeStreamData, encodeStreamData, StreamData } from "@/lib/share-utils";

type LayoutType = "grid" | "stage";

// Hook to track mounted state without causing cascading renders
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

// Parse shared data from URL on first render (avoids useSearchParams issues)
// Always returns valid StreamData with defaults
function parseSharedDataFromUrl(): StreamData {
  if (typeof window === "undefined") {
    return { videoIds: [], colSizes: [], rowSizes: [], layout: "grid", stageIndex: 0 };
  }
  const params = new URLSearchParams(window.location.search);
  const encodedData = params.get("data") || "";
  return decodeStreamData(encodedData);
}

export default function Viewer() {
  const { streamCount, streamUrls, setStreamUrls, setStreamCount } = useStreams();
  const router = useRouter();
  const mounted = useMounted();
  const gridRef = useRef<HTMLDivElement>(null);
  const iframeRefs = useRef<(HTMLIFrameElement | null)[]>([]);
  const hasRestored = useRef(false);

  // Use lazy state initialization to read URL params once
  // All values have safe defaults
  const [colSizes, setColSizes] = useState<number[]>(() => {
    const shared = parseSharedDataFromUrl();
    return Array.isArray(shared.colSizes) ? shared.colSizes : [];
  });
  const [rowSizes, setRowSizes] = useState<number[]>(() => {
    const shared = parseSharedDataFromUrl();
    return Array.isArray(shared.rowSizes) ? shared.rowSizes : [];
  });
  const [layout, setLayout] = useState<LayoutType>(() => {
    const shared = parseSharedDataFromUrl();
    return shared.layout === "stage" ? "stage" : "grid";
  });
  const [stageIndex, setStageIndex] = useState<number>(() => {
    const shared = parseSharedDataFromUrl();
    return typeof shared.stageIndex === "number" && !isNaN(shared.stageIndex)
      ? Math.max(0, shared.stageIndex)
      : 0;
  });
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  // Restore streams from shared data once on mount
  useEffect(() => {
    if (hasRestored.current || !mounted) return;
    
    const shared = parseSharedDataFromUrl();
    const hasSharedData = shared.videoIds.length > 0;

    if (hasSharedData) {
      const restoredUrls = shared.videoIds.map(
        (id: string) => `https://youtube.com/embed/${id}`
      );
      setStreamUrls(restoredUrls);
      setStreamCount(restoredUrls.length);
      setLayout(shared.layout);
      setStageIndex(shared.stageIndex);
      // Restore column and row sizes from shared data
      if (shared.colSizes.length > 0) setColSizes(shared.colSizes);
      if (shared.rowSizes.length > 0) setRowSizes(shared.rowSizes);
      hasRestored.current = true;
    }
  }, [mounted, setStreamUrls, setStreamCount, setColSizes, setRowSizes]);

  // Redirect if no streams configured and no shared data
  useEffect(() => {
    const hasSharedData = typeof window !== "undefined" && 
      new URLSearchParams(window.location.search).has("data");
    if (mounted && streamUrls.every((url) => url === "") && !hasSharedData) {
      router.push("/");
    }
  }, [mounted, streamUrls, router]);

  // Calculate number of active streams
  const activeUrls = streamUrls.filter((url) => typeof url === "string" && url.trim() !== "");
  const activeCount = Math.max(activeUrls.length, streamCount || 0);

  // Calculate optimal grid dimensions based on count (for bottom row in stage mode)
  const getBottomGridDimensions = (count: number): { cols: number; rows: number } => {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    return { cols: 4, rows: 3 };
  };

  const getGridDimensions = (count: number): { cols: number; rows: number } => {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    return { cols: 4, rows: 3 };
  };

  const { cols: gridCols, rows: gridRows } = useMemo(() => {
    if (layout === "stage") {
      const bottomCount = activeCount - 1;
      if (bottomCount <= 0) return { cols: 1, rows: 1 };
      const dims = getBottomGridDimensions(bottomCount);
      return { cols: dims.cols, rows: 1 + dims.rows }; // +1 for stage row
    }
    return getGridDimensions(activeCount);
  }, [activeCount, layout]);

  // Get effective sizes (padded with 1s if needed)
  // Always returns valid arrays with positive numbers
  const effectiveColSizes = useMemo(() => {
    const safeGridCols = Math.max(1, gridCols || 1);
    const safeColSizes = Array.isArray(colSizes) ? colSizes : [];
    const validSizes = safeColSizes.filter(s => typeof s === "number" && !isNaN(s) && s > 0);
    
    if (validSizes.length >= safeGridCols) {
      return validSizes.slice(0, safeGridCols);
    }
    return [...validSizes, ...Array(safeGridCols - validSizes.length).fill(1)];
  }, [colSizes, gridCols]);

  const effectiveRowSizes = useMemo(() => {
    const safeGridRows = Math.max(1, gridRows || 1);
    const safeRowSizes = Array.isArray(rowSizes) ? rowSizes : [];
    const validSizes = safeRowSizes.filter(s => typeof s === "number" && !isNaN(s) && s > 0);
    
    if (layout === "stage") {
      // For stage layout: first row is stage (2x), bottom rows are equal
      const bottomRowCount = safeGridRows - 1;
      if (bottomRowCount <= 0) return [3];
      const bottomSize = validSizes.length > 1 ? validSizes.slice(1) : Array(bottomRowCount).fill(1);
      const stageSize = validSizes.length > 0 ? validSizes[0] : 2;
      return [stageSize, ...bottomSize].slice(0, safeGridRows);
    }
    
    if (validSizes.length >= safeGridRows) {
      return validSizes.slice(0, safeGridRows);
    }
    return [...validSizes, ...Array(safeGridRows - validSizes.length).fill(1)];
  }, [rowSizes, gridRows, layout]);

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
      const url = streamUrls[index];
      if (iframe && typeof url === "string" && url.trim()) {
        const videoId = extractVideoId(url);
        if (videoId) {
          iframe.src = getEmbedUrl(videoId);
        }
      }
    });
  };

  const switchLayout = (newLayout: LayoutType) => {
    setLayout(newLayout);
    setShowLayoutMenu(false);
    // Refresh page to apply new layout with clean state
    window.location.reload();
    // Reset sizes when switching layouts
    setColSizes([]);
    setRowSizes([]);
    if (gridRef.current) {
      gridRef.current.style.gridTemplateColumns = "";
      gridRef.current.style.gridTemplateRows = "";
    }
    updateShareableUrl([], [], newLayout, stageIndex);
  };

  const moveToStage = (index: number) => {
    setStageIndex(index);
    updateShareableUrl(colSizes, rowSizes, layout, index);
  };

  // Update URL with current layout for sharing
  const updateShareableUrl = useCallback((
    currentColSizes: number[],
    currentRowSizes: number[],
    currentLayout: LayoutType = layout,
    currentStageIndex: number = stageIndex
  ) => {
    // Ensure streamUrls is an array
    const safeStreamUrls = Array.isArray(streamUrls) ? streamUrls : [];
    
    // Extract video IDs with validation
    const videoIds = safeStreamUrls
      .map(url => extractVideoId(url))
      .filter(id => id.length > 0);
    
    if (videoIds.length === 0) return;
    
    // Ensure sizes are valid arrays with positive numbers
    const safeColSizes = Array.isArray(currentColSizes) ? currentColSizes : [];
    const safeRowSizes = Array.isArray(currentRowSizes) ? currentRowSizes : [];
    
    const cleanColSizes = safeColSizes
      .filter((s): s is number => typeof s === "number" && !isNaN(s) && s > 0);
    const cleanRowSizes = safeRowSizes
      .filter((s): s is number => typeof s === "number" && !isNaN(s) && s > 0);
    
    const streamData: StreamData = {
      videoIds,
      colSizes: cleanColSizes,
      rowSizes: cleanRowSizes,
      layout: currentLayout === "stage" ? "stage" : "grid",
      stageIndex: typeof currentStageIndex === "number" && !isNaN(currentStageIndex)
        ? Math.max(0, currentStageIndex)
        : 0,
    };
    
    const encoded = encodeStreamData(streamData);
    const newUrl = `/viewer?data=${encoded}`;
    
    // Update URL without triggering navigation
    window.history.replaceState(null, "", newUrl);
  }, [streamUrls, layout, stageIndex]);

  // Update URL whenever colSizes or rowSizes change
  // This ensures the shareable URL always reflects current divider positions
  useEffect(() => {
    if (!mounted || !hasRestored.current) return;
    
    const videoIds = streamUrls
      .map(url => extractVideoId(url))
      .filter(id => id.length > 0);
    
    if (videoIds.length === 0) return;
    
    const streamData: StreamData = {
      videoIds,
      colSizes: colSizes.filter((s): s is number => typeof s === "number" && !isNaN(s) && s > 0),
      rowSizes: rowSizes.filter((s): s is number => typeof s === "number" && !isNaN(s) && s > 0),
      layout,
      stageIndex,
    };
    
    const encoded = encodeStreamData(streamData);
    const newUrl = `/viewer?data=${encoded}`;
    window.history.replaceState(null, "", newUrl);
  }, [colSizes, rowSizes, mounted, streamUrls, layout, stageIndex]);

  // Calculate divider position as percentage
  // sizes array is guaranteed to have valid positive numbers
  const getDividerPosition = useCallback((sizes: number[], index: number): number => {
    const safeSizes = Array.isArray(sizes) ? sizes : [1];
    const safeIndex = Math.max(0, Math.min(index, safeSizes.length - 1));
    
    const cumulativeFraction = safeSizes.slice(0, safeIndex + 1).reduce((a, b) => a + (b || 1), 0);
    const totalFraction = safeSizes.reduce((a, b) => a + (b || 1), 0);
    
    if (totalFraction <= 0) return 50;
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
    for (let i = 0; i < gridCols - 1; i++) {
      const pos = getDividerPosition(effectiveColSizes, i);
      updateDividerPosition("col", i, pos);
    }
    for (let i = 0; i < gridRows - 1; i++) {
      const pos = getDividerPosition(effectiveRowSizes, i);
      updateDividerPosition("row", i, pos);
    }
  }, [gridCols, gridRows, effectiveColSizes, effectiveRowSizes, getDividerPosition, updateDividerPosition]);

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

    // Get current sizes from grid style
    let currentColSizes = effectiveColSizes;
    let currentRowSizes = effectiveRowSizes;
    
    if (gridRef.current) {
      const colTemplate = gridRef.current.style.gridTemplateColumns;
      const rowTemplate = gridRef.current.style.gridTemplateRows;
      
      if (colTemplate) {
        currentColSizes = colTemplate.split(" ").map(s => parseFloat(s));
        setColSizes(currentColSizes);
      }
      if (rowTemplate) {
        currentRowSizes = rowTemplate.split(" ").map(s => parseFloat(s));
        setRowSizes(currentRowSizes);
      }
    }

    // Update URL with new layout
    updateShareableUrl(currentColSizes, currentRowSizes, layout, stageIndex);

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
  }, [effectiveColSizes, effectiveRowSizes, updateShareableUrl, layout, stageIndex]);

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

  // Reset sizes to equal distribution based on current layout mode
  const resetSizes = () => {
    if (layout === "stage") {
      // Stage mode: stage row gets 2fr, bottom rows get 1fr each
      const bottomRowCount = gridRows - 1;
      const newRowSizes = bottomRowCount > 0
        ? [2, ...Array(bottomRowCount).fill(1)]
        : [3];
      const newColSizes = Array(gridCols).fill(1);
      
      setColSizes(newColSizes);
      setRowSizes(newRowSizes);
      
      if (gridRef.current) {
        gridRef.current.style.gridTemplateColumns = newColSizes.map(s => `${s}fr`).join(" ");
        gridRef.current.style.gridTemplateRows = newRowSizes.map(s => `${s}fr`).join(" ");
      }
      
      updateShareableUrl(newColSizes, newRowSizes, layout, stageIndex);
    } else {
      // Grid mode: all equal 1fr
      const newColSizes = Array(gridCols).fill(1);
      const newRowSizes = Array(gridRows).fill(1);
      
      setColSizes(newColSizes);
      setRowSizes(newRowSizes);
      
      if (gridRef.current) {
        gridRef.current.style.gridTemplateColumns = newColSizes.map(s => `${s}fr`).join(" ");
        gridRef.current.style.gridTemplateRows = newRowSizes.map(s => `${s}fr`).join(" ");
      }
      
      updateShareableUrl(newColSizes, newRowSizes, layout, stageIndex);
    }
  };

  // Generate grid template strings
  const gridTemplateColumns = effectiveColSizes.map(s => `${s}fr`).join(" ");
  const gridTemplateRows = effectiveRowSizes.map(s => `${s}fr`).join(" ");

  // Get displayed streams based on layout
  // Always returns array with valid stream items
  const getDisplayedStreams = (): Array<{ url: string; index: number }> => {
    const safeStreamUrls = Array.isArray(streamUrls) ? streamUrls : [];
    const safeActiveCount = Math.max(0, activeCount || 0);
    const safeStageIndex = Math.max(0, Math.min(stageIndex, safeActiveCount - 1));
    
    if (layout === "grid") {
      return safeStreamUrls
        .slice(0, safeActiveCount)
        .map((url, index) => ({ url: url || "", index }));
    }
    
    // Stage layout: stage stream first, then remaining streams
    const allStreams = safeStreamUrls
      .slice(0, safeActiveCount)
      .map((url, index) => ({ url: url || "", index }));
    
    if (allStreams.length === 0) return [];
    
    const stageStream = allStreams[safeStageIndex] || allStreams[0];
    const otherStreams = allStreams.filter((_, i) => i !== safeStageIndex);
    return [stageStream, ...otherStreams];
  };

  // Check if an index is the stage position
  const isStagePosition = (displayIndex: number) => {
    return layout === "stage" && displayIndex === 0;
  };

  // Get original index from display position
  const getOriginalIndex = (displayIndex: number): number => {
    const safeDisplayIndex = Math.max(0, displayIndex);
    const safeActiveCount = Math.max(0, activeCount || 0);
    const safeStageIndex = Math.max(0, Math.min(stageIndex, safeActiveCount - 1));
    
    if (layout === "grid") return safeDisplayIndex;
    if (safeDisplayIndex === 0) return safeStageIndex;
    
    // Map display index back to original index
    const allIndices = Array.from({ length: safeActiveCount }, (_, i) => i);
    const otherIndices = allIndices.filter(i => i !== safeStageIndex);
    const resultIndex = otherIndices[safeDisplayIndex - 1];
    
    return typeof resultIndex === "number" ? resultIndex : safeDisplayIndex;
  };

  if (!mounted) {
    return (
      <main className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </main>
    );
  }

  const displayedStreams = getDisplayedStreams();

  return (
    <main className="h-screen w-screen bg-black flex flex-col overflow-hidden">
      {/* Minimal Header */}
      <header className="bg-neutral-900/90 border-b border-neutral-800 px-4 py-2 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white">Stream MultiView</h1>
          <span className="text-xs text-neutral-500">
            {activeCount} stream{activeCount !== 1 ? "s" : ""}
          </span>
          {layout === "stage" && (
            <span className="text-xs px-2 py-0.5 bg-purple-600/30 text-purple-400 rounded">
              Stage Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Layout Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
              Layout
            </button>
            {showLayoutMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-50 p-2">
                <button
                  onClick={() => switchLayout("grid")}
                  className={`w-full px-3 py-2 text-left text-xs rounded transition-colors flex items-center gap-2 ${
                    layout === "grid" ? "bg-neutral-700 text-white" : "text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  Grid (Equal)
                </button>
                <button
                  onClick={() => switchLayout("stage")}
                  className={`w-full px-3 py-2 text-left text-xs rounded transition-colors flex items-center gap-2 mt-1 ${
                    layout === "stage" ? "bg-purple-600/30 text-purple-400" : "text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="10"></rect>
                    <rect x="3" y="16" width="5" height="5"></rect>
                    <rect x="9.5" y="16" width="5" height="5"></rect>
                    <rect x="16" y="16" width="5" height="5"></rect>
                  </svg>
                  Stage + Grid
                </button>
              </div>
            )}
          </div>

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
          <div className="relative">
            <button
              onClick={() => setShowShareDialog(!showShareDialog)}
              className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs font-medium rounded transition-colors border border-green-600/30 flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              Share
            </button>
            {showShareDialog && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-white">Share this layout</span>
                  <button
                    onClick={() => setShowShareDialog(false)}
                    className="text-neutral-400 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={typeof window !== "undefined" ? window.location.href : ""}
                    readOnly
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-neutral-300 truncate"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-2 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-neutral-500 mt-2">
                  Anyone with this link can view these streams with your exact layout.
                </p>
              </div>
            )}
          </div>
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
        {gridCols > 1 && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {Array.from({ length: gridCols - 1 }, (_, i) => {
              const leftPercent = getDividerPosition(effectiveColSizes, i);
              
              // In stage mode, vertical dividers should only span the bottom grid area
              const isStageMode = layout === "stage";
              const firstRowHeightPercent = isStageMode && effectiveRowSizes.length > 0
                ? (effectiveRowSizes[0] / effectiveRowSizes.reduce((a, b) => a + b, 0)) * 100
                : 0;
              
              return (
                <div
                  key={`v-${i}`}
                  ref={el => { colHandleRefs.current[i] = el; }}
                  className="absolute bottom-0 w-6 -ml-3 cursor-col-resize pointer-events-auto group z-30 transition-none"
                  style={{ 
                    left: `${leftPercent}%`,
                    top: isStageMode ? `${firstRowHeightPercent}%` : '0%',
                  }}
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
        {gridRows > 1 && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {Array.from({ length: gridRows - 1 }, (_, i) => {
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
          {displayedStreams.map((streamItem, displayIndex) => {
            const originalIndex = getOriginalIndex(displayIndex);
            const url = streamItem?.url || "";
            const videoId = extractVideoId(url);
            const isActive = url.trim() !== "" && videoId.length > 0;
            const isStage = isStagePosition(displayIndex);

            return (
              <div
                key={originalIndex}
                className={`relative bg-neutral-900 overflow-hidden ${
                  isStage ? "col-span-full" : ""
                }`}
                style={{
                  gridColumn: isStage ? `1 / -1` : undefined,
                }}
              >
                {isActive ? (
                  <iframe
                    ref={el => {
                      if (originalIndex >= 0) {
                        iframeRefs.current[originalIndex] = el;
                      }
                    }}
                    src={getEmbedUrl(videoId)}
                    title={`Stream ${originalIndex + 1}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ border: "none" }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600">
                    <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-2">
                      <span className="text-lg font-bold text-neutral-500">
                        {originalIndex + 1}
                      </span>
                    </div>
                    <span className="text-xs">No stream</span>
                  </div>
                )}

                {/* Stream Label */}
                <div className="absolute top-2 left-2 px-2 py-1 flex items-center gap-2">
                  <span className="text-xs font-medium text-white drop-shadow-lg">
                    {originalIndex + 1}
                    {isActive && (
                      <span className="ml-1.5 w-1.5 h-1.5 bg-red-500 rounded-full inline-block animate-pulse" />
                    )}
                  </span>
                  {layout === "stage" && !isStage && isActive && (
                    <button
                      onClick={() => moveToStage(originalIndex)}
                      className="text-[10px] px-1.5 py-0.5 text-purple-300 hover:text-white transition-all opacity-50 hover:opacity-100 drop-shadow-lg"
                      title="Move to stage"
                    >
                      → Stage
                    </button>
                  )}
                  {layout === "stage" && isStage && (
                    <span className="text-[10px] px-1.5 py-0.5 text-purple-400 drop-shadow-lg">
                      Stage
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
