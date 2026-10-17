import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loadSettings } from "./lib/settings";
import { loadHatchery } from "./lib/hatchery/store";
import { loadTrivia } from "./lib/trivia/store";
import "@fontsource-variable/inter";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/jetbrains-mono";
import "katex/dist/katex.min.css";
import "./styles.css";

// Settings (and the hatchery and trivia saves) load before the first paint so initial
// state reads them synchronously; the boot splash (index.html) covers this beat.
Promise.all([loadSettings(), loadHatchery(), loadTrivia()]).finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
