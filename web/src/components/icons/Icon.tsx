import { createSignal, type ParentComponent, Show } from "solid-js";
import { Tooltip } from "./Tooltip";

export type Props = {
  title: string;
  class?: string;
  classList?: Record<string, boolean>;
  /** Hide the icon from screen readers when the button already has a text label. */
  decorative?: boolean;
};

export const Icon: ParentComponent<Props> = (props) => {
  const [hoveredRect, setHoveredRect] = createSignal<DOMRect | null>(null);

  return (
    <Show
      when={!props.decorative}
      fallback={
        <span
          class={`icon ${props.class ?? ""}`}
          classList={props.classList}
          aria-hidden="true"
        >
          {props.children}
        </span>
      }
    >
      <span
        class={`icon ${props.class ?? ""}`}
        classList={props.classList}
        role="img"
        aria-label={props.title}
        onMouseEnter={(event) =>
          setHoveredRect(event.currentTarget.getBoundingClientRect())
        }
        onMouseLeave={() => setHoveredRect(null)}
      >
        {props.children}
      </span>
      <Show when={hoveredRect()}>
        {(rect) => <Tooltip text={props.title} anchor={rect()} />}
      </Show>
    </Show>
  );
};
