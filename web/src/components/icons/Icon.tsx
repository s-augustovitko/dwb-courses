import { type ParentComponent, Show } from "solid-js";

export type Props = {
  title: string;
  class?: string;
  classList?: Record<string, boolean>;
  /** Hide the icon from screen readers when the button already has a text label. */
  decorative?: boolean;
};

export const Icon: ParentComponent<Props> = (props) => (
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
    <abbr title={props.title}>
      <span
        class={`icon ${props.class ?? ""}`}
        classList={props.classList}
        role="img"
        aria-label={props.title}
      >
        {props.children}
      </span>
    </abbr>
  </Show>
);
