import App from "./App.tsx";
import { type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

export async function loadApplication(root: Root) {
  root.render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
