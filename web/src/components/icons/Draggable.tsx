import type { Component } from "solid-js";
import { Icon, type Props } from "./Icon";

export const IconDraggable: Component<Props> = (props) => {
  return (
    <Icon {...props}>
      <svg
        fill="currentColor"
        viewBox="0 0 24 24"
        color="currentColor"
        height="1em"
        width="1em"
        xmlns="http://www.w3.org/2000/svg"
        style="overflow: visible;"
      >
        <path
          fill="currentColor"
          d="M8.5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm1.5 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM15.5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm1.5 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-1.5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        />
      </svg>
    </Icon>
  );
};
