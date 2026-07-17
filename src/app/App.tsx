import { RouterProvider } from "react-router";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { CashierProvider } from "../modules/cashier/hooks/CashierStore";
import { router } from "./routes";

export default function App() {
  return (
    <CashierProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </CashierProvider>
  );
}
