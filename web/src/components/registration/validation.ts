import * as v from "valibot";
import { dietaryOptions, type PublicForm, type PublicIdType } from "~/models";
import {
  emailField,
  MAX_CENTS,
  MAX_DONATION_CENTS,
  MIN_LETTER_DOCUMENT_LEN,
  maxChars,
  optionalEmailField,
  optionalMoneyField,
  optionalText,
  REQUIRED,
} from "~/utils";

export const NO_SESSION_ERROR = "Selecciona al menos una sesión";
export const NO_MEAL_ERROR = "Selecciona al menos una comida";
export const NO_ITEMS_ERROR = "Selecciona al menos una sesión o comida";
export const NO_DIETARY_ERROR = "Selecciona la preferencia de comida";

// Mirrors personNamePattern in internal/registration/person.go, applied after collapseSpaces.
const NAME_PATTERN = /^[\p{L}\p{M}]+(?:(?:\. |[ '.-])[\p{L}\p{M}]+)*\.?$/u;
const INVALID_NAME =
  "Solo letras, separadas por un espacio, guion, apóstrofe o punto";
const MAX_NAME_LEN = 100;

const PHONE_PATTERN = /^\d{6,15}$/;
const INVALID_PHONE = "Entre 6 y 15 dígitos";

const DIGITS_PATTERN = /^\d+$/;
const ALPHANUMERIC_PATTERN = /^[A-Z0-9]+$/;

const TRAVEL_MONTHS_BACK = 3;
const TRAVEL_YEARS_FORWARD = 1;
const TRAVEL_RANGE = "Debe estar entre 3 meses atrás y 1 año adelante";

const collapseSpaces = (value: string) =>
  value.split(/\s+/).filter(Boolean).join(" ");

const personName = () =>
  v.pipe(
    v.string(),
    v.transform(collapseSpaces),
    v.nonEmpty(REQUIRED),
    v.maxLength(MAX_NAME_LEN, maxChars(MAX_NAME_LEN)),
    v.regex(NAME_PATTERN, INVALID_NAME),
  );

const optionalPersonName = () =>
  v.pipe(
    v.string(),
    v.transform(collapseSpaces),
    v.maxLength(MAX_NAME_LEN, maxChars(MAX_NAME_LEN)),
    v.check((name) => name === "" || NAME_PATTERN.test(name), INVALID_NAME),
  );

const optionalPhone = () =>
  v.pipe(
    v.string(),
    v.check(
      (phone) => phone === "" || PHONE_PATTERN.test(phone),
      INVALID_PHONE,
    ),
  );

function matchesIdType(document: string, idType: PublicIdType): boolean {
  if (!idType.allowLetters) {
    return DIGITS_PATTERN.test(document) && document.length === idType.maxLen;
  }
  return (
    ALPHANUMERIC_PATTERN.test(document) &&
    document.length >= MIN_LETTER_DOCUMENT_LEN &&
    document.length <= idType.maxLen
  );
}

const documentFormat = (idType: PublicIdType) =>
  idType.allowLetters
    ? `Entre ${MIN_LETTER_DOCUMENT_LEN} y ${idType.maxLen} letras o números`
    : `Exactamente ${idType.maxLen} dígitos`;

const documentField = (idType: PublicIdType | undefined) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.toUpperCase(),
    v.nonEmpty(REQUIRED),
    v.check(
      (document) => !idType || matchesIdType(document, idType),
      idType ? documentFormat(idType) : "",
    ),
  );

export function travelDateRange(now = new Date()): {
  min: string;
  max: string;
} {
  const min = new Date(now);
  min.setUTCMonth(min.getUTCMonth() - TRAVEL_MONTHS_BACK);
  const max = new Date(now);
  max.setUTCFullYear(max.getUTCFullYear() + TRAVEL_YEARS_FORWARD);

  return {
    min: min.toISOString().slice(0, 10),
    max: max.toISOString().slice(0, 10),
  };
}

/** Travel dates already saved on the registration (yyyy-mm-dd); staff may keep them unchanged. */
export type StoredTravelDates = { arrivalDate: string; departureDate: string };

// Like travelDateAllowed in internal/registration/person.go: an unchanged stored date skips the window.
const travelDate = (stored = "") => {
  const { min, max } = travelDateRange();
  return v.pipe(
    v.string(),
    v.check(
      (date) => date === "" || date === stored || (date >= min && date <= max),
      TRAVEL_RANGE,
    ),
  );
};

export function inputField<T>(input: unknown, key: string, fallback: T): T {
  const value =
    typeof input === "object" && input !== null
      ? Reflect.get(input, key)
      : undefined;
  return (value as T | undefined) ?? fallback;
}

// Built from the input so rules that read another field run as field rules: valiForm stops
// before object-level checks while any field is invalid, which would hide them.
// Fields of a section the form hides are not mounted, so they arrive undefined.
export const personSchema = (form: PublicForm, stored?: StoredTravelDates) =>
  v.lazy((input) => {
    const idTypeId = inputField<string>(input, "idTypeId", "");
    const arrivalDate = inputField<string>(input, "arrivalDate", "");

    return v.object({
      idTypeId: v.picklist(
        form.idTypes.map((idType) => idType.id),
        REQUIRED,
      ),
      documentNumber: documentField(
        form.idTypes.find((idType) => idType.id === idTypeId),
      ),
      firstName: personName(),
      lastName: personName(),
      email: emailField(),
      countryCode: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
      phoneNumber: v.pipe(v.string(), v.regex(PHONE_PATTERN, INVALID_PHONE)),

      arrivalDate: v.optional(travelDate(stored?.arrivalDate), ""),
      departureDate: v.optional(
        v.pipe(
          travelDate(stored?.departureDate),
          v.check(
            (date) => !date || !arrivalDate || date >= arrivalDate,
            "No puede ser anterior a la llegada",
          ),
        ),
        "",
      ),

      insuranceProvider: v.optional(optionalText(100), ""),
      insurancePolicyNumber: v.optional(optionalText(64), ""),

      emergencyContactName: v.optional(optionalPersonName(), ""),
      emergencyContactCountryCode: v.optional(v.string(), ""),
      emergencyContactPhone: v.optional(optionalPhone(), ""),
      emergencyContactEmail: v.optional(optionalEmailField(), ""),
    });
  });

export type PersonValues = v.InferInput<ReturnType<typeof personSchema>>;
export type Person = v.InferOutput<ReturnType<typeof personSchema>>;

export const dietaryField = (required: boolean) =>
  v.pipe(
    v.picklist(["", ...dietaryOptions.map((option) => option.value)]),
    v.check((preference) => !required || preference !== "", NO_DIETARY_ERROR),
  );

/** Staff price per item id: empty keeps the catalog price. */
export const overridesField = () =>
  v.record(v.string(), optionalMoneyField(MAX_CENTS));

// Mirrors requireSelection and storeDietary in internal/registration/selection.go.
export const selectionSchema = (form: PublicForm) =>
  v.lazy((input) => {
    const mealsRequired =
      form.disableSessionSelection &&
      form.sessions.length === 0 &&
      !form.disableMealSelection;
    const hasMeals = form.disableMealSelection
      ? form.meals.length > 0
      : inputField<string[]>(input, "mealIds", []).length > 0;

    return v.object({
      currencyCode: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
      sessionIds: v.optional(
        v.pipe(
          v.array(v.string()),
          v.check(
            (ids) => form.disableSessionSelection || ids.length > 0,
            NO_SESSION_ERROR,
          ),
        ),
        [],
      ),
      mealIds: v.optional(
        v.pipe(
          v.array(v.string()),
          v.check((ids) => !mealsRequired || ids.length > 0, NO_MEAL_ERROR),
        ),
        [],
      ),
      dietaryPreference: v.optional(dietaryField(hasMeals), ""),
      donationText: v.optional(optionalMoneyField(MAX_DONATION_CENTS), ""),
      overrides: v.optional(overridesField(), {}),
    });
  });

export type SelectionValues = v.InferInput<ReturnType<typeof selectionSchema>>;
export type Selection = v.InferOutput<ReturnType<typeof selectionSchema>>;
