import { ApiError } from "~/utils";

export type CardToken = { id: string; email: string };

/** The cardholder authentication result forwarded to the server; xid and the directory server id do not exist on every 3DS version. */
export type ThreeDSParameters = {
  eci: string;
  cavv: string;
  protocolVersion: string;
  xid?: string;
  directoryServerTransactionId?: string;
};

export type CheckoutRequest = {
  title: string;
  amountCents: number;
  currencyCode: string;
};

export type AuthenticationRequest = {
  tokenId: string;
  amountCents: number;
  currencyCode: string;
  email: string;
};

/** What the UI needs from a payment provider; nothing outside payments/ may touch a provider's globals. */
export interface PaymentProvider {
  prepare(signal: AbortSignal): Promise<string>;
  collectCard(
    request: CheckoutRequest,
    signal: AbortSignal,
  ): Promise<CardToken>;
  authenticate(
    request: AuthenticationRequest,
    signal: AbortSignal,
  ): Promise<ThreeDSParameters>;
}

export class PaymentError extends ApiError {
  constructor(message: string) {
    super("PAYMENT", message);
    this.name = "PaymentError";
  }
}
