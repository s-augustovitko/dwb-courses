import { type Component, For } from "solid-js";

const DEFAULT_ROWS = 5;

export const LinesSkeleton: Component<{ lines?: number }> = (props) => (
  <div
    class="skeleton-lines"
    role="status"
    aria-busy="true"
    aria-label="Cargando"
  >
    <For each={Array.from({ length: props.lines ?? 3 })}>{() => <div />}</For>
  </div>
);

export const TableSkeleton: Component<{ rows?: number }> = (props) => (
  <div
    class="table-container"
    role="status"
    aria-busy="true"
    aria-label="Cargando"
  >
    <table class="table is-fullwidth">
      <tbody>
        <For each={Array.from({ length: props.rows ?? DEFAULT_ROWS })}>
          {() => (
            <tr>
              <td>
                <LinesSkeleton lines={1} />
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
);

export const PageSkeleton: Component = () => (
  <div
    class="container is-widescreen"
    role="status"
    aria-busy="true"
    aria-label="Cargando"
  >
    <div class="columns">
      <div class="column is-4">
        <LinesSkeleton lines={1} />
      </div>
    </div>
    <TableSkeleton />
  </div>
);
