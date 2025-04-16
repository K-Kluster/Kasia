import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter, Route, Routes } from "react-router";

// routes declaration
export const loadApplication = async () => {
  createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
      <Routes>
        {/* catches all routes path */}
        <Route Component={() => <App />} path="*"></Route>
      </Routes>
    </BrowserRouter>
  );
};
