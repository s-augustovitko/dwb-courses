import {
  type Accessor,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
} from "solid-js";
import type { ChartColor } from "./pivot";

const SERIES_LETTERS = "abcdefghij";

export const CHART_HEIGHT = "300px";

/** Chartist's class of the series at the index; it takes its color from seriesColors. */
export const seriesClass = (index: number) =>
  `ct-series-${SERIES_LETTERS[index]}`;

/** Maps each series to its Bulma color through Chartist's --ct-series-* properties. */
export const seriesColors = (colors: ChartColor[]): JSX.CSSProperties =>
  Object.fromEntries(
    colors.map((color, index) => [
      `--ct-series-${SERIES_LETTERS[index]}`,
      `var(--bulma-${color})`,
    ]),
  );

/** The container's width, kept in sync: Chartist measures it only once, which can be before the page lays it out. */
export function createContainerWidth(
  container: Accessor<HTMLElement | undefined>,
) {
  const [width, setWidth] = createSignal(0);

  createEffect(() => {
    const element = container();
    if (!element) return;

    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(element);
    onCleanup(() => observer.disconnect());
  });

  return width;
}

const TOOLTIP_OFFSET_PX = 12;

/** Where a tooltip sits; it opens leftward on the right half so it stays inside. */
export type TooltipPosition = { x: number; y: number; alignRight: boolean };

/** The tooltip's position next to the mouse, relative to the wrapper. */
export function tooltipPosition(
  wrapper: HTMLElement,
  event: MouseEvent,
): TooltipPosition {
  const bounds = wrapper.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const alignRight = x > bounds.width / 2;

  return {
    x: alignRight
      ? bounds.width - x + TOOLTIP_OFFSET_PX
      : x + TOOLTIP_OFFSET_PX,
    y: event.clientY - bounds.top + TOOLTIP_OFFSET_PX,
    alignRight,
  };
}
