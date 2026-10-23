import type { Component, ComponentProps } from "solid-js";
import { sanitizeMoneyText } from "~/utils";
import { Input } from "./Input";

type Props = Omit<ComponentProps<typeof Input>, "type" | "inputmode" | "step">;

/** Text input that drops invalid characters and extra decimals as they are typed. */
export const MoneyInput: Component<Props> = (props) => (
  <Input
    {...props}
    type="text"
    inputmode="decimal"
    onInput={(event) => {
      const input = event.currentTarget;
      const clean = sanitizeMoneyText(input.value);
      if (clean !== input.value) {
        const caret =
          (input.selectionStart ?? clean.length) -
          (input.value.length - clean.length);
        input.value = clean;
        input.setSelectionRange(Math.max(caret, 0), Math.max(caret, 0));
      }
      if (typeof props.onInput === "function") props.onInput(event);
    }}
  />
);
