import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { ManagerApp } from "../../src/modules/manager";
import "../../src/styles/tailwind.css";
import "../../src/styles/theme.css";

createRoot(document.getElementById("root")!).render(<MemoryRouter><ManagerApp /></MemoryRouter>);
