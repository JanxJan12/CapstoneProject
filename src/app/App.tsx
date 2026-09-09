import { RouterProvider } from "react-router";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { CashierProvider } from "../modules/cashier/hooks/CashierStore";
import { router } from "./routes";

export default function App() {
  return (
    <AuthProvider>
      <CashierProvider>
        <RouterProvider router={router} />
      </CashierProvider>
    </AuthProvider>
  );
}