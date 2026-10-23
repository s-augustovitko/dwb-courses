import dayjs from "dayjs";
import * as v from "valibot";
import { MAX_CENTS } from "./constants";
import { centsToDecimal, parseMoneyToCents } from "./money";

export const REQUIRED = "Este campo es requerido";
export const maxChars = (max: number) => `Máximo ${max} caracteres`;

// Rejects control characters, line/paragraph separators and bidi controls,
// like the backend singleline tag.
const isForbiddenChar = (char: string) => {
  const code = char.codePointAt(0) ?? 0;
  return (
    /[\p{Cc}\p{Zl}\p{Zp}]/u.test(char) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
};

export const isSingleLine = (value: string) =>
  ![...value].some(isForbiddenChar);

const isMultiLine = (value: string) =>
  isSingleLine(value.replace(/[\t\n\r]/g, ""));

/** Backend `singleline`, without trimming (e.g. passwords). */
export const singleLine = () =>
  v.check(
    isSingleLine,
    "No puede contener saltos de línea ni caracteres especiales",
  );

/** Required single-line text (backend `text`), trimmed on submit. */
export const requiredText = (max: number) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(REQUIRED),
    v.maxLength(max, maxChars(max)),
    singleLine(),
  );

/** Optional single-line text (backend `trimmed,singleline`). */
export const optionalText = (max: number) =>
  v.pipe(v.string(), v.trim(), v.maxLength(max, maxChars(max)), singleLine());

/** Optional text that may span lines (backend `trimmed,multiline`). */
export const multilineText = (max: number) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(max, maxChars(max)),
    v.check(isMultiLine, "Contiene caracteres no permitidos"),
  );

/** Required email, trimmed and lowercased (backend `lowercase,email,ascii,max=254`). */
export const emailField = () =>
  v.pipe(
    v.string(),
    v.trim(),
    v.toLowerCase(),
    v.nonEmpty(REQUIRED),
    v.maxLength(254, maxChars(254)),
    v.email("Correo inválido"),
  );

export const optionalEmailField = () =>
  v.pipe(
    v.string(),
    v.trim(),
    v.toLowerCase(),
    v.maxLength(254, maxChars(254)),
    v.check(
      (text) => text === "" || v.EMAIL_REGEX.test(text),
      "Correo inválido",
    ),
  );

export const priceField = () =>
  v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(REQUIRED),
    v.check((text) => parseMoneyToCents(text) !== null, moneyError(MAX_CENTS)),
  );

const moneyHint = (maxCents: number) =>
  `Máximo ${centsToDecimal(maxCents)}, hasta 2 decimales`;

export const moneyError = (maxCents: number) =>
  `Monto inválido. ${moneyHint(maxCents)}`;

export const amountField = (params: {
  maxCents: number;
  maxMessage: string;
  optional?: boolean;
}) => {
  const cents = (text: string) => parseMoneyToCents(text);
  const isEmptyOptional = (text: string) =>
    Boolean(params.optional) && text === "";

  return v.pipe(
    v.string(),
    v.trim(),
    v.check((text) => isEmptyOptional(text) || text !== "", REQUIRED),
    v.check(
      (text) => isEmptyOptional(text) || cents(text) !== null,
      moneyError(Math.min(params.maxCents, MAX_CENTS)),
    ),
    v.check(
      (text) => isEmptyOptional(text) || (cents(text) ?? 0) > 0,
      "Debe ser mayor a 0",
    ),
    v.check(
      (text) => isEmptyOptional(text) || (cents(text) ?? 0) <= params.maxCents,
      params.maxMessage,
    ),
  );
};

/** Empty, or an amount from 0 up to maxCents. */
export const optionalMoneyField = (maxCents: number) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.check((text) => {
      if (text === "") return true;
      const cents = parseMoneyToCents(text);
      return cents !== null && cents <= maxCents;
    }, moneyError(maxCents)),
  );

export const pricesField = () =>
  v.record(v.pipe(v.string(), v.regex(/^[A-Z]{3}$/)), priceField());

/** Backend `daterange`: within a year and a day of now, either way. */
export function isInDateRange(value: string): boolean {
  const date = dayjs(value);
  const now = dayjs();
  return (
    !date.isBefore(now.subtract(1, "year").subtract(1, "day")) &&
    !date.isAfter(now.add(1, "year").add(1, "day"))
  );
}

export const DATE_RANGE_MESSAGE =
  "La fecha debe estar entre hace un año y dentro de un año";

export const isValidDate = (value: string) => dayjs(value).isValid();

/** Required date within the backend `daterange` window. */
export const requiredDate = () =>
  v.pipe(
    v.string(),
    v.nonEmpty(REQUIRED),
    v.check(isValidDate, "Fecha inválida"),
    v.check(isInDateRange, DATE_RANGE_MESSAGE),
  );
