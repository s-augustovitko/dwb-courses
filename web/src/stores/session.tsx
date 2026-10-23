import {
  createContext,
  createResource,
  onCleanup,
  type ParentProps,
  useContext,
} from "solid-js";
import {
  isApiError,
  Method,
  request,
  runAction,
  setUnauthorizedHandler,
} from "~/utils";
import { useNotifications } from "./notification";

type Permission = "READ" | "WRITE" | "ADMIN";

type ValidateResponse = {
  id: string;
  permissions: Permission[];
};

async function checkSession(): Promise<ValidateResponse | null> {
  try {
    return await request<ValidateResponse>("auth/validate", Method.GET);
  } catch (err) {
    if (isApiError(err, "UNAUTHORIZED")) return null;
    throw err;
  }
}

function createSessionStore() {
  const notifications = useNotifications();

  const [session, { refetch }] = createResource(checkSession);

  // A 401 means the session expired: re-validate so the login form shows. Not
  // while a check runs, since auth/validate itself answers 401 when logged out.
  setUnauthorizedHandler(() => {
    if (session.state === "ready" && session()) refetch();
  });
  onCleanup(() => setUnauthorizedHandler(undefined));

  // Getters read `latest`: only the first check suspends the page, refetches don't.
  const hasPermission = (permission: Permission) =>
    session.latest?.permissions.includes(permission) ?? false;

  return {
    isLoggedIn(): boolean {
      return Boolean(session.latest);
    },
    userId(): string | undefined {
      return session.latest?.id;
    },
    canWrite(): boolean {
      return hasPermission("WRITE");
    },
    canAdmin(): boolean {
      return hasPermission("ADMIN");
    },
    async logOut() {
      // An already expired session is a successful logout.
      await runAction({
        action: () =>
          request<null>("auth/logout", Method.DELETE).catch((err) => {
            if (!isApiError(err, "UNAUTHORIZED")) throw err;
            return null;
          }),
        notify: notifications,
        onSuccess: () => refetch(),
      });
    },
    refetch,
  };
}

type SessionStore = ReturnType<typeof createSessionStore>;

const SessionContext = createContext<SessionStore>();

export function SessionProvider(props: ParentProps) {
  const store = createSessionStore();

  return (
    <SessionContext.Provider value={store}>
      {props.children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionStore {
  const ctx = useContext(SessionContext);

  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return ctx;
}
