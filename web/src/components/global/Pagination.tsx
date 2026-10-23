import { type Component, createMemo, For, Show } from "solid-js";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

enum PageType {
  PAGE = 0,
  ELLIPSIS = 1,
}

export const Pagination: Component<Props> = (props) => {
  const pageItems = createMemo(() => {
    if (props.totalPages <= 0) {
      return [];
    }

    const items: { type: PageType; num: number | undefined }[] = [];
    const delta = 2;
    const left = Math.max(2, props.page - delta);
    const right = Math.min(props.totalPages - 1, props.page + delta);

    items.push({ type: PageType.PAGE, num: 1 });

    if (left > 2) {
      items.push({
        type: PageType.ELLIPSIS,
        num: undefined,
      });
    }

    for (let i = left; i <= right; i++) {
      items.push({
        type: PageType.PAGE,
        num: i,
      });
    }

    if (right < props.totalPages - 1) {
      items.push({
        type: PageType.ELLIPSIS,
        num: undefined,
      });
    }

    if (props.totalPages > 1) {
      items.push({
        type: PageType.PAGE,
        num: props.totalPages,
      });
    }

    return items;
  });

  return (
    <Show when={props.totalPages > 1}>
      <nav class="pagination is-centered" aria-label="Paginación">
        <button
          type="button"
          class="pagination-previous"
          disabled={props.page <= 1}
          onClick={() => props.onPageChange(props.page - 1)}
        >
          Anterior
        </button>

        <button
          type="button"
          class="pagination-next"
          disabled={props.page >= props.totalPages}
          onClick={() => props.onPageChange(props.page + 1)}
        >
          Siguiente
        </button>

        <ul class="pagination-list">
          <For each={pageItems()}>
            {(item) => (
              <li>
                <Show
                  when={item.type === PageType.PAGE}
                  fallback={<span class="pagination-ellipsis">&hellip;</span>}
                >
                  <button
                    type="button"
                    class="pagination-link"
                    classList={{ "is-current": item.num === props.page }}
                    aria-label={`Página ${item.num}`}
                    aria-current={item.num === props.page ? "page" : undefined}
                    onClick={() => props.onPageChange(item.num || 1)}
                  >
                    {item.num}
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </nav>
    </Show>
  );
};
