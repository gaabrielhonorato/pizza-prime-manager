import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { CampanhaProvider } from "@/contexts/CampanhaContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <CampanhaProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </CampanhaProvider>,
);
