import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./typography/fonts.css";
import "./style.css";
import { registerSW } from "virtual:pwa-register";
const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event("kitab-update-ready"));
  },
  onOfflineReady() {
    window.dispatchEvent(new Event("kitab-offline-ready"));
  },
});
window.addEventListener("kitab-apply-update", () => void updateSW(true));
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    if (this.state.error)
      return (
        <div className="fatal">
          <h1>Kitab Studio could not render this view.</h1>
          <p>
            Your saved projects are still in this browser’s storage. Do not
            clear browser data.
          </p>
          <pre>{this.state.error}</pre>
          <button onClick={() => location.reload()}>Reload application</button>
        </div>
      );
    return this.props.children;
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
