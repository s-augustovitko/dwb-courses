const HIDDEN_PATH = "/";

/** Hides the registration token from the page URL while third-party payment scripts run; returns the restore function. */
export function hideLocation(): () => void {
  const original = window.location.href;
  window.history.replaceState(window.history.state, "", HIDDEN_PATH);

  // After Back or a link the user is on another entry; writing the token URL there would mislabel it.
  return () => {
    if (window.location.pathname === HIDDEN_PATH) {
      window.history.replaceState(window.history.state, "", original);
    }
  };
}
