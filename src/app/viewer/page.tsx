"use client";

import { useStreams } from "@/lib/stream-context";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

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

  // Redirect if no streams configured
  useEffect(() => {
    if (mounted && streamUrls.every((url) => url === "")) {
      router.push("/");
    }
  }, [mounted, streamUrls, router]);

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
    // Use the standard YouTube embed with autoplay and mute
    // Note: Most browsers block autoplay with sound, so we mute initially
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&enablejsapi=1&rel=0`;
  };

  const handleBack = () => {
    router.push("/");
  };

  const handleClear = () => {
    setStreamUrls(Array(streamCount).fill(""));
    router.push("/");
  };

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
          <h1 className="text-sm font-semibold text-white">Stream Monitor</h1>
          <span className="text-xs text-neutral-500">
            {activeCount} stream{activeCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Stream Grid - Full Screen */}
      <div 
        className="flex-1 grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
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

      {/* Minimal Footer */}
      <footer className="bg-neutral-900/90 border-t border-neutral-800 px-4 py-1.5 shrink-0 z-10">
        <p className="text-[10px] text-neutral-500 text-center">
          Click stream to unmute • Autoplay muted by browser policy
        </p>
      </footer>
    </main>
  );
}
