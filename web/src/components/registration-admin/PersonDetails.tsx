import { type Component, For } from "solid-js";
import { dietaryLabels, type StaffRegistration } from "~/models";
import { formatShortDate } from "~/utils";

// Travel dates are calendar dates stored at UTC midnight.
const formatUtcDate = (date: string | null) => formatShortDate(date, true);

function personRows(reg: StaffRegistration): [string, string][] {
  const rows: [string, string][] = [
    ["Documento", `${reg.idTypeLabel} ${reg.documentNumber}`],
    ["Correo", reg.email],
    ["Teléfono", `${reg.countryCode} ${reg.phoneNumber}`],
    ["Público", reg.audience === "LOCAL" ? "Local" : "Extranjero"],
    [
      "Preferencia de comida",
      reg.dietaryPreference ? dietaryLabels[reg.dietaryPreference] : "",
    ],
    ["Llegada", formatUtcDate(reg.arrivalDate)],
    ["Salida", formatUtcDate(reg.departureDate)],
    ["Seguro", `${reg.insuranceProvider} ${reg.insurancePolicyNumber}`.trim()],
    [
      "Contacto de emergencia",
      [
        reg.emergencyContactName,
        `${reg.emergencyContactCountryCode} ${reg.emergencyContactPhone}`.trim(),
        reg.emergencyContactEmail,
      ]
        .filter(Boolean)
        .join(" - "),
    ],
  ];

  return rows.filter(([, value]) => value.trim() !== "");
}

export const PersonDetails: Component<{ reg: StaffRegistration }> = (props) => (
  <table class="table is-fullwidth">
    <tbody>
      <For each={personRows(props.reg)}>
        {([label, value]) => (
          <tr>
            <th class="has-text-weight-semibold">{label}</th>
            <td class="wrap-anywhere">{value}</td>
          </tr>
        )}
      </For>
    </tbody>
  </table>
);
