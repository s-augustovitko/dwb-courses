import type { JSX } from "solid-js";
import { type SortDir, sortIndicator } from "~/utils";

type Props<K> = {
  label: string;
  column: K;
  sortKey: K | "";
  sortDir: SortDir;
  onSort: (key: K) => void;
};

export function SortHeader<K>(props: Props<K>): JSX.Element {
  const ariaSort = () => {
    if (props.sortKey !== props.column) return "none";
    return props.sortDir === "asc" ? "ascending" : "descending";
  };

  return (
    <th aria-sort={ariaSort()}>
      <button
        type="button"
        class="button is-ghost p-0 has-text-weight-semibold"
        onClick={() => props.onSort(props.column)}
      >
        {`${props.label} ${sortIndicator(props.sortKey, props.column, props.sortDir)}`}
      </button>
    </th>
  );
}
