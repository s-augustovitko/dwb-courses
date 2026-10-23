import { errorText } from "./api";

type OptimisticNotifier = {
  info: (message: string) => void;
  error: (message: string) => void;
};

/* Runs the action behind an update the caller already applied locally; rolls it back on failure. */
export async function runOptimistic<T>(params: {
  action: () => Promise<T>;
  rollback: () => void;
  notify: OptimisticNotifier;
  onSuccess?: (result: T) => void;
  successMessage?: string;
}): Promise<T | undefined> {
  let result: T;
  try {
    result = await params.action();
  } catch (err) {
    params.notify.error(errorText(err));
    params.rollback();
    return undefined;
  }

  params.onSuccess?.(result);
  if (params.successMessage) {
    params.notify.info(params.successMessage);
  }
  return result;
}
