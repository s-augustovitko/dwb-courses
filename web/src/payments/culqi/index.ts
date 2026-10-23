import type { PaymentConfig } from "~/models";
import { CHECKOUT_URL } from "~/utils";
import { loadScript } from "../scripts";
import { PaymentError, type PaymentProvider } from "../types";
import { openCheckout } from "./checkout";
import { ABORTED, NOT_LOADED } from "./errors";
import { loadThreeDS, runAuthentication } from "./threeds";

/** Settles with `work`, or rejects as soon as the signal aborts (the work itself keeps running). */
function rejectOnAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(ABORTED());
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function createCulqiProvider(config: PaymentConfig): PaymentProvider {
  return {
    async prepare(signal) {
      if (!config.publicKey) throw new PaymentError(NOT_LOADED);

      const [, deviceId] = await rejectOnAbort(
        Promise.all([loadScript(CHECKOUT_URL), loadThreeDS(config.publicKey)]),
        signal,
      );
      return deviceId;
    },

    collectCard: (request, signal) => openCheckout(config, request, signal),
    authenticate: runAuthentication,
  };
}
