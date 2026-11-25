import { redirect } from "next/navigation";

export const metadata = { title: "Activar cuenta" };

export default function RegistroPage() {
  redirect("/ingresar");
}
