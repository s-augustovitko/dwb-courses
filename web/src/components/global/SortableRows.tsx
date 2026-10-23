import { DragDropProvider } from "@dnd-kit/solid";
import { isSortable, useSortable } from "@dnd-kit/solid/sortable";
import { For, type JSX, type ParentComponent, Show } from "solid-js";
import { IconDraggable } from "~/components/icons";

type Props<T> = {
  items: T[];
  getId: (item: T) => string;
  canSort: boolean;
  colSpan: number;
  emptyText: string;
  onReorder: (items: T[]) => void;
  children: (item: T) => JSX.Element;
};

/** Table rows that can be reordered by dragging; renders inside a tbody. */
export function SortableRows<T>(props: Props<T>): JSX.Element {
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const { source } = event.operation;
        if (!isSortable(source) || source.initialIndex === source.index) {
          return;
        }

        const next = [...props.items];
        const [moved] = next.splice(source.initialIndex, 1);
        next.splice(source.index, 0, moved);

        props.onReorder(next);
      }}
    >
      <For
        each={props.items}
        fallback={
          <tr>
            <td colSpan={props.colSpan + (props.canSort ? 1 : 0)}>
              {props.emptyText}
            </td>
          </tr>
        }
      >
        {(item, index) => (
          <SortableRow
            id={props.getId(item)}
            index={index()}
            canSort={props.canSort}
          >
            {props.children(item)}
          </SortableRow>
        )}
      </For>
    </DragDropProvider>
  );
}

const SortableRow: ParentComponent<{
  id: string;
  index: number;
  canSort: boolean;
}> = (props) => {
  const { isDragging, ref } = useSortable({
    get disabled() {
      return !props.canSort;
    },
    get id() {
      return props.id;
    },
    get index() {
      return props.index;
    },
  });

  return (
    <tr ref={ref} classList={{ "has-background-light": isDragging() }}>
      <Show when={props.canSort}>
        <td>
          <IconDraggable title="Arrastrable" class="is-size-5 is-clickable" />
        </td>
      </Show>
      {props.children}
    </tr>
  );
};
