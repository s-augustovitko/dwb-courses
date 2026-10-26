import {
  autoScaleAxis,
  axisGrid,
  axisLabels,
  bar,
  cartesianAxes,
  chart,
  stepAxis,
} from "chartist";
import "chartist/styles.css";
import {
  type Component,
  createEffect,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
} from "solid-js";
import { ChartTooltip } from "./ChartTooltip";
import {
  CHART_HEIGHT,
  createContainerWidth,
  seriesClass,
  seriesColors,
  type TooltipPosition,
  tooltipPosition,
} from "./chartist";
import type { ChartData, ChartGroup } from "./pivot";

type Props = {
  title: string;
  data: ChartData;
};

/** A hovered column (one group) or a hovered label (every group). */
type Hover = TooltipPosition & {
  labelIndex: number;
  groupIndex?: number;
};

const SINGLE_BAR_WIDTH_PX = 28;
const GROUPED_BAR_WIDTH_PX = 20;
const GROUP_GAP_PX = 4;
const LABEL_CHAR_PX = 7;
const MIN_LABEL_CHARS = 6;

/** Cuts a label to its column's width; the hover shows it whole. */
const fitLabel = (label: string, columnWidth: number) => {
  const maxChars = Math.max(
    MIN_LABEL_CHARS,
    Math.floor(columnWidth / LABEL_CHAR_PX),
  );
  return label.length > maxChars
    ? `${label.slice(0, maxChars - 1).trimEnd()}…`
    : label;
};

const barWidth = (data: ChartData) =>
  data.groups.length > 1 ? GROUPED_BAR_WIDTH_PX : SINGLE_BAR_WIDTH_PX;

const chartStyle = (data: ChartData): JSX.CSSProperties => ({
  "--ct-bar-width": `${barWidth(data)}px`,
  ...seriesColors((data.groups[0]?.series ?? []).map((series) => series.color)),
});

/** Every group's categories in one list; values carry "group:label" as meta for the hover. */
const chartSeries = (data: ChartData) =>
  data.groups.flatMap((group, groupIndex) =>
    group.series.map((series, seriesIndex) => ({
      name: series.name,
      className: seriesClass(seriesIndex),
      data: series.values.map((value, labelIndex) => ({
        value,
        meta: `${groupIndex}:${labelIndex}`,
      })),
    })),
  );

/** One stacked layer per group, moved apart so the groups of a label sit side by side. */
const barLayers = (data: ChartData) => {
  const spacing = barWidth(data) + GROUP_GAP_PX;
  const middle = (data.groups.length - 1) / 2;

  return data.groups.map((group, groupIndex) => {
    const first = groupIndex * group.series.length;
    return bar({
      series: group.series.map((_, seriesIndex) => first + seriesIndex),
      stackBars: true,
      offset: (groupIndex - middle) * spacing,
    });
  });
};

const columnTotal = (group: ChartGroup, labelIndex: number) =>
  group.series.reduce((sum, series) => sum + series.values[labelIndex], 0);

const formatValue = (group: ChartGroup, value: number) =>
  group.formatValue?.(value) ?? String(value);

const ColumnDetails: Component<{ group: ChartGroup; labelIndex: number }> = (
  props,
) => (
  <>
    <p class="mb-1">
      Total:{" "}
      {formatValue(props.group, columnTotal(props.group, props.labelIndex))}
    </p>
    <For
      each={props.group.series.filter(
        (series) => series.values[props.labelIndex] > 0,
      )}
    >
      {(series) => (
        <p>
          <span class={`tag is-${series.color} mr-1`} />
          {series.name}:{" "}
          {formatValue(props.group, series.values[props.labelIndex])}
        </p>
      )}
    </For>
  </>
);

export const StackedBarChart: Component<Props> = (props) => {
  let wrapper: HTMLDivElement | undefined;
  const [container, setContainer] = createSignal<HTMLDivElement>();
  const width = createContainerWidth(container);
  const [hover, setHover] = createSignal<Hover>();

  // Recreated on every change: the data is small and it keeps the chart in sync.
  createEffect(() => {
    const element = container();
    if (!element || width() === 0 || props.data.labels.length === 0) return;

    const handle = chart(element, {
      data: { labels: props.data.labels, series: chartSeries(props.data) },
      axes: cartesianAxes([
        {
          id: "label",
          side: "bottom",
          type: stepAxis(),
          ticks: props.data.labels,
          labelTransform: (label) =>
            fitLabel(String(label), width() / props.data.labels.length),
        },
        {
          id: "value",
          side: "left",
          type: autoScaleAxis(),
          low: 0,
          onlyInteger: true,
        },
      ]),
      layers: [axisGrid(), ...barLayers(props.data), axisLabels()],
      className: "ct-chart-bar",
      width: width(),
      height: CHART_HEIGHT,
    });

    onCleanup(() => handle.destroy());
  });

  /** The hovered column from a bar's meta, or the hovered label from its text. */
  function hoveredIndexes(target: Element) {
    const meta = target.closest(".ct-bar")?.getAttribute("ct:meta");
    if (meta) {
      const [groupIndex, labelIndex] = meta.split(":").map(Number);
      return { groupIndex, labelIndex };
    }

    // The X labels are drawn in label order, so equal names still resolve.
    const label = target.closest(".ct-label.ct-horizontal");
    const labelIndex = label
      ? [
          ...(container()?.querySelectorAll(".ct-label.ct-horizontal") ?? []),
        ].indexOf(label)
      : -1;
    return labelIndex >= 0 ? { labelIndex } : undefined;
  }

  function handleMouseMove(event: MouseEvent) {
    const indexes = hoveredIndexes(event.target as Element);
    if (!wrapper || !indexes) {
      setHover(undefined);
      return;
    }

    setHover({ ...indexes, ...tooltipPosition(wrapper, event) });
  }

  /** The hovered column, or every column of the label that has a value. */
  const hoveredGroups = (current: Hover) =>
    current.groupIndex === undefined
      ? props.data.groups.filter(
          (group) => columnTotal(group, current.labelIndex) !== 0,
        )
      : [props.data.groups[current.groupIndex]];

  const tooltipTitle = (current: Hover) => {
    const label = props.data.labels[current.labelIndex];
    const group =
      current.groupIndex === undefined
        ? undefined
        : props.data.groups[current.groupIndex];
    return group?.name ? `${label} · ${group.name}` : label;
  };

  return (
    <div class="box">
      <h2 class="title is-5">{props.title}</h2>

      <div class="tags">
        <For each={props.data.groups[0]?.series ?? []}>
          {(series) => (
            <span class={`tag is-light is-${series.color}`}>{series.name}</span>
          )}
        </For>
      </div>

      <Show
        when={props.data.labels.length > 0}
        fallback={<p class="has-text-grey">Sin datos</p>}
      >
        <div
          class="is-relative"
          role="img"
          aria-label={props.title}
          ref={wrapper}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(undefined)}
        >
          <div ref={setContainer} style={chartStyle(props.data)} />

          <Show when={hover()}>
            {(current) => (
              <ChartTooltip position={current()}>
                <p class="has-text-weight-bold">{tooltipTitle(current())}</p>
                <For each={hoveredGroups(current())}>
                  {(group) => (
                    <div class="mt-2">
                      <Show
                        when={current().groupIndex === undefined && group.name}
                      >
                        <p class="has-text-weight-semibold">{group.name}</p>
                      </Show>
                      <ColumnDetails
                        group={group}
                        labelIndex={current().labelIndex}
                      />
                    </div>
                  )}
                </For>
              </ChartTooltip>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
};
