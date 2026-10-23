import { createForm, reset, valiForm } from "@modular-forms/solid";
import { type Component, createEffect, createResource, Show } from "solid-js";
import * as v from "valibot";
import { Modal, ModalFooter } from "~/components/global";
import { LinesSkeleton } from "~/components/layout";
import {
  buildPersonPayload,
  DEFAULT_DIAL_CODE,
  PersonFields,
  type PersonValues,
  personSchema,
} from "~/components/registration";
import type { PublicCountry, PublicForm } from "~/models";
import { dateToDateInput, loadedValue, Method, request } from "~/utils";
import { useStaffAction } from "./staffAction";
import { fetchStaffForm } from "./staffForm";
import type { ActionProps } from "./types";

export const EditPersonModal: Component<ActionProps> = (props) => {
  const send = useStaffAction(props);

  const [staffForm] = createResource(
    () => (props.open ? props.reg.formId : null),
    (id) => fetchStaffForm(id).catch(() => null),
  );
  const [countries] = createResource(
    () => props.open || null,
    () =>
      request<PublicCountry[]>("public/country", Method.GET).catch(() => []),
  );

  const loadedForm = () => loadedValue(staffForm);
  const schema = (current: PublicForm) =>
    personSchema(current, {
      arrivalDate: dateToDateInput(props.reg.arrivalDate),
      departureDate: dateToDateInput(props.reg.departureDate),
    });

  const [form, { Form }] = createForm<PersonValues>({
    validate: (values) => {
      const current = loadedForm();
      return current ? valiForm<PersonValues>(schema(current))(values) : {};
    },
    validateOn: "change",
  });

  // The fields mount once the form loads, and reset only fills mounted fields.
  createEffect(() => {
    if (!props.open || !loadedForm()) return;
    const reg = props.reg;
    reset(form, {
      initialValues: {
        idTypeId: reg.idTypeId,
        documentNumber: reg.documentNumber,
        firstName: reg.firstName,
        lastName: reg.lastName,
        countryCode: reg.countryCode,
        phoneNumber: reg.phoneNumber,
        email: reg.email,
        arrivalDate: dateToDateInput(reg.arrivalDate),
        departureDate: dateToDateInput(reg.departureDate),
        insuranceProvider: reg.insuranceProvider,
        insurancePolicyNumber: reg.insurancePolicyNumber,
        emergencyContactName: reg.emergencyContactName,
        emergencyContactPhone: reg.emergencyContactPhone,
        emergencyContactCountryCode:
          reg.emergencyContactCountryCode || DEFAULT_DIAL_CODE,
        emergencyContactEmail: reg.emergencyContactEmail,
      },
    });
  });

  async function submit(values: PersonValues) {
    const current = loadedForm();
    if (!current) return;

    const person = v.parse(schema(current), values);
    await send("", Method.PATCH, buildPersonPayload(person));
  }

  return (
    <Form onSubmit={submit}>
      <Modal
        open={props.open}
        title="Editar datos"
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel="Guardar"
            loading={form.submitting}
            disabled={!loadedForm()}
            onCancel={props.onClose}
          />
        }
      >
        <Show
          when={loadedForm()}
          fallback={
            <Show
              when={!staffForm.loading}
              fallback={<LinesSkeleton lines={6} />}
            >
              <p>No se pudo cargar el formulario. Inténtalo de nuevo.</p>
            </Show>
          }
        >
          {(current) => (
            <PersonFields
              of={form}
              form={current()}
              countries={loadedValue(countries) ?? []}
              allowStoredDates
            />
          )}
        </Show>
      </Modal>
    </Form>
  );
};
