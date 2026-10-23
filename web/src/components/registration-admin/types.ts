import type { StaffRegistration } from "~/models";

export type ActionProps = {
  reg: StaffRegistration;
  open: boolean;
  onClose: () => void;
  onDone: (reg: StaffRegistration) => void;

  /** Called when an action fails with a 409, so the page can refresh stale data. */
  onConflict: () => void;
};
