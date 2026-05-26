import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App.jsx";
import "../styles.css";

function Root() {
  useEffect(() => {
    import("./app-controller.js");
  }, []);

  return (
    <>
      <App />
      <Analytics />
      <SpeedInsights />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
