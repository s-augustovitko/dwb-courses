import { errorText, isApiError } from "./api";

/**
 * Runs an action, notifying failures instead of throwing; undefined when it failed or was aborted.
 * On a 409, `conflictMessage` replaces the generic text and `onConflict` runs.
 */
export async function runAction<T>(params: {
  action: () => Promise<T>;
  notify: { error: (message: string) => void };
  onSuccess?: (result: T) => void;
  conflictMessage?: string;
  onConflict?: () => void;
}): Promise<T | undefined> {
  try {
    const result = await params.action();
    params.onSuccess?.(result);
    return result;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return undefined;
    }

    const conflict = isApiError(err, "CONFLICT");
    params.notify.error(
      conflict && params.conflictMessage
        ? params.conflictMessage
        : errorText(err),
    );
    if (conflict) params.onConflict?.();
    return undefined;
  }
}
