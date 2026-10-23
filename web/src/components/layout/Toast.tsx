import { type Component, For } from "solid-js";
import { useNotifications } from "~/stores";

export const Toast: Component = () => {
  const notifications = useNotifications();

  return (
    <div class="container is-max-tablet toast-container">
      <For each={notifications.getItems()}>
        {(item) => (
          <div
            role="alert"
            class="notification"
            classList={{
              "is-info": item.type === "info",
              "is-warning": item.type === "warning",
              "is-danger": item.type === "error",
            }}
            onClick={() => notifications.removeItem(item.id)}
          >
            <button class="delete" type="button" aria-label="Cerrar" />
            {item.title}
          </div>
        )}
      </For>
    </div>
  );
};
