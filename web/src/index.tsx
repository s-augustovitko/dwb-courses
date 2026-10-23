/* @refresh reload */
import "./index.css";
import { render } from "solid-js/web";
import "solid-devtools";
import * as v from "valibot";

import App from "./App";

// Fallback for any valibot rule without its own message; the English defaults must never reach users.
v.setGlobalMessage("Valor inválido");

// biome-ignore lint/style/noNonNullAssertion: index.html always defines #root.
render(() => <App />, document.getElementById("root")!);
