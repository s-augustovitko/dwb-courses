import type { Component } from "solid-js";
import { COPYRIGHT } from "~/utils";

export const Footer: Component = () => {
  return (
    <footer class="footer">
      <div class="content has-text-centered">
        <p>{COPYRIGHT}</p>
      </div>
    </footer>
  );
};
