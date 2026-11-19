import { redirect } from "next/navigation";
export const metadata = { title: "Mavi" };

export default function AsistentePage() {
  redirect("/panel?mavi=open");
}
