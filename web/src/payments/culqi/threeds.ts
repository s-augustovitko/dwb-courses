import { loadScript } from "../scripts";
import {
  type AuthenticationRequest,
  PaymentError,
  type ThreeDSParameters,
} from "../types";
import { ABORTED, NOT_LOADED } from "./errors";

const THREEDS_URL = "https://3ds.culqi.com";
const AUTH_CANCELLED = "Autenticación cancelada";
const AUTH_FAILED = "No se pudo autenticar la tarjeta";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Culqi3DSApi = {
  publicKey: string;
  settings: unknown;
  options: unknown;
  generateDevice: () => Promise<string | null>;
  initAuthentication: (tokenId: string) => void;
  reset: () => void;
};

declare global {
  interface Window {
    Culqi3DS?: Culqi3DSApi;
  }
}

const REQUIRED_FIELDS = ["eci", "cavv", "protocolVersion"] as const;
const OPTIONAL_FIELDS = ["xid", "directoryServerTransactionId"] as const;

function isText(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/** Validates the 3DS payload and drops the optional fields Culqi leaves empty (they only exist on some 3DS versions). */
function parseParameters(value: unknown): ThreeDSParameters | null {
  if (typeof value !== "object" || value === null) return null;
  const fields = value as Record<string, unknown>;

  if (!REQUIRED_FIELDS.every((key) => isText(fields[key]))) return null;

  const parameters = Object.fromEntries(
    [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]
      .filter((key) => isText(fields[key]))
      .map((key) => [key, fields[key]]),
  );
  return parameters as ThreeDSParameters;
}

export async function loadThreeDS(publicKey: string): Promise<string> {
  await loadScript(THREEDS_URL);

  const threeDS = window.Culqi3DS;
  if (!threeDS) throw new PaymentError(NOT_LOADED);

  threeDS.publicKey = publicKey;
  const deviceId = await threeDS.generateDevice();
  if (!deviceId || !UUID_V4.test(deviceId)) throw new PaymentError(NOT_LOADED);

  return deviceId;
}

export function runAuthentication(
  request: AuthenticationRequest,
  signal: AbortSignal,
): Promise<ThreeDSParameters> {
  return new Promise<ThreeDSParameters>((resolve, reject) => {
    if (signal.aborted) return reject(ABORTED());

    const threeDS = window.Culqi3DS;
    if (!threeDS) return reject(new PaymentError(NOT_LOADED));

    let settled = false;
    const finish = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      signal.removeEventListener("abort", onAbort);
      try {
        threeDS.reset();
      } finally {
        outcome();
      }
    };
    const onAbort = () => finish(() => reject(ABORTED()));

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data as {
        parameters3DS?: unknown;
        error?: unknown;
      } | null;

      if (data?.parameters3DS !== undefined) {
        const parameters = parseParameters(data.parameters3DS);
        finish(() =>
          parameters
            ? resolve(parameters)
            : reject(new PaymentError(AUTH_FAILED)),
        );
      } else if (data?.error) {
        finish(() => reject(new PaymentError(AUTH_FAILED)));
      }
    };

    window.addEventListener("message", onMessage);
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      threeDS.reset();
      threeDS.options = {
        showModal: true,
        showLoading: true,
        showIcon: true,
        closeModalAction: () =>
          finish(() => reject(new PaymentError(AUTH_CANCELLED))),
      };
      // The return URL goes to Culqi and the bank, so it must never carry the registration token.
      threeDS.settings = {
        charge: {
          totalAmount: request.amountCents,
          currency: request.currencyCode,
          returnUrl: window.location.origin,
        },
        card: { email: request.email },
      };
      threeDS.initAuthentication(request.tokenId);
    } catch {
      finish(() => reject(new PaymentError(AUTH_FAILED)));
    }
  });
}
