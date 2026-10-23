import { type Component, type JSX, splitProps } from "solid-js";
import "./Switch.css";
import { type Color, colorClass } from "~/utils";

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  color?: Color;
  disabled?: boolean;
  required?: boolean;
  checked?: boolean;
  name: string;
  ref?: (element: HTMLInputElement) => void;
  onInput?: JSX.EventHandler<HTMLInputElement, InputEvent>;
  onChange?: JSX.EventHandler<HTMLInputElement, Event>;
  onBlur?: JSX.EventHandler<HTMLInputElement, FocusEvent>;
};

export const Switch: Component<Props> = (props) => {
  const [, inputProps] = splitProps(props, ["label", "error", "hint", "color"]);

  return (
    <fieldset class="field">
      <div class="control">
        <label class={`switch ${colorClass(props)}`}>
          <input
            {...inputProps}
            type="checkbox"
            id={props.name}
            checked={props.checked ?? false}
            aria-invalid={Boolean(props.error)}
            aria-errormessage={props.error ? `${props.name}-error` : undefined}
            aria-describedby={
              props.hint && !props.error ? `${props.name}-hint` : undefined
            }
          />

          <span class="switch-slider" aria-hidden="true" />

          {props.label && (
            <span class="switch-label">
              {props.label} {props.required ? <span>*</span> : ""}
            </span>
          )}
        </label>
      </div>

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
