import { type Component, For, Show } from "solid-js";
import { dietaryLabels, type PublicForm } from "~/models";
import { formatShortDate } from "~/utils";
import { OrderTable } from "./OrderTable";
import { estimateOrder } from "./pricing";
import type { Person, Selection } from "./validation";

type Props = {
  form: PublicForm;
  person: Person;
  selection: Selection;
};

function personRows(form: PublicForm, person: Person): [string, string][] {
  const idType = form.idTypes.find((t) => t.id === person.idTypeId);
  const rows: [string, string][] = [
    ["Nombre", `${person.firstName} ${person.lastName}`],
    ["Documento", `${idType?.label ?? ""} ${person.documentNumber}`],
    ["Correo", person.email],
    ["Teléfono", `${person.countryCode} ${person.phoneNumber}`],
    ["Llegada", formatShortDate(person.arrivalDate, true)],
    ["Salida", formatShortDate(person.departureDate, true)],
    [
      "Seguro",
      `${person.insuranceProvider} ${person.insurancePolicyNumber}`.trim(),
    ],
    [
      "Contacto de emergencia",
      [
        person.emergencyContactName,
        person.emergencyContactPhone &&
          `${person.emergencyContactCountryCode} ${person.emergencyContactPhone}`,
        person.emergencyContactEmail,
      ]
        .filter(Boolean)
        .join(" - "),
    ],
  ];

  return rows.filter(([, value]) => value.trim() !== "");
}

export const RegistrationReview: Component<Props> = (props) => {
  const currencyCode = () => props.selection.currencyCode;

  const order = () => estimateOrder(props.form, props.selection).order;
  const dietary = () =>
    order().meals.length > 0 && props.selection.dietaryPreference
      ? dietaryLabels[props.selection.dietaryPreference]
      : "";
  const currencyName = () =>
    props.form.currencies.find((c) => c.code === currencyCode())?.displayName ??
    currencyCode();

  return (
    <>
      <div class="notification is-info is-light">
        <h2 class="title is-4">Revisa tu inscripción</h2>
        <p class="subtitle is-6">
          Confirma que todo esté correcto. Si algo falta o está mal, pulsa
          "Editar".
        </p>
      </div>

      <div class="box">
        <h3 class="title is-5">Tus datos</h3>
        <table class="table is-fullwidth">
          <tbody>
            <For each={personRows(props.form, props.person)}>
              {([label, value]) => (
                <tr>
                  <th class="has-text-weight-semibold">{label}</th>
                  <td class="wrap-anywhere">{value}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>

        <h3 class="title is-5 mt-5">Tu selección</h3>
        <p class="mb-3">
          Moneda: <strong>{currencyName()}</strong>
        </p>
        <OrderTable order={order()} />
        <Show when={dietary()}>
          <p>
            Preferencia de comida: <strong>{dietary()}</strong>
          </p>
        </Show>
        <p class="help is-info">
          El total final se confirma en el siguiente paso.
        </p>
      </div>
    </>
  );
};
