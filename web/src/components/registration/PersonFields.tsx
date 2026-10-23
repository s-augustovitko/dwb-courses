import { Field, type FormStore, toUpperCase } from "@modular-forms/solid";
import { type Component, type ComponentProps, Show } from "solid-js";
import { Input, Select } from "~/components/global";
import type { PublicCountry, PublicForm } from "~/models";
import { type PersonValues, travelDateRange } from "./validation";

type Props = {
  of: FormStore<PersonValues>;
  form: PublicForm;
  countries: PublicCountry[];
  /** Set when staff edit a registration: its saved dates may lie outside the window. */
  allowStoredDates?: boolean;
};

// Writes the digits back too: when they equal the field value the input would not re-render.
const DigitsInput: Component<ComponentProps<typeof Input>> = (props) => (
  <Input
    {...props}
    inputmode="numeric"
    onInput={(event) => {
      event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
      if (typeof props.onInput === "function") props.onInput(event);
    }}
  />
);

export const PersonFields: Component<Props> = (props) => {
  const dateRange = () =>
    props.allowStoredDates
      ? { min: undefined, max: undefined }
      : travelDateRange();

  const idTypeOptions = () => [
    { value: "", label: "Selecciona" },
    ...props.form.idTypes.map((idType) => ({
      value: idType.id,
      label: idType.label,
    })),
  ];

  const countryOptions = () =>
    props.countries.map((country) => ({
      value: country.dialCode,
      label: `(${country.dialCode}) ${country.name}`,
    }));

  return (
    <>
      <div class="field grid is-col-min-10">
        <div class="cell">
          <Field of={props.of} name="idTypeId">
            {(field, fieldProps) => (
              <Select
                {...fieldProps}
                value={field.value}
                error={field.error}
                required
                label="Tipo de documento"
                options={idTypeOptions()}
              />
            )}
          </Field>
        </div>
        <div class="cell">
          <Field
            of={props.of}
            name="documentNumber"
            transform={toUpperCase({ on: "input" })}
          >
            {(field, fieldProps) => (
              <Input
                {...fieldProps}
                value={field.value}
                error={field.error}
                required
                label="Número de documento"
              />
            )}
          </Field>
        </div>
      </div>

      <div class="field grid is-col-min-10">
        <div class="cell">
          <Field of={props.of} name="firstName">
            {(field, fieldProps) => (
              <Input
                {...fieldProps}
                value={field.value}
                error={field.error}
                required
                label="Nombres"
              />
            )}
          </Field>
        </div>
        <div class="cell">
          <Field of={props.of} name="lastName">
            {(field, fieldProps) => (
              <Input
                {...fieldProps}
                value={field.value}
                error={field.error}
                required
                label="Apellidos"
              />
            )}
          </Field>
        </div>
      </div>

      <Field of={props.of} name="email">
        {(field, fieldProps) => (
          <Input
            {...fieldProps}
            value={field.value}
            error={field.error}
            required
            label="Correo electrónico"
            type="email"
            inputmode="email"
          />
        )}
      </Field>

      <div class="field grid is-col-min-10">
        <div class="cell">
          <Field of={props.of} name="countryCode">
            {(field, fieldProps) => (
              <Select
                {...fieldProps}
                value={field.value}
                error={field.error}
                required
                label="País (código)"
                options={countryOptions()}
              />
            )}
          </Field>
        </div>
        <div class="cell">
          <Field of={props.of} name="phoneNumber">
            {(field, fieldProps) => (
              <DigitsInput
                {...fieldProps}
                value={field.value}
                error={field.error}
                required
                label="Teléfono"
              />
            )}
          </Field>
        </div>
      </div>

      <Show when={props.form.showArrivalAndDeparture}>
        <div class="field grid is-col-min-10">
          <div class="cell">
            <Field of={props.of} name="arrivalDate">
              {(field, fieldProps) => (
                <Input
                  {...fieldProps}
                  value={field.value}
                  error={field.error}
                  label="Fecha de llegada (opcional)"
                  type="date"
                  min={dateRange().min}
                  max={dateRange().max}
                />
              )}
            </Field>
          </div>
          <div class="cell">
            <Field of={props.of} name="departureDate">
              {(field, fieldProps) => (
                <Input
                  {...fieldProps}
                  value={field.value}
                  error={field.error}
                  label="Fecha de salida (opcional)"
                  type="date"
                  min={dateRange().min}
                  max={dateRange().max}
                />
              )}
            </Field>
          </div>
        </div>
      </Show>

      <Show when={props.form.showInsurance}>
        <div class="field grid is-col-min-10">
          <div class="cell">
            <Field of={props.of} name="insuranceProvider">
              {(field, fieldProps) => (
                <Input
                  {...fieldProps}
                  value={field.value}
                  error={field.error}
                  label="Seguro médico (opcional)"
                />
              )}
            </Field>
          </div>
          <div class="cell">
            <Field of={props.of} name="insurancePolicyNumber">
              {(field, fieldProps) => (
                <Input
                  {...fieldProps}
                  value={field.value}
                  error={field.error}
                  label="Número de póliza (opcional)"
                />
              )}
            </Field>
          </div>
        </div>
      </Show>

      <Show when={props.form.showEmergencyContact}>
        <h3 class="title is-5 mt-5">Contacto de emergencia</h3>
        <Field of={props.of} name="emergencyContactName">
          {(field, fieldProps) => (
            <Input
              {...fieldProps}
              value={field.value}
              error={field.error}
              label="Nombre (opcional)"
            />
          )}
        </Field>
        <div class="field grid is-col-min-10">
          <div class="cell">
            <Field of={props.of} name="emergencyContactCountryCode">
              {(field, fieldProps) => (
                <Select
                  {...fieldProps}
                  value={field.value}
                  error={field.error}
                  label="País (código)"
                  options={countryOptions()}
                />
              )}
            </Field>
          </div>
          <div class="cell">
            <Field of={props.of} name="emergencyContactPhone">
              {(field, fieldProps) => (
                <DigitsInput
                  {...fieldProps}
                  value={field.value}
                  error={field.error}
                  label="Teléfono (opcional)"
                />
              )}
            </Field>
          </div>
        </div>
        <Field of={props.of} name="emergencyContactEmail">
          {(field, fieldProps) => (
            <Input
              {...fieldProps}
              value={field.value}
              error={field.error}
              label="Correo (opcional)"
              type="email"
              inputmode="email"
            />
          )}
        </Field>
      </Show>
    </>
  );
};
