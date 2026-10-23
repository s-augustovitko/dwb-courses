import type { PaymentConfig } from "~/models";
import { createCulqiProvider } from "./culqi";
import type { PaymentProvider } from "./types";

export * from "./charge";
export * from "./location";
export * from "./types";

export function createPaymentProvider(
  config: PaymentConfig,
): PaymentProvider | null {
  if (!config.enabled) return null;

  switch (config.provider) {
    case "culqi":
      return createCulqiProvider(config);
    default:
      return null;
  }
}
