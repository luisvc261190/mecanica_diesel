import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Toaster } from "sonner";

import { App } from "@/app/App";
import "@/styles/index.css";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
    <Toaster position="top-right" richColors closeButton />
  </React.StrictMode>,
);