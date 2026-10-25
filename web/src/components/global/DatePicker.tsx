import dayjs, { type Dayjs, type OpUnitType } from "dayjs";
import {
  type Component,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";
import "./DatePicker.css";
import { IconChevronLeft, IconChevronRight } from "~/components/icons";
import { calendarDateToLocal, toBackendDate, toBackendDateTime } from "~/utils";

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  withTime?: boolean;
  minDate?: dayjs.ConfigType;
  maxDate?: dayjs.ConfigType;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  name: string;
  ref?: (element: HTMLInputElement) => void;
  onInput?: JSX.EventHandler<HTMLInputElement, InputEvent>;
  onChange?: JSX.EventHandler<HTMLInputElement, Event>;
  onBlur?: JSX.EventHandler<HTMLInputElement, FocusEvent>;
};

type View = "day" | "month" | "year";

const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, day) =>
  dayjs().day(day).format("dd"),
);

const YEARS_PER_PAGE = 12;

// 6 full weeks (42 days) always covers a month, including its leading and
// trailing days from the adjacent months.
function buildDays(date: Dayjs): Dayjs[] {
  const firstOfMonth = date.startOf("month");
  const gridStart = firstOfMonth.subtract(firstOfMonth.day(), "day");
  return Array.from({ length: 42 }, (_, i) => gridStart.add(i, "day"));
}

function toFieldEvent<E extends Event>(input: HTMLInputElement) {
  return { currentTarget: input, target: input } as unknown as E & {
    currentTarget: HTMLInputElement;
    target: Element;
  };
}

