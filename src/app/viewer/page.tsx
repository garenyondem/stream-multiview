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

  const getGridClasses = (count: number): string => {
    switch (count) {
      case 1:
        return "grid-cols-1 grid-rows-1";
      case 2:
        return "grid-cols-2 grid-rows-1";
      case 3:
        return "grid-cols-2 grid-rows-2";
      case 4:
        return "grid-cols-2 grid-rows-2";
      case 5:
      case 6:
        return "grid-cols-3 grid-rows-2";
      case 7:
      case 8:
      case 9:
        return "grid-cols-3 grid-rows-3";
      case 10:
        return "grid-cols-4 grid-rows-3";
      default:
        return "grid-cols-2 grid-rows-2";
    }
  };

  if (!mounted) {
    return (
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Header Bar */}
      <header className="bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">Stream Monitor</h1>
          <span className="text-sm text-neutral-500">
            {activeCount} stream{activeCount !== 1 ? "s" : ""} active
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Edit Streams
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-600/30"
          >
            Clear All
          </button>
        </div>
      </header>

      {/* Stream Grid */}
      <div className="flex-1 p-2 overflow-hidden">
        <div className={`grid ${getGridClasses(activeCount)} gap-2 h-full`}>
          {streamUrls.map((url, index) => {
            const videoId = extractVideoId(url);
            const isActive = url.trim() !== "" && videoId;

            return (
              <div
                key={index}
                className="relative bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800"
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
                    <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-3">
                      <span className="text-2xl font-bold text-neutral-500">
                        {index + 1}
                      </span>
                    </div>
                    <span className="text-sm">No stream configured</span>
                  </div>
                )}

                {/* Stream Label */}
                <div className="absolute top-3 left-3 px-3 py-1 bg-black/70 rounded-md backdrop-blur-sm">
                  <span className="text-xs font-medium text-white">
                    Stream {index + 1}
                    {isActive && (
                      <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block animate-pulse" />
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <footer className="bg-neutral-900 border-t border-neutral-800 px-6 py-3 shrink-0">
        <p className="text-xs text-neutral-500 text-center">
          Streams may be muted by default due to browser autoplay policies. Click on a stream to unmute.
        </p>
      </footer>
    </main>
  );
}
