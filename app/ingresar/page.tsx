import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Ingresar" };

export default function IngresarPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-10 text-lg">
        <Wordmark one />
      </Link>
      <div className="rounded-panel border border-border bg-white p-8 shadow-panel">
        <h1 className="text-2xl font-black tracking-tight">Ingresar a tu cuenta</h1>
        <p className="mt-2 text-sm text-muted">
          Acceso por invitacion. Usa el correo con el que fuiste dado de alta.
        </p>
        <LoginForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Solo pueden ingresar usuarios dados de alta previamente por Ad Mavericks
        en Supabase. Si necesitas acceso, contacta al administrador.
      </p>
    </main>
  );
}
