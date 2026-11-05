import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/style.css";
import "./styles/profile.css";
import "./styles/react-overrides.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
