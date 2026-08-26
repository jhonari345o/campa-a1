import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacidad" title="Política de privacidad" intro="Explica qué información trata Ad Mavericks One, para qué la usa y cómo puedes ejercer tus derechos.">
      <LegalSection title="1. Responsable y alcance">
        <p>Ad Mavericks, con operación en Guayaquil, Ecuador, es responsable del tratamiento realizado por Ad Mavericks One. Esta política cubre el sitio público, la plataforma por invitación, el planificador, Mavi y los flujos de solicitud de pauta.</p>
        <p>Para consultas de privacidad puedes escribir a <a className="font-bold text-forest underline" href="mailto:hola@admavericks.one">hola@admavericks.one</a>.</p>
      </LegalSection>
      <LegalSection title="2. Información que tratamos">
        <ul className="list-disc space-y-2 pl-5">
          <li>Datos de cuenta y empresa: nombre, correo, organización, rol y estado de acceso.</li>
          <li>Datos de planificación: brief, presupuesto, medios seleccionados, ubicación o radio geográfico, URL de piezas y preferencias de campaña.</li>
          <li>Datos operativos: solicitudes, aprobaciones, campañas, métricas, incidencias y comunicaciones de soporte.</li>
          <li>Datos técnicos esenciales para seguridad: fecha de acceso, sesión, dispositivo, registros de error y señales contra abuso.</li>
          <li>Datos de pago limitados al identificador, monto, moneda y estado comunicados por el proveedor. Ad Mavericks One no recibe ni almacena números completos de tarjeta.</li>
        </ul>
      </LegalSection>
      <LegalSection title="3. Para qué usamos la información">
        <p>Usamos los datos para autenticar usuarios autorizados, prestar y mejorar el servicio, preparar planes y cotizaciones, procesar solicitudes aprobadas, medir campañas, atender soporte, prevenir fraude y cumplir obligaciones contractuales o legales.</p>
        <p>Cuando Mavi consulta fuentes públicas de Internet, enviamos únicamente el contexto necesario para responder; no se deben introducir secretos, credenciales ni datos sensibles en el chat.</p>
      </LegalSection>
      <LegalSection title="4. Proveedores y transferencias">
        <p>Podemos encargar tratamientos necesarios a proveedores de infraestructura, base de datos, inteligencia artificial, medición, pago y medios, entre ellos AWS, Supabase, Meta y PayPhone, según las funciones activadas. Cada proveedor trata la información bajo sus propias condiciones y controles. No vendemos datos personales.</p>
        <p>Algunos proveedores pueden procesar datos fuera de Ecuador. Aplicamos medidas contractuales y técnicas razonables para protegerlos conforme a la normativa aplicable.</p>
      </LegalSection>
      <LegalSection title="5. Cookies, conservación y seguridad">
        <p>La plataforma utiliza cookies o almacenamiento estrictamente necesario para inicio de sesión, seguridad y preferencias. No activa publicidad comportamental de terceros por defecto.</p>
        <p>Conservamos la información mientras la cuenta o relación comercial esté activa y después solo por el período necesario para seguridad, auditoría y obligaciones legales. Aplicamos control de acceso por empresa, roles, cifrado en tránsito y registros de auditoría; ningún sistema elimina por completo el riesgo.</p>
      </LegalSection>
      <LegalSection title="6. Tus derechos">
        <p>Puedes solicitar acceso, actualización, rectificación, eliminación, oposición, portabilidad o limitación cuando corresponda. Escribe desde el correo asociado a tu cuenta a <a className="font-bold text-forest underline" href="mailto:hola@admavericks.one?subject=Solicitud%20de%20privacidad">hola@admavericks.one</a>. Podremos pedir una verificación razonable de identidad antes de actuar.</p>
        <p>Consulta también nuestras <a className="font-bold text-forest underline" href="/eliminacion-datos">instrucciones de eliminación de datos</a>.</p>
      </LegalSection>
      <LegalSection title="7. Menores y cambios">
        <p>El servicio está dirigido a empresas y personas adultas autorizadas; no está diseñado para menores de edad. Podemos actualizar esta política cuando cambien el servicio o las obligaciones aplicables y publicaremos aquí la fecha vigente.</p>
      </LegalSection>
    </LegalPage>
  );
}

