import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { revokeLegalConsent } from "@/app/consentimiento/actions";
import { LEGAL_VERSIONS, PRIVACY_EMAIL } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacidad" title="Política de privacidad" intro="Explica qué información trata Ad Mavericks One, para qué la usa y cómo puedes ejercer tus derechos.">
      <LegalSection title="1. Responsable y alcance">
        <p>Ad Mavericks, con operación en Guayaquil, Ecuador, es responsable del tratamiento realizado por Ad Mavericks One. Esta política cubre el sitio público, la plataforma por invitación, el planificador, Mavi y los flujos de solicitud de pauta.</p>
        <p>Para consultas de privacidad puedes escribir a <a className="font-bold text-forest underline" href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.</p>
      </LegalSection>
      <LegalSection title="2. Información que tratamos">
        <ul className="list-disc space-y-2 pl-5">
          <li>Datos de cuenta y empresa: nombre, correo, organización, rol y estado de acceso.</li>
          <li>Datos de planificación: brief, presupuesto, medios seleccionados, ubicación o radio geográfico, URL de piezas y preferencias de campaña.</li>
          <li>Datos operativos: solicitudes, aprobaciones, campañas, métricas, incidencias y comunicaciones de soporte.</li>
          <li>Metadatos técnicos derivados de piezas seleccionadas en el Laboratorio creativo: tipo de archivo, tamaño, resolución, proporción y duración. El archivo original se analiza localmente y no se incorpora a una base de datos de Ad Mavericks.</li>
          <li>Datos técnicos esenciales para seguridad: fecha de acceso, sesión, dispositivo, registros de error y señales contra abuso.</li>
          <li>Datos de pago limitados al identificador, monto, moneda y estado comunicados por el proveedor. Ad Mavericks One no recibe ni almacena números completos de tarjeta.</li>
        </ul>
      </LegalSection>
      <LegalSection title="3. Para qué usamos la información">
        <p>Usamos los datos para autenticar usuarios autorizados, prestar y mejorar el servicio, preparar planes y cotizaciones, procesar solicitudes aprobadas, medir campañas, atender soporte, prevenir fraude y cumplir obligaciones contractuales o legales.</p>
        <p>Cuando Mavi consulta fuentes públicas de Internet, enviamos únicamente el contexto necesario para responder; no se deben introducir secretos, credenciales ni datos sensibles en el chat.</p>
        <h3 className="font-black text-forest">Laboratorio creativo y análisis local</h3>
        <p>Para usar el Laboratorio creativo debes autorizar que tu navegador lea localmente el archivo seleccionado y obtenga únicamente los metadatos necesarios para revisar formato, tamaño, resolución, proporción y duración. La aplicación crea una referencia temporal en la memoria del navegador para mostrar la vista previa; no carga el archivo original en AWS, Supabase, OpenRouter ni Mavi.</p>
        <p>El análisis local termina al reemplazar el archivo, revocar la autorización, cerrar la vista o finalizar la sesión del navegador. Si solicitas una adaptación a Mavi, pediremos una autorización separada y solo enviaremos el diagnóstico técnico derivado, el CTA y el copy que hayas escrito; la imagen o el video no se envían al proveedor de IA.</p>
      </LegalSection>
      <LegalSection title="4. Proveedores y transferencias">
        <p>Podemos encargar tratamientos necesarios a proveedores de infraestructura, base de datos, inteligencia artificial, medición, pago y medios, entre ellos AWS, Supabase, Meta y dLocal Go, según las funciones activadas. Cada proveedor trata la información bajo sus propias condiciones y controles. No vendemos datos personales.</p>
        <p>Algunos proveedores pueden procesar datos fuera de Ecuador. Aplicamos medidas contractuales y técnicas razonables para protegerlos conforme a la normativa aplicable.</p>
      </LegalSection>
      <LegalSection title="5. Cookies, conservación y seguridad">
        <p>La plataforma utiliza cookies o almacenamiento estrictamente necesario para inicio de sesión, seguridad y preferencias. No activa publicidad comportamental de terceros por defecto.</p>
        <p>Los archivos examinados en el Laboratorio creativo no se guardan en nuestros servidores. La referencia local de vista previa es temporal y se libera cuando dejas de utilizarla.</p>
        <p>Conservamos la información mientras la cuenta o relación comercial esté activa y después solo por el período necesario para seguridad, auditoría y obligaciones legales. Aplicamos control de acceso por empresa, roles, cifrado en tránsito y registros de auditoría; ningún sistema elimina por completo el riesgo.</p>
        <p>Como referencia operativa, los borradores y datos de planificación se revisan para eliminación o anonimización después de 24 meses de terminada la relación, y los registros ordinarios de seguridad después de 12 meses. Los comprobantes, conciliaciones, campañas, reclamaciones e incidentes pueden conservarse durante el plazo legal o de defensa aplicable.</p>
      </LegalSection>
      <LegalSection title="6. Titularidad, benchmarks y datos derivados">
        <p>El cliente conserva sus derechos sobre datos personales, piezas, marcas y contenido propio. Ad Mavericks no adquiere la propiedad de los datos personales por la aceptación de esta política.</p>
        <p>Ad Mavericks puede conservar y utilizar información operativa para prestar, proteger y auditar el servicio. Solo con autorización opcional separada podrá incorporar resultados anonimizados y agregados a benchmarks. Una vez que un conjunto está efectivamente anonimizado y ya no identifica ni permite identificar razonablemente a una persona, puede conservarse para análisis estadístico y mejora del producto.</p>
      </LegalSection>
      <LegalSection title="7. Tus derechos y revocación">
        <p>Puedes solicitar acceso, actualización, rectificación, eliminación, oposición, portabilidad o limitación cuando corresponda. Escribe desde el correo asociado a tu cuenta a <a className="font-bold text-forest underline" href={`mailto:${PRIVACY_EMAIL}?subject=Solicitud%20de%20privacidad`}>{PRIVACY_EMAIL}</a>. Podremos pedir una verificación razonable de identidad antes de actuar.</p>
        <p>Consulta también nuestras <a className="font-bold text-forest underline" href="/eliminacion-datos">instrucciones de eliminación de datos</a>.</p>
        <form action={revokeLegalConsent} className="mt-4"><button type="submit" className="btn btn-secondary">Revocar consentimiento y cerrar sesión</button></form>
      </LegalSection>
      <LegalSection title="8. Menores y cambios">
        <p>El servicio está dirigido a empresas y personas adultas autorizadas; no está diseñado para menores de edad. Podemos actualizar esta política cuando cambien el servicio o las obligaciones aplicables y publicaremos aquí la fecha vigente.</p>
        <p>Versiones vigentes: privacidad {LEGAL_VERSIONS.privacy} · tratamiento {LEGAL_VERSIONS.treatment}.</p>
      </LegalSection>
    </LegalPage>
  );
}
