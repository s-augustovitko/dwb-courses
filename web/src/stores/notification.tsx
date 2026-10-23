import {
  createContext,
  createUniqueId,
  type ParentProps,
  useContext,
} from "solid-js";
import { createStore } from "solid-js/store";

export type NotificationItem = {
  id: string;
  title: string;
  type: "info" | "warning" | "error";
};

function createNotificationStore() {
  const [store, setStore] = createStore<NotificationItem[]>([]);

  function removeItem(id: string) {
    setStore((items) => items.filter((i) => i.id !== id));
  }

  function addItem(item: Omit<NotificationItem, "id">) {
    const id = createUniqueId();

    const notification: NotificationItem = {
      id,
      ...item,
    };

    setStore(store.length, notification);

    setTimeout(() => {
      removeItem(id);
    }, 5000);

    return id;
  }

  return {
    getItems(): NotificationItem[] {
      return store;
    },
    removeItem(id: string) {
      removeItem(id);
    },
    info(title: string) {
      return addItem({
        title,
        type: "info",
      });
    },
    warning(title: string) {
      return addItem({
        title,
        type: "warning",
      });
    },
    error(title: string) {
      return addItem({
        title,
        type: "error",
      });
    },
  };
}

type NotificationStore = ReturnType<typeof createNotificationStore>;

const NotificationContext = createContext<NotificationStore>();

export function NotificationProvider(props: ParentProps) {
  const store = createNotificationStore();

  return (
    <NotificationContext.Provider value={store}>
      {props.children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationStore {
  const ctx = useContext(NotificationContext);

  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }

  return ctx;
}
