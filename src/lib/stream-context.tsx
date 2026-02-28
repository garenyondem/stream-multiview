"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface StreamContextType {
  streamCount: number;
  setStreamCount: (count: number) => void;
  streamUrls: string[];
  setStreamUrls: (urls: string[]) => void;
  clearStreams: () => void;
}

const StreamContext = createContext<StreamContextType | undefined>(undefined);

export function StreamProvider({ children }: { children: ReactNode }) {
  const [streamCount, setStreamCount] = useState<number>(1);
  const [streamUrls, setStreamUrls] = useState<string[]>([]);

  const clearStreams = () => {
    setStreamCount(1);
    setStreamUrls([]);
  };

  return (
    <StreamContext.Provider
      value={{
        streamCount,
        setStreamCount,
        streamUrls,
        setStreamUrls,
        clearStreams,
      }}
    >
      {children}
    </StreamContext.Provider>
  );
}

export function useStreams() {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreams must be used within a StreamProvider");
  }
  return context;
}
