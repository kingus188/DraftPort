import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary/ErrorBoundary";
import {
  getSafeSessionStorage,
  installPreloadErrorHandler,
} from "./bootstrap/installPreloadErrorHandler";
import { installTauriDesktopBridge } from "./desktop/tauriBridge";

installTauriDesktopBridge();
installPreloadErrorHandler({
  target: window,
  storage: getSafeSessionStorage(),
  now: () => Date.now(),
  reload: () => window.location.reload(),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
);
