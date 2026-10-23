import type { PaymentConfig } from "~/models";
import { type CardToken, type CheckoutRequest, PaymentError } from "../types";
import { ABORTED, NOT_LOADED } from "./errors";

const CARD_ERROR = "No se pudo leer la tarjeta";

type CulqiCheckoutInstance = {
  culqi: () => void;
  token?: { id: string; email?: string };
  error?: { user_message?: string };
  open: () => void;
  close: () => void;
};

type CulqiCheckoutConstructor = new (
  publicKey: string,
  config: Record<string, unknown>,
) => CulqiCheckoutInstance;

declare global {
  interface Window {
    CulqiCheckout?: CulqiCheckoutConstructor;
  }
}

export function openCheckout(
  config: PaymentConfig,
  request: CheckoutRequest,
  signal: AbortSignal,
): Promise<CardToken> {
  return new Promise<CardToken>((resolve, reject) => {
    if (signal.aborted) return reject(ABORTED());

    const Checkout = window.CulqiCheckout;
    if (!Checkout) return reject(new PaymentError(NOT_LOADED));

    const instance = new Checkout(config.publicKey, {
      settings: {
        title: request.title,
        currency: request.currencyCode,
        amount: request.amountCents,
        ...(config.rsaId && config.rsaPublicKey
          ? { xculqirsaid: config.rsaId, rsapublickey: config.rsaPublicKey }
          : {}),
      },
      options: {
        lang: "es",
        installments: false,
        paymentMethods: {
          tarjeta: true,
          bancaMovil: false,
          agente: false,
          billetera: false,
          cuotealo: false,
          yape: false,
        },
      },
    });

    let settled = false;
    const finish = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      try {
        instance.close();
      } finally {
        outcome();
      }
    };
    const onAbort = () => finish(() => reject(ABORTED()));

    instance.culqi = () => {
      const { token, error } = instance;
      finish(() =>
        token
          ? resolve({ id: token.id, email: token.email ?? "" })
          : reject(new PaymentError(error?.user_message ?? CARD_ERROR)),
      );
    };

    signal.addEventListener("abort", onAbort, { once: true });

    try {
      instance.open();
    } catch {
      finish(() => reject(new PaymentError(NOT_LOADED)));
    }
  });
}
