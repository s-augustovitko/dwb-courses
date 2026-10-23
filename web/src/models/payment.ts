export type PaymentConfig = {
  enabled: boolean;
  provider: "culqi";
  publicKey: string;
  rsaId: string;
  rsaPublicKey: string;
};

export type PayStatus =
  | "PAID"
  | "REQUIRES_AUTHENTICATION"
  | "FAILED"
  | "PROCESSING";

export type PayResponse = { status: PayStatus; message: string };
