import { A } from "@solidjs/router";
import { type Component, Show } from "solid-js";
import { IconChevronLeft } from "~/components/icons";

type Props = {
  href: string;
  /** Replaces the navigation, e.g. to step back within the same page. */
  onSelect?: () => void;
  state?: unknown;
  iconOnly?: boolean;
};

export const BackButton: Component<Props> = (props) => (
  <A
    href={props.href}
    state={props.state}
    class="button is-text"
    classList={{ "is-small mb-4": !props.iconOnly, "mr-4": props.iconOnly }}
    onClick={(e) => {
      if (!props.onSelect) return;
      e.preventDefault();
      props.onSelect();
    }}
  >
    <Show
      when={props.iconOnly}
      fallback={
        <>
          <span class="icon">
            <IconChevronLeft title="Volver" />
          </span>
          <span>Volver</span>
        </>
      }
    >
      <IconChevronLeft title="Volver" class="is-size-5" />
    </Show>
  </A>
);
