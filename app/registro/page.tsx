import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { RegistroForm } from "./RegistroForm";

export const metadata = { title: "Activar cuenta" };

export default function RegistroPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-10 text-lg">
        <Wordmark one />
      </Link>
      <div className="rounded-panel border border-border bg-white p-8 shadow-panel">
        <h1 className="text-2xl font-black tracking-tight">Activa tu cuenta</h1>
        <p className="mt-2 text-sm text-muted">
          Usa el codigo de registro que te compartio Ad Mavericks. Tu cuenta
          quedara en el espacio aislado de tu empresa.
        </p>
        <RegistroForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/ingresar" className="font-black text-signal-dark hover:underline">
          Ingresar
        </Link>
      </p>
    </main>
  );
}
