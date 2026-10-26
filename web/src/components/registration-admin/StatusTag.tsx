import type { Component } from "solid-js";
import type { RegistrationStatus } from "~/models";

const LABELS: Record<RegistrationStatus, { text: string; color: string }> = {
  DRAFT: { text: "Borrador", color: "is-light" },
  PENDING: { text: "Pendiente", color: "is-warning" },
  PARTIALLY_PAID: { text: "Pago parcial", color: "is-info" },
  PAID: { text: "Pagado", color: "is-success" },
  PARTIALLY_REFUNDED: { text: "Reembolso parcial", color: "is-link is-light" },
  REFUNDED: { text: "Reembolsado", color: "is-link" },
  CANCELLED: { text: "Cancelado", color: "is-danger" },
};

export const StatusTag: Component<{ status: RegistrationStatus }> = (props) => (
  <span class={`tag ${LABELS[props.status].color}`}>
    {LABELS[props.status].text}
  </span>
);

export const statusText = (status: RegistrationStatus) => LABELS[status].text;

export const STATUS_OPTIONS = (Object.keys(LABELS) as RegistrationStatus[]).map(
  (value) => ({ value, label: LABELS[value].text }),
);
