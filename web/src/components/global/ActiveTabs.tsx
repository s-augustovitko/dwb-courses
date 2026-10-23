import { A, useSearchParams } from "@solidjs/router";
import type { Component } from "solid-js";

/** Reads a boolean tab query param; anything but "false" means enabled. */
export function useActiveParam(param: string): () => boolean {
  const [searchParams] = useSearchParams();
  return () => searchParams[param] !== "false";
}

export const ActiveTabs: Component<{ param: string }> = (props) => {
  const [searchParams] = useSearchParams();
  const isActive = useActiveParam(props.param);

  const href = (active: boolean) => {
    const params = new URLSearchParams(
      Object.entries(searchParams).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    params.set(props.param, String(active));
    return `?${params.toString()}`;
  };

  return (
    <div class="tabs is-boxed">
      <ul>
        <li classList={{ "is-active": isActive() }}>
          <A href={href(true)} noScroll>
            Habilitados
          </A>
        </li>
        <li classList={{ "is-active": !isActive() }}>
          <A href={href(false)} noScroll>
            Deshabilitados
          </A>
        </li>
      </ul>
    </div>
  );
};
