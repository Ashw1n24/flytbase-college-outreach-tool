import { createContext, useContext, type ReactNode } from "react";

import { useSearch } from "@/hooks/useSearch";

type SearchContextValue = ReturnType<typeof useSearch>;

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const value = useSearch();
  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

export function useSearchContext() {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error("useSearchContext must be used within SearchProvider");
  }
  return ctx;
}
