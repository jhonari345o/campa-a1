import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Eliminación de datos" };

export default function DataDeletionPage() {
  return (
    <LegalPage eyebrow="Privacidad" title="Eliminación de datos" intro="Puedes solicitar la eliminación de tu cuenta y de los datos personales asociados a Ad Mavericks One.">
      <LegalSection title="Cómo enviar la solicitud">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Escribe desde el correo registrado a <a className="font-bold text-forest underline" href="mailto:hola@admavericks.one?subject=Eliminación%20de%20datos%20-%20Ad%20Mavericks%20One">hola@admavericks.one</a>.</li>
          <li>Usa el asunto “Eliminación de datos – Ad Mavericks One” e indica el nombre de tu empresa y el correo de la cuenta.</li>
          <li>No envíes contraseñas, números de tarjeta, tokens ni documentos de identidad salvo que nuestro equipo solicite una verificación específica por un canal seguro.</li>
        </ol>
      </LegalSection>
      <LegalSection title="Qué ocurre después">
        <p>Confirmaremos la recepción, verificaremos que la persona solicitante sea titular o representante autorizado e informaremos el resultado dentro de los plazos aplicables. Cuando corresponda, eliminaremos o anonimizaremos el perfil, sesiones, contenido y datos personales vinculados.</p>
        <p>Podemos conservar registros mínimos cuando sean necesarios para obligaciones legales, contables, prevención de fraude, seguridad o defensa de reclamaciones. Esos registros quedarán restringidos y se eliminarán al terminar el período aplicable.</p>
      </LegalSection>
      <LegalSection title="Datos conectados con Meta">
        <p>Si autorizaste una conexión con Facebook o Instagram, también puedes retirar el acceso desde la configuración de aplicaciones de tu cuenta de Meta. La retirada detiene accesos futuros, pero para solicitar la eliminación de datos ya recibidos por Ad Mavericks debes seguir el procedimiento anterior.</p>
      </LegalSection>
      <LegalSection title="Ayuda">
        <p>Si no puedes escribir desde el correo registrado, explica la situación a <a className="font-bold text-forest underline" href="mailto:hola@admavericks.one">hola@admavericks.one</a>. Te indicaremos una alternativa razonable para verificar la solicitud.</p>
        <p>Más información en nuestra <a className="font-bold text-forest underline" href="/privacidad">Política de privacidad</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}

