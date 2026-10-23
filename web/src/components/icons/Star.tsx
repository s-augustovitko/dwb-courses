import type { Component } from "solid-js";
import { Icon, type Props } from "./Icon";

const STAR_PATH =
  "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

export const IconStar: Component<Props> = (props) => (
  <Icon {...props}>
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
      height="1em"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      style="overflow: visible;"
    >
      <path d={STAR_PATH} />
    </svg>
  </Icon>
);

export const IconStarFilled: Component<Props> = (props) => (
  <Icon {...props}>
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
      height="1em"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      style="overflow: visible;"
    >
      <path d={STAR_PATH} />
    </svg>
  </Icon>
);
