import { createMemo, createSignal } from "solid-js";

const PAGE_SIZE = 25;
export type SortDir = "asc" | "desc";
type SearchField<T> = keyof T | ((item: T) => string);

const localFilterData = <T extends Record<string, unknown>>(
  data: T[] = [],
  fields: SearchField<T>[],
  search: string,
): T[] => {
  const lowerCaseSearch = search.trim().toLowerCase();

  return data.filter((item) =>
    fields.some((field) => {
      const value = typeof field === "function" ? field(item) : item[field];
      return String(value).toLowerCase().includes(lowerCaseSearch);
    }),
  );
};

const localSortData = <T extends Record<string, unknown>>(
  data: T[],
  key: keyof T | "",
  dirName: "asc" | "desc",
): T[] => {
  const list = [...data];
  if (key === "") {
    return list;
  }
  const dir = dirName === "asc" ? 1 : -1;

  return list.sort((a, b) => {
    const av = a[key];
    const bv = b[key];

    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dir;
    }
    return String(av).localeCompare(String(bv)) * dir;
  });
};

export const sortIndicator = <T>(
  sortKey: T | "",
  key: T,
  sortDir: SortDir,
): string => {
  if (sortKey !== key) {
    return "";
  }
  return sortDir === "asc" ? "▲" : "▼";
};

const localPagingTotalPages = <T>(data: T[]) =>
  Math.max(1, Math.ceil(data.length / PAGE_SIZE));

const localPagingData = <T>(data: T[], page: number) => {
  const start = (page - 1) * PAGE_SIZE;
  return data.slice(start, start + PAGE_SIZE);
};

export function createLocalTable<T extends Record<string, unknown>>(
  data: () => T[] | undefined,
  searchFields: SearchField<T>[],
) {
  const [search, setSearchText] = createSignal("");
  const [sortKey, setSortKey] = createSignal<keyof T | "">("");
  const [sortDir, setSortDir] = createSignal<SortDir>("asc");
  const [page, setPage] = createSignal(1);

  const sorted = createMemo(() =>
    localSortData(
      localFilterData(data(), searchFields, search()),
      sortKey(),
      sortDir(),
    ),
  );
  const totalPages = createMemo(() => localPagingTotalPages(sorted()));
  const currentPage = createMemo(() => Math.min(page(), totalPages()));
  const paged = createMemo(() => localPagingData(sorted(), currentPage()));

  function setSearch(value: string) {
    setSearchText(value);
    setPage(1);
  }

  function sortBy(key: keyof T) {
    if (sortKey() !== key) {
      setSortKey(() => key);
      setSortDir("asc");
    } else if (sortDir() === "asc") {
      setSortDir("desc");
    } else {
      setSortKey("");
      setSortDir("asc");
    }
    setPage(1);
  }

  return {
    search,
    setSearch,
    sortKey,
    sortDir,
    sortBy,
    page: currentPage,
    setPage,
    paged,
    totalPages,
  };
}

export function toggleValue(
  values: string[],
  { value, checked }: { value: string; checked: boolean },
): string[] {
  const rest = values.filter((v) => v !== value);
  return checked ? [...rest, value] : rest;
}
