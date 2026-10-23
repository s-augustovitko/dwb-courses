import type { StaffRegistration } from "~/models";
import { useNotifications } from "~/stores";
import { type Method, request, runAction } from "~/utils";
import type { ActionProps } from "./types";

export const registrationPath = (orderId: string, suffix = "") =>
  `registration/${encodeURIComponent(orderId)}${suffix}`;

export function useStaffAction(props: ActionProps) {
  const notifications = useNotifications();

  return (suffix: string, method: Method, body?: Record<string, unknown>) =>
    runAction({
      action: () =>
        request<StaffRegistration>(
          registrationPath(props.reg.orderId, suffix),
          method,
          undefined,
          body,
        ),
      notify: notifications,
      onSuccess: (updated) => {
        props.onDone(updated);
        props.onClose();
      },
      onConflict: props.onConflict,
    });
}
