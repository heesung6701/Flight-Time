import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "../styles.css";

function Root() {
  useEffect(() => {
    import("./app-controller.js");
  }, []);

  return <App />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
