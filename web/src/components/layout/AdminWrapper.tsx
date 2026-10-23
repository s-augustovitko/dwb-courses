import { children, For, type JSX, type ParentComponent, Show } from "solid-js";
import { BackButton } from "./BackButton";

type Props = {
  title: string;
  previous?: string;
  left?: JSX.Element;
  right?: JSX.Element;
};

export const AdminWrapper: ParentComponent<Props> = (props) => {
  const resolvedLeft = children(() => props.left);
  const resolvedRight = children(() => props.right);

  return (
    <div class="container is-widescreen">
      <div class="is-flex is-align-items-center">
        <Show when={props.previous}>
          <BackButton href={props.previous || ""} iconOnly />
        </Show>

        <h1 class="title">{props.title}</h1>
      </div>

      <div class="level">
        <div class="level-left">
          <For each={resolvedLeft.toArray()}>
            {(item) => (item ? <div class="level-item">{item}</div> : null)}
          </For>
        </div>

        <div class="level-right">
          <For each={resolvedRight.toArray()}>
            {(item) => (item ? <div class="level-item">{item}</div> : null)}
          </For>
        </div>
      </div>

      {props.children}
    </div>
  );
};
