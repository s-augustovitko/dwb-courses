import { createForm, reset, valiForm } from "@modular-forms/solid";
import { type Component, createEffect, Show } from "solid-js";
import * as v from "valibot";
import {
  Input,
  Modal,
  ModalFooter,
  MultiSelect,
  type SelectOption,
  Switch,
  TextArea,
} from "~/components/global";
import type { Form as FormModel } from "~/models";
import { multilineText, requiredText } from "~/utils";

const updateFormSchema = v.object({
  title: requiredText(200),
  description: multilineText(2000),

  showArrivalAndDeparture: v.boolean(),
  showInsurance: v.boolean(),
  showEmergencyContact: v.boolean(),

  disableSessionSelection: v.boolean(),
  disableMealSelection: v.boolean(),
  disableDonation: v.boolean(),
});

// Currencies and the enabled flag are only set on create; afterwards they have
// their own endpoints, so the update schema must not validate them.
const createFormSchema = v.object({
  ...updateFormSchema.entries,
  isEnabled: v.boolean(),
  currencies: v.pipe(
    v.array(v.pipe(v.string(), v.regex(/^[A-Z]{3}$/))),
    v.minLength(1, "Selecciona al menos una moneda"),
    v.maxLength(20, "Máximo 20 monedas"),
    v.check(
      (items) => new Set(items).size === items.length,
      "Las monedas no deben repetirse",
    ),
  ),
});

export type UpdateFormSchema = v.InferOutput<typeof updateFormSchema>;
export type CreateFormSchema = v.InferOutput<typeof createFormSchema>;

type Props = {
  open: boolean;
  currencyOptions: SelectOption[];
  onClose: () => void;
} & (
  | { form: null; onSubmit: (values: CreateFormSchema) => Promise<void> }
  | { form: FormModel; onSubmit: (values: UpdateFormSchema) => Promise<void> }
);

export const CreateUpdateFormModal: Component<Props> = (props) => {
  const [form, { Form, Field }] = createForm<CreateFormSchema>({
    validate: (values) =>
      props.form
        ? valiForm(updateFormSchema)(values)
        : valiForm(createFormSchema)(values),
    validateOn: "change",
  });

  createEffect(() => {
    if (props.open) {
      reset(form, {
        initialValues: {
          title: props.form?.title ?? "",
          description: props.form?.description ?? "",
          showArrivalAndDeparture: props.form?.showArrivalAndDeparture ?? false,
          showInsurance: props.form?.showInsurance ?? false,
          showEmergencyContact: props.form?.showEmergencyContact ?? false,
          disableSessionSelection: props.form?.disableSessionSelection ?? false,
          disableMealSelection: props.form?.disableMealSelection ?? false,
          disableDonation: props.form?.disableDonation ?? false,
          isEnabled: props.form?.isEnabled ?? true,
          currencies: props.form?.currencies.map((c) => c.code) ?? [],
        },
      });
    }
  });

  const handleSubmit = async (values: Partial<CreateFormSchema>) => {
    if (props.form === null) {
      await props.onSubmit(v.parse(createFormSchema, values));
    } else {
      await props.onSubmit(v.parse(updateFormSchema, values));
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Modal
        open={props.open}
        title={props.form ? `Editar ${props.form.title}` : "Crear formulario"}
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel={props.form ? "Guardar" : "Crear"}
            loading={form.submitting}
            onCancel={props.onClose}
          />
        }
      >
        <Field name="isEnabled" type="boolean">
          {(field, fieldProps) => (
            <Show when={!props.form}>
              <Switch
                {...fieldProps}
                color="success"
                error={field.error}
                checked={field.value}
                label="Crear formulario como activo"
                disabled={form.submitting}
              />
            </Show>
          )}
        </Field>

        <Field name="title">
          {(field, fieldProps) => (
            <Input
              {...fieldProps}
              value={field.value}
              error={field.error}
              required
              label="Título"
              disabled={form.submitting}
            />
          )}
        </Field>

        <Field name="description">
          {(field, fieldProps) => (
            <TextArea
              {...fieldProps}
              value={field.value}
              error={field.error}
              label="Descripción"
              disabled={form.submitting}
            />
          )}
        </Field>

        <Field name="currencies" type="string[]">
          {(field, fieldProps) => (
            <Show when={!props.form}>
              <MultiSelect
                {...fieldProps}
                value={field.value}
                error={field.error}
                required
                label="Monedas"
                options={props.currencyOptions}
                disabled={form.submitting}
              />
            </Show>
          )}
        </Field>

        <h2 class="subtitle">Opciones avanzadas</h2>

        <Field name="disableSessionSelection" type="boolean">
          {(field, fieldProps) => (
            <Switch
              {...fieldProps}
              color="danger"
              error={field.error}
              checked={field.value}
              label="Deshabilitar selección de sesiones"
              disabled={form.submitting}
            />
          )}
        </Field>

        <Field name="disableMealSelection" type="boolean">
          {(field, fieldProps) => (
            <Switch
              {...fieldProps}
              color="danger"
              error={field.error}
              checked={field.value}
              label="Deshabilitar selección de comidas"
              disabled={form.submitting}
            />
          )}
        </Field>

        <Field name="disableDonation" type="boolean">
          {(field, fieldProps) => (
            <Switch
              {...fieldProps}
              color="danger"
              error={field.error}
              checked={field.value}
              label="Deshabilitar donaciones"
              disabled={form.submitting}
            />
          )}
        </Field>

        <h2 class="subtitle">Cursos internacionales</h2>

        <Field name="showArrivalAndDeparture" type="boolean">
          {(field, fieldProps) => (
            <Switch
              {...fieldProps}
              error={field.error}
              checked={field.value}
              disabled={form.submitting}
              label="Mostrar campo de fechas de llegada y partida"
            />
          )}
        </Field>

        <Field name="showInsurance" type="boolean">
          {(field, fieldProps) => (
            <Switch
              {...fieldProps}
              error={field.error}
              checked={field.value}
              disabled={form.submitting}
              label="Mostrar campos de seguro"
            />
          )}
        </Field>

        <Field name="showEmergencyContact" type="boolean">
          {(field, fieldProps) => (
            <Switch
              {...fieldProps}
              error={field.error}
              checked={field.value}
              disabled={form.submitting}
              label="Mostrar campos de contacto de emergencia"
            />
          )}
        </Field>
      </Modal>
    </Form>
  );
};
