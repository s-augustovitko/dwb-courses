import { type Component, For, type JSX, splitProps } from "solid-js";
import "./Switch.css";
import { type Color, colorClass } from "~/utils";
import type { SelectOption } from "./Select";

export type SwitchGroupOption = SelectOption & {
  subtitle?: string;
  disabled?: boolean;
};

type Props = {
  options: SwitchGroupOption[];
  label?: string;
  hint?: string;
  error?: string;
  color?: Color;
  required?: boolean;
  value?: string[];
  disabled?: boolean;
  name: string;
  ref?: (element: HTMLInputElement) => void;
  onInput?: JSX.EventHandler<HTMLInputElement, InputEvent>;
  onChange?: JSX.EventHandler<HTMLInputElement, Event>;
  onBlur?: JSX.EventHandler<HTMLInputElement, FocusEvent>;
};

export const SwitchGroup: Component<Props> = (props) => {
  const [, inputProps] = splitProps(props, [
    "options",
    "label",
    "hint",
    "error",
    "color",
    "value",
    "required",
    "disabled",
  ]);

  return (
    <fieldset
      class="field"
      aria-invalid={Boolean(props.error)}
      aria-errormessage={props.error ? `${props.name}-error` : undefined}
      aria-describedby={
        props.hint && !props.error ? `${props.name}-hint` : undefined
      }
    >
      <legend class="label">
        {props.label} {props.required ? <span>*</span> : ""}
      </legend>

      <For each={props.options}>
        {(option) => (
          <div class="control mb-2">
            <label class={`switch ${colorClass(props)}`}>
              <input
                {...inputProps}
                type="checkbox"
                value={option.value}
                checked={props.value?.includes(option.value) ?? false}
                disabled={props.disabled || option.disabled}
              />

              <span class="switch-slider" aria-hidden="true" />
              <span class="switch-label">
                {option.label}
                {option.subtitle && (
                  <small class="help is-block has-text-grey mt-0">
                    {option.subtitle}
                  </small>
                )}
              </span>
            </label>
          </div>
        )}
      </For>

      {props.error && (
        <small class="help is-danger" id={`${props.name}-error`}>
          {props.error}
        </small>
      )}
      {props.hint && !props.error && (
        <small class="help" id={`${props.name}-hint`}>
          {props.hint}
        </small>
      )}
    </fieldset>
  );
};
