"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "viewAs_v1";

interface ViewAsState {
  role: "Sales" | null;
  team: string | null;
}

interface ViewAsContextType {
  viewAs: ViewAsState;
  setViewAs: (role: "Sales", team: string) => void;
  clearViewAs: () => void;
}

const ViewAsContext = createContext<ViewAsContextType>({
  viewAs: { role: null, team: null },
  setViewAs: () => {},
  clearViewAs: () => {},
});

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  const [viewAs, setViewAsState] = useState<ViewAsState>({ role: null, team: null });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setViewAsState(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const setViewAs = useCallback((role: "Sales", team: string) => {
    const next = { role, team };
    setViewAsState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const clearViewAs = useCallback(() => {
    setViewAsState({ role: null, team: null });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ViewAsContext.Provider value={{ viewAs, setViewAs, clearViewAs }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}