function clampTimeUnit(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

function defaultTime(): Dayjs {
  return dayjs().minute(0).second(0).millisecond(0);
}

export const DatePicker: Component<Props> = (props) => {
  const [, inputProps] = splitProps(props, [
    "label",
    "hint",
    "error",
    "value",
    "withTime",
    "minDate",
    "maxDate",
    "ref",
  ]);

  let inputRef: HTMLInputElement | undefined;
  let container: HTMLDivElement | undefined;

  const [open, setOpen] = createSignal(false);
  const [view, setView] = createSignal<View>("day");
  const [viewMonth, setViewMonth] = createSignal(dayjs());

  const selected = createMemo(() => {
    if (!props.value) return undefined;
    const parsed = props.withTime
      ? dayjs(props.value)
      : calendarDateToLocal(props.value);
    return parsed.isValid() ? parsed : undefined;
  });

  const minDate = createMemo(() =>
    props.minDate ? dayjs(props.minDate) : undefined,
  );
  const maxDate = createMemo(() =>
    props.maxDate ? dayjs(props.maxDate) : undefined,
  );

  const days = createMemo(() => buildDays(viewMonth()));
  const months = createMemo(() =>
    Array.from({ length: 12 }, (_, i) => viewMonth().month(i)),
  );
  const yearPageStart = createMemo(
    () => Math.floor(viewMonth().year() / YEARS_PER_PAGE) * YEARS_PER_PAGE,
  );
  const years = createMemo(() =>
    Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart() + i),
  );

  const isDayDisabled = (day: Dayjs) => {
    const min = minDate();
    const max = maxDate();
    return (
      (Boolean(min) && day.isBefore(min, "day")) ||
      (Boolean(max) && day.isAfter(max, "day"))
    );
  };

  const isMonthDisabled = (month: Dayjs) => {
    const min = minDate();
    const max = maxDate();
    return (
      (Boolean(min) && month.isBefore(min, "month")) ||
      (Boolean(max) && month.isAfter(max, "month"))
    );
  };

  const isYearDisabled = (year: number) => {
    const min = minDate();
    const max = maxDate();
    const anchor = viewMonth().year(year);
    return (
      (Boolean(min) && anchor.isBefore(min, "year")) ||
      (Boolean(max) && anchor.isAfter(max, "year"))
    );
  };

  const stepUnit = (): OpUnitType => (view() === "month" ? "year" : "month");

  const isPrevDisabled = () => {
    const min = minDate();
    if (!min) return false;
    if (view() === "year") return yearPageStart() - 1 < min.year();
    return !viewMonth().isAfter(min, stepUnit());
  };

  const isNextDisabled = () => {
    const max = maxDate();
    if (!max) return false;
    if (view() === "year") {
      return yearPageStart() + YEARS_PER_PAGE > max.year();
    }
    return !viewMonth().isBefore(max, stepUnit());
  };

  const goPrev = () => {
    if (view() === "day") setViewMonth((m) => m.subtract(1, "month"));
    else if (view() === "month") setViewMonth((m) => m.subtract(1, "year"));
    else setViewMonth((m) => m.subtract(YEARS_PER_PAGE, "year"));
  };

  const goNext = () => {
    if (view() === "day") setViewMonth((m) => m.add(1, "month"));
    else if (view() === "month") setViewMonth((m) => m.add(1, "year"));
    else setViewMonth((m) => m.add(YEARS_PER_PAGE, "year"));
  };

  const headerLabel = () => {
    if (view() === "day") return viewMonth().format("MMM [de] YYYY");
    if (view() === "month") return viewMonth().format("YYYY");
    return `${yearPageStart()} - ${yearPageStart() + YEARS_PER_PAGE - 1}`;
  };

  const drillUp = () => {
    if (view() === "day") setView("month");
    else if (view() === "month") setView("year");
  };

  const selectDate = (next: Dayjs) => {
    if (!inputRef) return;
    inputRef.value = props.withTime
      ? toBackendDateTime(next)
      : toBackendDate(next);
    props.onInput?.(toFieldEvent(inputRef));
    props.onChange?.(toFieldEvent(inputRef));
    inputRef.value = next.format(props.withTime ? "LLL" : "LL");
  };

  const openPicker = () => {
    if (props.disabled) return;
    setViewMonth(selected() ?? dayjs());
    setView("day");
    setOpen(true);
  };

  const closePicker = () => {
    if (!open()) return;
    setOpen(false);
    if (inputRef) props.onBlur?.(toFieldEvent(inputRef));
  };

  // Date-only values are stored as UTC midnight of the picked day, so every zone shows that day.
  const selectDay = (day: Dayjs) => {
    if (isDayDisabled(day)) return;
    const base = selected() ?? defaultTime();
    selectDate(
      props.withTime
        ? day.hour(base.hour()).minute(base.minute()).second(0).millisecond(0)
        : day.startOf("day"),
    );
    setViewMonth(day);
    if (!props.withTime) closePicker();
  };

  const selectMonth = (month: Dayjs) => {
    if (isMonthDisabled(month)) return;
    setViewMonth(month);
    setView("day");
  };

  const selectYear = (year: number) => {
    if (isYearDisabled(year)) return;
    setViewMonth((m) => m.year(year));
    setView("month");
  };

  // Number inputs still accept -, +, . and e (and any pasted text); snap invalid input back.
  const commitTimeUnit = (
    e: InputEvent & { currentTarget: HTMLInputElement; target: Element },
    max: number,
    apply: (base: Dayjs, value: number) => Dayjs,
    format: string,
  ) => {
    const raw = e.currentTarget.valueAsNumber;
    const base = selected() ?? defaultTime();
    if (Number.isNaN(raw)) {
      if (e.currentTarget.value) e.currentTarget.value = base.format(format);
      return;
    }

    const clamped = clampTimeUnit(raw, max);
    e.currentTarget.value = String(clamped).padStart(2, "0");
    selectDate(apply(base, clamped));
  };

  const commitHour = (
    e: InputEvent & { currentTarget: HTMLInputElement; target: Element },
  ) => commitTimeUnit(e, 23, (base, value) => base.hour(value), "HH");

  const commitMinute = (
    e: InputEvent & { currentTarget: HTMLInputElement; target: Element },
  ) => commitTimeUnit(e, 59, (base, value) => base.minute(value), "mm");

  const digitsOnly: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const allowedKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "Escape",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ];
    if (allowedKeys.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  };

  const goToday = () => {
    const now = props.withTime ? defaultTime() : dayjs().startOf("day");
    if (isDayDisabled(now)) return;
    selectDate(now);
    setViewMonth(now);
    setView("day");
    if (!props.withTime) closePicker();
  };

  const clearDate = () => {
    if (!inputRef) return;
    inputRef.value = "";
    props.onInput?.(toFieldEvent(inputRef));
    props.onChange?.(toFieldEvent(inputRef));
    closePicker();
  };

  onMount(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (container && !e.composedPath().includes(container)) {
        closePicker();
      }
    };
    // Capture phase, so an enclosing Modal sees the Escape as handled.
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !open()) return;
      e.preventDefault();
      closePicker();
    };

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeydown, true);

    onCleanup(() => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeydown, true);
    });
  });

  const displayValue = () => {
    const value = selected();
    if (!value) return "";
    return value.format(props.withTime ? "LLL" : "LL");
  };

  return (
    <fieldset class="field">
      <label class="label" for={props.name}>
        {props.label} {props.required ? <span>*</span> : ""}
      </label>

      <div class="control">
        <div
          class="dropdown w-full"
          classList={{ "is-active": open() }}
          ref={container}
          onFocusOut={(e) => {
            const next = e.relatedTarget;
            if (next instanceof Node && !container?.contains(next)) {
              closePicker();
            }
          }}
        >
          <div class="dropdown-trigger w-full">
            <input
              {...inputProps}
              ref={(element) => {
                inputRef = element;
                props.ref?.(element);
              }}
              id={props.name}
              type="text"
              readonly
              class="input is-clickable w-full"
              classList={{ "is-danger": Boolean(props.error) }}
              value={displayValue()}
              placeholder={props.label}
              aria-invalid={Boolean(props.error)}
              aria-errormessage={
                props.error ? `${props.name}-error` : undefined
              }
              aria-describedby={
                props.hint && !props.error ? `${props.name}-hint` : undefined
              }
              onClick={openPicker}
              onFocus={openPicker}
            />
          </div>

          <div class="dropdown-menu date-picker-menu">
            <div class="dropdown-content">
              <div class="is-flex is-align-items-center is-justify-content-space-between mb-2">
                <button
                  type="button"
                  class="button is-small is-text"
                  disabled={isPrevDisabled()}
                  onClick={goPrev}
                >
                  <IconChevronLeft title="Anterior" class="is-size-5" />
                </button>

                {view() === "year" ? (
                  <span class="has-text-weight-semibold">{headerLabel()}</span>
                ) : (
                  <button
                    type="button"
                    class="button is-small is-text is-capitalized has-text-weight-semibold"
                    onClick={drillUp}
                  >
                    {headerLabel()}
                  </button>
                )}

                <button
                  type="button"
                  class="button is-small is-text"
                  disabled={isNextDisabled()}
                  onClick={goNext}
                >
                  <IconChevronRight title="Siguiente" class="is-size-5" />
                </button>
              </div>

              {view() === "day" && (
                <div class="fixed-grid has-7-cols mb-3">
                  <div class="grid is-gap-0.5 mb-0">
                    <For each={WEEKDAY_LABELS}>
                      {(label) => (
                        <span class="has-text-grey has-text-centered is-uppercase is-size-7">
                          {label}
                        </span>
                      )}
                    </For>
                    <For each={days()}>
                      {(day) => (
                        <button
                          type="button"
                          class="date-picker-day"
                          classList={{
                            "is-muted": !day.isSame(viewMonth(), "month"),
                            "is-selected":
                              Boolean(selected()) &&
                              day.isSame(selected(), "day"),
                            "is-today": day.isSame(dayjs(), "day"),
                          }}
                          disabled={isDayDisabled(day)}
                          aria-label={day.format("LL")}
                          aria-current={
                            day.isSame(dayjs(), "day") ? "date" : undefined
                          }
                          aria-pressed={
                            Boolean(selected()) && day.isSame(selected(), "day")
                          }
                          onClick={() => selectDay(day)}
                        >
                          {day.format("D")}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              )}

              {view() === "month" && (
                <div class="fixed-grid has-3-cols mb-3">
                  <div class="grid mb-0">
                    <For each={months()}>
                      {(month) => (
                        <button
                          type="button"
                          class="date-picker-day is-capitalized"
                          classList={{
                            "is-selected":
                              Boolean(selected()) &&
                              month.isSame(selected(), "month"),
                            "is-today": month.isSame(dayjs(), "month"),
                          }}
                          disabled={isMonthDisabled(month)}
                          aria-label={month.format("MMMM [de] YYYY")}
                          aria-pressed={
                            Boolean(selected()) &&
                            month.isSame(selected(), "month")
                          }
                          onClick={() => selectMonth(month)}
                        >
                          {month.format("MMM")}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              )}

              {view() === "year" && (
                <div class="fixed-grid has-3-cols mb-3">
                  <div class="grid mb-0">
                    <For each={years()}>
                      {(year) => (
                        <button
                          type="button"
                          class="date-picker-day"
                          classList={{
                            "is-selected":
                              Boolean(selected()) &&
                              year === selected()?.year(),
                            "is-today": year === dayjs().year(),
                          }}
                          disabled={isYearDisabled(year)}
                          aria-label={String(year)}
                          aria-pressed={
                            Boolean(selected()) && year === selected()?.year()
                          }
                          onClick={() => selectYear(year)}
                        >
                          {year}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              )}

              {props.withTime && (
                <div class="is-flex is-align-items-center is-justify-content-center is-gap-1 mt-3">
                  <input
                    type="number"
                    inputmode="numeric"
                    class="input is-small has-text-centered date-picker-time-input"
                    min="0"
                    max="23"
                    step="1"
                    aria-label="Hora"
                    value={(selected() ?? defaultTime()).format("HH")}
                    onInput={commitHour}
                    onKeyDown={digitsOnly}
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <span class="has-text-weight-semibold">:</span>
                  <input
                    type="number"
                    inputmode="numeric"
                    class="input is-small has-text-centered date-picker-time-input"
                    min="0"
                    max="59"
                    step="1"
                    aria-label="Minutos"
                    value={(selected() ?? defaultTime()).format("mm")}
                    onInput={commitMinute}
                    onKeyDown={digitsOnly}
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => e.currentTarget.select()}
                  />
                </div>
              )}

              <div class="date-picker-footer is-flex is-justify-content-space-between mt-3 pt-2">
                <button
                  type="button"
                  class="button is-small is-text has-text-primary"
                  disabled={isDayDisabled(dayjs())}
                  onClick={goToday}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  class="button is-small is-text has-text-success"
                  onClick={closePicker}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  class="button is-small is-text has-text-danger"
                  onClick={clearDate}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {props.error && (
        <small class="help is-danger" id={`${props.name}-error`}>
          {props.error}
        </small>
      )}
      {props.hint && !props.error && (
        <small class="help" id={`${props.name}-hint`}>
          {props.hint}
        </small>
      )}
    </fieldset>
  );
};
