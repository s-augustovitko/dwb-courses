import { chart, pie } from "chartist";
import "chartist/styles.css";
import {
  type Component,
  createEffect,
  createSignal,
  For,
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
import type { ChartColor } from "./pivot";

export type PieSlice = { name: string; color: ChartColor; value: number };

type Props = {
  title: string;
  slices: PieSlice[];
};

type Hover = TooltipPosition & { sliceIndex: number };

const total = (slices: PieSlice[]) =>
  slices.reduce((sum, slice) => sum + slice.value, 0);

export const PieChart: Component<Props> = (props) => {
  let wrapper: HTMLDivElement | undefined;
  const [container, setContainer] = createSignal<HTMLDivElement>();
  const width = createContainerWidth(container);
  const [hover, setHover] = createSignal<Hover>();

  // Recreated on every change: the data is small and it keeps the chart in sync.
  createEffect(() => {
    const element = container();
    if (!element || width() === 0 || total(props.slices) === 0) return;

    const handle = chart(element, {
      data: {
        series: props.slices.map((slice, index) => ({
          name: slice.name,
          className: seriesClass(index),
          value: slice.value,
          meta: String(index),
        })),
      },
      coordinates: "polar",
      layers: [pie({ ignoreEmptyValues: true })],
      className: "ct-chart-pie",
      width: width(),
      height: CHART_HEIGHT,
    });

    onCleanup(() => handle.destroy());
  });

  function handleMouseMove(event: MouseEvent) {
    const meta = (event.target as Element)
      .closest(".ct-slice-pie")
      ?.getAttribute("ct:meta");
    if (!wrapper || !meta) {
      setHover(undefined);
      return;
    }

    setHover({ sliceIndex: Number(meta), ...tooltipPosition(wrapper, event) });
  }

  return (
    <div class="box">
      <h2 class="title is-5">{props.title}</h2>

      <div class="tags">
        <For each={props.slices}>
          {(slice) => (
            <span class={`tag is-light is-${slice.color}`}>
              {slice.name}: {slice.value}
            </span>
          )}
        </For>
      </div>

      <Show
        when={total(props.slices) > 0}
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
          <div
            ref={setContainer}
            style={seriesColors(props.slices.map((slice) => slice.color))}
          />

          <Show when={hover()}>
            {(current) => {
              const slice = () => props.slices[current().sliceIndex];
              return (
                <ChartTooltip position={current()}>
                  <p class="has-text-weight-bold">
                    <span class={`tag is-${slice().color} mr-1`} />
                    {slice().name}: {slice().value}
                  </p>
                </ChartTooltip>
              );
            }}
          </Show>
        </div>
      </Show>
    </div>
  );
};
