export type Color =
  | "info"
  | "danger"
  | "link"
  | "warning"
  | "success"
  | "primary"
  | "";

const validColors: Color[] = [
  "info",
  "danger",
  "link",
  "warning",
  "success",
  "primary",
  "",
];

export const colorClass = (props: {
  color?: Color;
  error?: string;
}): string => {
  if (props.error) return "is-danger";
  const color = props.color ?? "";
  return `is-${validColors.includes(color) ? color : ""}`;
};
