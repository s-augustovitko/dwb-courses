import type { Resource } from "solid-js";

export function loadedValue<T>(resource: Resource<T>): T | undefined {
  return resource.state === "ready" ? resource() : undefined;
}
