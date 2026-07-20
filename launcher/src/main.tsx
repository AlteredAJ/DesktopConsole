import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { OverlayRoot } from "./components/OverlayRoot";
import "./styles.css";
import "./theme"; // applies saved theme vars before first paint

const isOverlay = new URLSearchParams(window.location.search).get("overlay") === "1";
if (isOverlay) document.documentElement.classList.add("overlay-document");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isOverlay ? <OverlayRoot /> : <App />}
  </React.StrictMode>,
);
