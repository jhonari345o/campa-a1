import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { BILLING_EMAIL, LEGAL_VERSIONS } from "@/lib/legal";

export const metadata: Metadata = { title: "Facturación, devoluciones y contracargos" };

export default function RefundsPage() {
  const mail = `mailto:${BILLING_EMAIL}?subject=Facturación%2C%20devolución%20o%20contracargo%20-%20Ad%20Mavericks`;
  return <LegalPage eyebrow="Pagos" title="Facturación, devoluciones y contracargos" intro="Canal y criterios para revisar cobros relacionados con Ad Mavericks One.">
    <LegalSection title="1. Canal de atención">
      <p>Solicitudes de facturación, corrección de cobro, devolución o contracargo deben enviarse a <a className="font-bold text-forest underline" href={mail}>{BILLING_EMAIL}</a> desde el correo asociado a la cuenta. Incluye empresa, fecha, monto, referencia de la orden y motivo; nunca envíes números completos de tarjeta, CVC, contraseñas ni tokens.</p>
    </LegalSection>
    <LegalSection title="2. Revisión de la solicitud">
      <p>Ad Mavericks verificará la identidad de la persona solicitante, el estado comunicado por el proveedor de pago, la orden, la inversión ya consumida por el medio, el trabajo ejecutado y las obligaciones legales o contables. La recepción de una solicitud no implica aprobación automática.</p>
      <p>Los cargos duplicados, pagos asociados a una orden que no pudo crearse y operaciones no reconocidas reciben revisión prioritaria. Podemos solicitar evidencia adicional por un canal seguro.</p>
    </LegalSection>
    <LegalSection title="3. Inversión publicitaria y servicio">
      <p>La inversión que ya haya sido consumida por una plataforma publicitaria o comprometida con un proveedor puede no ser recuperable. Cualquier saldo no consumido se revisará con la evidencia del medio. La comisión de servicio se evaluará según el trabajo efectivamente realizado y el acuerdo comercial aplicable.</p>
      <p>Las tarifas del procesador de pago, diferencias de liquidación, impuestos y costos de terceros se tratarán según la operación real y la normativa aplicable. Cuando proceda una devolución, se intentará utilizar el medio de pago original.</p>
    </LegalSection>
    <LegalSection title="4. Contracargos">
      <p>Antes de iniciar un contracargo con el emisor, escríbenos para revisar la operación. Si recibimos un contracargo, podremos suspender la orden relacionada mientras entregamos al proveedor de pago la evidencia legítima de autorización, aceptación, entrega y consumo. Esto no limita los derechos irrenunciables del titular o consumidor.</p>
    </LegalSection>
    <LegalSection title="5. Aceptación y versión">
      <p>Antes de abrir el checkout mostramos el desglose total y solicitamos aceptación expresa de estas condiciones. La plataforma registra la versión aceptada, la orden, el usuario y la fecha. Versión vigente: {LEGAL_VERSIONS.payments}.</p>
    </LegalSection>
  </LegalPage>;
}
