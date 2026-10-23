import { createForm, type SubmitHandler, valiForm } from "@modular-forms/solid";
import { type Component, createSignal } from "solid-js";
import * as v from "valibot";
import { Input } from "~/components/global";
import { useNotifications } from "~/stores";
import {
  emailField,
  Method,
  maxChars,
  REQUIRED,
  request,
  runAction,
  singleLine,
} from "~/utils";

type Props = {
  onSuccess: () => void;
};

export const LoginForm: Component<Props> = (props) => {
  const notifications = useNotifications();
  const [loading, setLoading] = createSignal<boolean>(false);

  const [_, { Form, Field }] = createForm<LoginFormSchema>({
    validate: valiForm(loginFormSchema),
    validateOn: "change",
    initialValues: {
      email: "",
      password: "",
    },
  });

  const handleSubmit: SubmitHandler<LoginFormSchema> = async (values) => {
    setLoading(true);
    await runAction({
      action: () =>
        request<null>(
          "auth/login",
          Method.POST,
          undefined,
          v.parse(loginFormSchema, values),
        ),
      notify: notifications,
      onSuccess: props.onSuccess,
    });
    setLoading(false);
  };

  return (
    <div class="card container is-max-tablet">
      <div class="card-content">
        <h1 class="title">Administración</h1>
        <p class="subtitle">Iniciar sesión</p>

        <Form onSubmit={handleSubmit}>
          <Field name="email">
            {(field, props) => (
              <Input
                {...props}
                value={field.value}
                error={field.error}
                required
                label="Correo"
                type="email"
                inputmode="email"
                disabled={loading()}
              />
            )}
          </Field>

          <Field name="password">
            {(field, props) => (
              <Input
                {...props}
                value={field.value}
                error={field.error}
                required
                label="Contraseña"
                type="password"
                disabled={loading()}
              />
            )}
          </Field>

          <div class="field">
            <button
              class="button is-primary is-fullwidth"
              classList={{ "is-loading": loading() }}
              type="submit"
              disabled={loading()}
            >
              Iniciar sesión
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
};

const loginFormSchema = v.object({
  email: emailField(),
  password: v.pipe(
    v.string(),
    v.nonEmpty(REQUIRED),
    v.maxLength(254, maxChars(254)),
    singleLine(),
  ),
});

type LoginFormSchema = v.InferOutput<typeof loginFormSchema>;
