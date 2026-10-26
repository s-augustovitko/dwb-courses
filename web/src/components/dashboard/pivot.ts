import { statusText } from "~/components/registration-admin";
import {
  type DietaryPreference,
  dietaryLabels,
  type RegistrationStatus,
} from "~/models";
import type { Color } from "~/utils";

/** A Bulma color; dark adds a fifth color that stays apart from the others. */
export type ChartColor = Color | "dark";

export type ChartSeries = { name: string; color: ChartColor; values: number[] };

/** One stacked column per label; groups sit side by side. */
export type ChartGroup = {
  key: string;
  name: string;
  series: ChartSeries[];
  /** Tooltip text of a value; the plain number when absent. */
  formatValue?: (value: number) => string;
};

export type ChartData = { labels: string[]; groups: ChartGroup[] };

type Category<Key> = { key: Key; name: string; color: ChartColor };

const status = (
  key: RegistrationStatus,
  color: ChartColor,
): Category<RegistrationStatus> => ({ key, name: statusText(key), color });

/** The statuses the dashboard counts: DRAFT and CANCELLED are left out. */
export const STATUS_SERIES = [
  status("PENDING", "warning"),
  status("PARTIALLY_PAID", "info"),
  status("PAID", "success"),
  status("PARTIALLY_REFUNDED", "link"),
  status("REFUNDED", "dark"),
];

export const DIETARY_SERIES: Category<DietaryPreference | "">[] = [
  { key: "REGULAR", name: dietaryLabels.REGULAR, color: "info" },
  { key: "VEGETARIAN", name: dietaryLabels.VEGETARIAN, color: "success" },
  { key: "", name: "Sin preferencia", color: "warning" },
];

type PivotConfig<Row, Key> = {
  labelKey: (row: Row) => string;
  label: (row: Row) => string;
  /** Splits each label into side-by-side columns; one column when absent. */
  groupKey?: (row: Row) => string;
  groupName?: (row: Row) => string;
  seriesKey: (row: Row) => Key;
  value: (row: Row) => number;
  categories: Category<Key>[];
};

/** Adds the key on first sight and returns its index, so the order follows the rows. */
function indexOf(index: Map<string, number>, key: string) {
  const found = index.get(key);
  if (found !== undefined) return found;

  index.set(key, index.size);
  return index.size - 1;
}

/** Groups flat rows into labels (in row order), each split into groups stacked by category. */
export function pivot<Row, Key>(
  rows: Row[],
  config: PivotConfig<Row, Key>,
): ChartData {
  const labelIndex = new Map<string, number>();
  const groupIndex = new Map<string, number>();
  const labels: string[] = [];
  const groups: ChartGroup[] = [];

  for (const row of rows) {
    if (indexOf(labelIndex, config.labelKey(row)) === labels.length) {
      labels.push(config.label(row));
    }

    const groupKey = config.groupKey?.(row) ?? "";
    if (indexOf(groupIndex, groupKey) === groups.length) {
      groups.push({
        key: groupKey,
        name: config.groupName?.(row) ?? "",
        series: [],
      });
    }
  }

  for (const group of groups) {
    group.series = config.categories.map((category) => ({
      name: category.name,
      color: category.color,
      values: labels.map(() => 0),
    }));
  }

  for (const row of rows) {
    const seriesIndex = config.categories.findIndex(
      (category) => category.key === config.seriesKey(row),
    );
    if (seriesIndex < 0) continue;

    const group = groups[indexOf(groupIndex, config.groupKey?.(row) ?? "")];
    const label = indexOf(labelIndex, config.labelKey(row));
    group.series[seriesIndex].values[label] += config.value(row);
  }

  return { labels, groups };
}

/** Adds the form title when rows span several forms, so equal names stay apart. */
export function itemLabel(rows: { formTitle: string }[]) {
  const manyForms = new Set(rows.map((row) => row.formTitle)).size > 1;

  return (row: { name: string; formTitle: string }) =>
    manyForms ? `${row.name} - ${row.formTitle}` : row.name;
}
