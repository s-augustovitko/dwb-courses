import type { PayResponse } from "~/models";
import type {
  CheckoutRequest,
  PaymentProvider,
  ThreeDSParameters,
} from "./types";

export type CardPayment = {
  tokenId: string;
  deviceId: string;
  authentication?: ThreeDSParameters;
};

type ChargeOptions = {
  signal: AbortSignal;
  /** True while the provider's own UI is open and the user may cancel it. */
  onCancellable: (cancellable: boolean) => void;
};

export async function chargeCard(
  provider: PaymentProvider,
  checkout: CheckoutRequest,
  submit: (payment: CardPayment) => Promise<PayResponse>,
  { signal, onCancellable }: ChargeOptions,
): Promise<PayResponse> {
  async function cancellable<T>(step: () => Promise<T>): Promise<T> {
    onCancellable(true);
    try {
      return await step();
    } finally {
      onCancellable(false);
    }
  }

  const deviceId = await cancellable(() => provider.prepare(signal));
  const card = await cancellable(() => provider.collectCard(checkout, signal));

  const result = await submit({ tokenId: card.id, deviceId });
  if (result.status !== "REQUIRES_AUTHENTICATION") return result;

  const authentication = await cancellable(() =>
    provider.authenticate(
      {
        tokenId: card.id,
        amountCents: checkout.amountCents,
        currencyCode: checkout.currencyCode,
        email: card.email,
      },
      signal,
    ),
  );
  return submit({ tokenId: card.id, deviceId, authentication });
}
