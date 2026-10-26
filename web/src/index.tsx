/* @refresh reload */
import "./index.css";
import { render } from "solid-js/web";
import "solid-devtools";
import * as v from "valibot";

import App from "./App";

// Fallback for any valibot rule without its own message; the English defaults must never reach users.
v.setGlobalMessage("Valor inválido");

// A deploy removes the old lazy chunks an open tab still points to: reload to get the new ones.
window.addEventListener("vite:preloadError", () => window.location.reload());

// biome-ignore lint/style/noNonNullAssertion: index.html always defines #root.
render(() => <App />, document.getElementById("root")!);
