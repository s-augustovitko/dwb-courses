import { type Component, type JSX, splitProps } from "solid-js";

type Props = {
  inputmode?:
    | "decimal"
    | "email"
    | "none"
    | "numeric"
    | "search"
    | "tel"
    | "text";

  name: string;
  required?: boolean;
  value?: string;

  label?: string;
  hint?: string;
  error?: string;

  disabled?: boolean;

  ref?: (element: HTMLTextAreaElement) => void;
  onInput?: JSX.EventHandler<HTMLTextAreaElement, InputEvent>;
  onChange?: JSX.EventHandler<HTMLTextAreaElement, Event>;
  onBlur?: JSX.EventHandler<HTMLTextAreaElement, FocusEvent>;
};

export const TextArea: Component<Props> = (props) => {
  const [, textAreaProps] = splitProps(props, ["label", "error", "hint"]);

  return (
    <fieldset class="field">
      <label class="label" for={props.name}>
        {props.label} {props.required ? <span>*</span> : ""}
      </label>

      <div class="control">
        <textarea
          {...textAreaProps}
          class="textarea"
          classList={{ "is-danger": Boolean(props.error) }}
          id={props.name}
          value={props.value ?? ""}
          placeholder={props.label}
          aria-invalid={Boolean(props.error)}
          aria-errormessage={props.error ? `${props.name}-error` : undefined}
          aria-describedby={
            props.hint && !props.error ? `${props.name}-hint` : undefined
          }
        />
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
