import { Root } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";

// routes declaration
export const loadApplication = async () => {
  // Get the existing root from init.ts
  const root = window.__APP_ROOT__;

  root.render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};
