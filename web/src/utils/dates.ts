import dayjs from "dayjs";
import es from "dayjs/locale/es";
import localizedFormat from "dayjs/plugin/localizedFormat";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(localizedFormat);
dayjs.locale({
  ...es,
  weekStart: 0,
  formats: {
    ...es.formats,
    LL: "D [de] MMM [del] YYYY",
    LLL: "D [de] MMM [del] YYYY [a las] H:mm",
    LLLL: "dddd, D [de] MMMM [del] YYYY H:mm",
  },
});

export function toBackendDateTime(date?: dayjs.ConfigType) {
  return dayjs(date).format("YYYY-MM-DD[T]HH:mm:ssZ");
}

export function toBackendDate(day: dayjs.Dayjs) {
  return `${day.format("YYYY-MM-DD")}T00:00:00Z`;
}

export const calendarDateToLocal = (date: dayjs.ConfigType) =>
  dayjs(dayjs.utc(date).format("YYYY-MM-DD"));

/** Localized date and time (LLL). Empty when the date is missing or Go's zero time. */
export function formatDateTime(date?: dayjs.ConfigType, format = "LLL") {
  const parsed = dayjs(date);
  if (!date || !parsed.isValid() || parsed.year() <= 1) return "";

  return parsed.format(format);
}

export const formatDate = (date?: dayjs.ConfigType) =>
  formatDateTime(date, "LL");

export const formatCalendarDate = (date?: dayjs.ConfigType, format = "LL") =>
  date ? formatDateTime(dayjs.utc(date), format) : "";

export function formatShortDate(date?: dayjs.ConfigType, utc = false): string {
  if (!date) return "";
  return (utc ? dayjs.utc(date) : dayjs(date)).format("L");
}

export function dateToDateInput(date: string | null): string {
  return date ? toBackendDate(dayjs.utc(date)) : "";
}

export function dateInputToUnix(date: string): number | null {
  return date ? dayjs.utc(date).unix() : null;
}
