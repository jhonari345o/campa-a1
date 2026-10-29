import Link from "next/link";
import Image from "next/image";
import { Wordmark } from "@/components/Wordmark";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata = { title: "Iniciar sesión" };

export default function IngresarPage() {
  return (
    <main className={styles.page}>
      <section className={styles.welcome} aria-labelledby="welcome-title">
        <Link href="/" className={styles.brand} aria-label="Ad Mavericks One, inicio">
          <Wordmark one invert />
        </Link>
        <div className={styles.message}>
          <p className={styles.kicker}>Tu equipo. Tu estrategia.</p>
          <h1 id="welcome-title">Tu estrategia de medios empieza aquí.</h1>
          <p className={styles.description}>
            Crea planes, encuentra oportunidades y coordina el trabajo de tu equipo desde un solo lugar.
          </p>
        </div>
        <div className={styles.maviNote}>
          <Image src="/mavi/mavi-cara.png" alt="Mavi, la iguana de Ad Mavericks" width={80} height={80} className={styles.mavi} />
          <div>
            <strong>Mavi te acompaña.</strong>
            <p>Tú decides. Mavi te ayuda a avanzar.</p>
          </div>
        </div>
      </section>
      <section className={styles.access} aria-labelledby="login-title">
        <div className={styles.formBlock}>
          <p className={styles.eyebrow}>Tu cuenta de Ad Mavericks One</p>
          <h2 id="login-title">Inicia sesión</h2>
          <p className={styles.intro}>
            Usa el correo y la contraseña que te asignó tu administrador.
          </p>
          <LoginForm />
          <div className={styles.help}>
            <strong>¿Necesitas ayuda para ingresar?</strong>
            <p>Tu administrador puede ayudarte con tu cuenta.</p>
            <Link href="/#contacto" className={styles.helpLink}>Solicitar acceso o ayuda</Link>
          </div>
        </div>
        <p className={styles.footnote}>
          <Link href="/" className={styles.backLink}>← Volver al inicio</Link>
        </p>
      </section>
    </main>
  );
}
