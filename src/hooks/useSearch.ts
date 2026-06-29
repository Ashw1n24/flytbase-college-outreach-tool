import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { searchCandidatesFn } from "@/lib/api/candidates.functions";
import type { SearchParams, SortDirection, SortField } from "@/types/search";
import { useDebounce } from "./useDebounce";

const CURRENT_YEAR = new Date().getFullYear();

export const DEFAULT_SEARCH_PARAMS: SearchParams = {
  page: 0,
  limit: 50,
  sort_by: "graduation_year",
  sort_dir: "asc",
};

function computeActiveFilterCount(filters: SearchParams): number {
  let count = 0;
  if (filters.name?.trim()) count += 1;
  if (filters.universities?.length) count += filters.universities.length;
  if (filters.degrees?.length) count += filters.degrees.length;
  if (filters.branches?.length) count += filters.branches.length;
  if (filters.sources?.length) count += filters.sources.length;
  if (filters.role_fit_labels?.length) count += filters.role_fit_labels.length;
  if (filters.culture_fit_tiers?.length) count += filters.culture_fit_tiers.length;
  if (filters.has_email) count += 1;
  if (filters.has_competition) count += 1;
  if (filters.competition_categories?.length) {
    count += filters.competition_categories.length;
  }
  if (filters.competition_names?.length) count += filters.competition_names.length;
  if (filters.result_tiers?.length) count += filters.result_tiers.length;
  if (filters.has_por) count += 1;
  if (filters.por_categories?.length) count += filters.por_categories.length;
  if (filters.por_orgs?.length) count += filters.por_orgs.length;
  if (filters.por_leadership_only) count += 1;
  return count;
}

export function useSearch() {
  const [filters, setFilters] = useState<SearchParams>(DEFAULT_SEARCH_PARAMS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const debouncedFilters = useDebounce(filters, 300);

  const queryKey = useMemo(() => ["candidates", debouncedFilters], [debouncedFilters]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: () => searchCandidatesFn({ data: debouncedFilters }),
  });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedFilters]);

  const updateFilter = useCallback(
    <K extends keyof SearchParams>(key: K, value: SearchParams[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
        page: key === "page" ? (value as number) : 0,
      }));
    },
    [],
  );

  const updateFilters = useCallback((patch: Partial<SearchParams>) => {
    setFilters((prev) => ({
      ...prev,
      ...patch,
      page: patch.page ?? 0,
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({ ...DEFAULT_SEARCH_PARAMS });
  }, []);

  const setSort = useCallback((sortBy: SortField, sortDir: SortDirection) => {
    setFilters((prev) => ({
      ...prev,
      sort_by: sortBy,
      sort_dir: sortDir,
      page: 0,
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return {
    filters,
    debouncedFilters,
    updateFilter,
    updateFilters,
    clearAllFilters,
    activeFilterCount: computeActiveFilterCount(filters),
    results: data?.candidates ?? [],
    totalCount: data?.totalCount ?? 0,
    page: data?.page ?? filters.page ?? 0,
    limit: data?.limit ?? filters.limit ?? 50,
    isLoading,
    isFetching,
    error,
    refetch,
    selectedIds,
    toggleSelect,
    clearSelection,
    setSort,
    setPage,
  };
}
