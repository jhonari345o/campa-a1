import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Términos del servicio" };

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Condiciones" title="Términos del servicio" intro="Reglas de acceso y uso de Ad Mavericks One para planificación y gestión de medios.">
      <LegalSection title="1. Servicio y aceptación">
        <p>Ad Mavericks One es una plataforma de planificación, catálogo, asistencia y coordinación de pauta publicitaria operada por Ad Mavericks en Ecuador. Al acceder o usarla aceptas estos términos y la política de privacidad.</p>
      </LegalSection>
      <LegalSection title="2. Acceso por invitación">
        <p>Las cuentas se crean por invitación o por un administrador autorizado. Debes proporcionar información correcta, mantener tus credenciales bajo control y avisarnos ante cualquier acceso no reconocido. Tu rol limita las acciones disponibles dentro de cada empresa.</p>
      </LegalSection>
      <LegalSection title="3. Planes, tarifas y órdenes">
        <p>Los planes, métricas, tarifas y presupuestos mostrados son referencias de planificación. No constituyen una reserva, orden de compra ni garantía de inventario. Antes de pautar se confirman por escrito vigencia, disponibilidad, impuestos, producción, derechos, segmentación, medición y negociación final.</p>
        <p>Una campaña solo se considera autorizada cuando existe aprobación expresa del cliente y confirmación operativa de Ad Mavericks. Las acciones que inician gasto se mantienen separadas de la preparación técnica.</p>
      </LegalSection>
      <LegalSection title="4. Pagos y terceros">
        <p>Cuando el cobro electrónico esté habilitado, el pago se realiza en la página segura del proveedor correspondiente. El desglose aplicable se presenta antes de confirmar. Los servicios de medios, mapas, redes sociales, inteligencia artificial y pagos también se rigen por las condiciones de sus respectivos proveedores.</p>
      </LegalSection>
      <LegalSection title="5. Uso permitido">
        <p>No puedes usar la plataforma para contenido ilícito, engañoso o que infrinja derechos; intentar vulnerar cuentas o controles; introducir software malicioso; recopilar datos sin autorización; ni activar publicidad contraria a las reglas del medio o la legislación aplicable.</p>
      </LegalSection>
      <LegalSection title="6. Propiedad intelectual y contenido">
        <p>La plataforma, la marca, el diseño y el software pertenecen a sus titulares. Conservas los derechos sobre las piezas que entregas y declaras contar con permisos suficientes para utilizarlas. Autorizas su tratamiento únicamente para preparar, revisar y ejecutar los servicios solicitados.</p>
      </LegalSection>
      <LegalSection title="7. Disponibilidad y responsabilidad">
        <p>Trabajamos para mantener un servicio seguro y disponible, pero pueden existir mantenimientos, fallos de terceros o cambios de inventario. Las estimaciones no garantizan resultados comerciales. La responsabilidad se determinará según el acuerdo aplicable y la legislación ecuatoriana.</p>
      </LegalSection>
      <LegalSection title="8. Suspensión, cambios y contacto">
        <p>Podemos suspender accesos ante riesgo de seguridad, uso indebido o incumplimiento. Podemos actualizar estos términos y publicaremos la fecha vigente. Para consultas escribe a <a className="font-bold text-forest underline" href="mailto:hola@admavericks.one">hola@admavericks.one</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}

