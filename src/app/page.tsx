"use client";

import { useState } from "react";
import { useStreams } from "@/lib/stream-context";
import { useRouter } from "next/navigation";

export default function Home() {
  const { streamCount, setStreamCount, streamUrls, setStreamUrls } = useStreams();
  const [tempCount, setTempCount] = useState(streamCount);
  const [tempUrls, setTempUrls] = useState<string[]>(
    streamUrls.length > 0 ? streamUrls : Array(1).fill("")
  );
  const router = useRouter();

  const handleCountChange = (count: number) => {
    setTempCount(count);
    // Adjust URL array size while preserving existing URLs
    const newUrls = [...tempUrls];
    if (count > newUrls.length) {
      // Add empty slots
      while (newUrls.length < count) {
        newUrls.push("");
      }
    } else if (count < newUrls.length) {
      // Remove excess slots
      newUrls.splice(count);
    }
    setTempUrls(newUrls);
  };

  const handleUrlChange = (index: number, url: string) => {
    const newUrls = [...tempUrls];
    newUrls[index] = url;
    setTempUrls(newUrls);
  };

  const extractVideoId = (url: string): string | null => {
    // Handle various YouTube URL formats
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

  const handleStartStreams = () => {
    // Validate and extract video IDs
    const validUrls = tempUrls.filter((url) => url.trim() !== "");
    if (validUrls.length === 0) {
      alert("Please enter at least one YouTube stream URL");
      return;
    }

    // Check if all URLs have valid video IDs
    const invalidUrls = validUrls.filter((url) => !extractVideoId(url));
    if (invalidUrls.length > 0) {
      alert(`Invalid YouTube URL(s): ${invalidUrls.join(", ")}`);
      return;
    }

    // Save to context (soft persistence)
    setStreamCount(tempCount);
    setStreamUrls(tempUrls);

    // Navigate to viewer
    router.push("/viewer");
  };

  return (
    <main className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-neutral-900 rounded-2xl border border-neutral-800 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            YouTube Stream Monitor
          </h1>
          <p className="text-neutral-400">
            Watch up to 10 live streams simultaneously
          </p>
        </div>

        {/* Stream Count Selection */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-neutral-300 mb-3">
            Number of Streams
          </label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => handleCountChange(num)}
                className={`w-12 h-12 rounded-lg font-semibold transition-all duration-200 ${
                  tempCount === num
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/25"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Stream URL Inputs */}
        <div className="mb-8 space-y-4">
          <label className="block text-sm font-medium text-neutral-300">
            YouTube Stream URLs
          </label>
          {Array.from({ length: tempCount }, (_, i) => (
            <div key={i} className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-500">
                {i + 1}
              </div>
              <input
                type="text"
                placeholder="Paste YouTube live stream URL..."
                value={tempUrls[i] || ""}
                onChange={(e) => handleUrlChange(i, e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
              />
            </div>
          ))}
        </div>

        {/* Helper Text */}
        <div className="mb-8 p-4 bg-neutral-800/50 rounded-lg border border-neutral-800">
          <p className="text-sm text-neutral-400">
            <span className="text-neutral-300 font-medium">Supported formats:</span>
            <br />
            • youtube.com/live/STREAM_ID
            <br />
            • youtube.com/watch?v=VIDEO_ID
            <br />
            • youtu.be/VIDEO_ID
          </p>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartStreams}
          className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-red-600/20 hover:shadow-red-600/40 transform hover:scale-[1.02]"
        >
          Start Watching Streams
        </button>
      </div>
    </main>
  );
}
