import { type Component, Show } from "solid-js";
import { IconInfo } from "~/components/icons";

/** Info icon that shows the hint on hover; renders nothing without a hint. */
export const HintIcon: Component<{ hint?: string }> = (props) => (
  <Show when={props.hint}>
    {(hint) => <IconInfo title={hint()} class="has-text-info" />}
  </Show>
);
