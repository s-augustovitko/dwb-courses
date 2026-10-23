import type { Component } from "solid-js";

type Props = {
  title: string;
};

export const AccessDenied: Component<Props> = (props) => (
  <div class="container is-widescreen">
    <h1 class="title">{props.title}</h1>
    <p class="subtitle">No tienes acceso a esta sección</p>
  </div>
);
