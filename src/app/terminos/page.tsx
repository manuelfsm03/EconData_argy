/**
 * /terminos — Términos de Servicio de La Pizarra
 *
 * Servida estáticamente. Requerida por Google Cloud Console junto con
 * la política de privacidad para aprobar la pantalla de consentimiento OAuth.
 */

import type { Metadata } from "next"
import Link from "next/link"
import { LegalLayout, H2, P, UL, LI, Section } from "../privacidad/_legal-layout"

export const metadata: Metadata = {
  title: "Términos de Servicio — La Pizarra",
  description: "Condiciones de uso del servicio La Pizarra.",
  robots: { index: true, follow: true },
}

const ULTIMA_ACTUALIZACION = "21 de septiembre de 2026"
const EMAIL_CONTACTO = "lapizarra.ar@gmail.com"

export default function TerminosPage() {
  return (
    <LegalLayout titulo="Términos de Servicio" ultimaActualizacion={ULTIMA_ACTUALIZACION}>
      <Section>
        <P>
          Estos términos regulan el uso de <b>La Pizarra</b> (
          <a href="https://lapizarra.ar">lapizarra.ar</a>), un dashboard público de análisis
          macroeconómico argentino. Al acceder al servicio aceptás estos términos.
        </P>
      </Section>

      <H2>1. Qué es La Pizarra</H2>
      <Section>
        <P>
          La Pizarra reúne y visualiza datos económicos <b>públicos</b> provenientes de fuentes
          oficiales (BCRA, INDEC, Ministerio de Economía, entre otras). No somos ninguna de esas
          fuentes; nos limitamos a consumir sus datos abiertos, procesarlos y presentarlos.
        </P>
        <P>
          El servicio es <b>gratuito</b> y sin fines de lucro. El código fuente está
          disponible en{" "}
          <a href="https://github.com/manuelfsm03/EconData_argy" target="_blank" rel="noopener noreferrer">
            github.com/manuelfsm03/EconData_argy
          </a>.
        </P>
      </Section>

      <H2>2. No es asesoramiento financiero</H2>
      <Section>
        <P>
          La información que mostramos tiene fines <b>informativos y educativos</b>. No
          constituye asesoramiento financiero, legal, contable ni de inversión. Cualquier
          decisión que tomes basada en datos del sitio es de tu exclusiva responsabilidad.
        </P>
        <P>
          Consultá a un profesional matriculado antes de operar instrumentos financieros.
        </P>
      </Section>

      <H2>3. Exactitud de los datos</H2>
      <Section>
        <P>
          Hacemos nuestro mejor esfuerzo por mantener los datos actualizados y verificar
          las fuentes, pero <b>no garantizamos</b> que la información esté libre de errores,
          retrasos u omisiones. Las fuentes originales pueden corregir sus datos sin aviso.
        </P>
        <P>
          Si detectás un error, avisanos a{" "}
          <a href={`mailto:${EMAIL_CONTACTO}`}>{EMAIL_CONTACTO}</a>.
        </P>
      </Section>

      <H2>4. Tu cuenta</H2>
      <Section>
        <UL>
          <LI>Sos responsable de mantener la confidencialidad de tu contraseña.</LI>
          <LI>Los datos que ingresás (email, preferencias) deben ser exactos y no violar derechos de terceros.</LI>
          <LI>Podés cerrar tu cuenta en cualquier momento escribiendo a {EMAIL_CONTACTO}.</LI>
        </UL>
      </Section>

      <H2>5. Uso aceptable</H2>
      <Section>
        <P>No podés:</P>
        <UL>
          <LI>Intentar acceder sin autorización a sistemas o datos ajenos.</LI>
          <LI>Hacer scraping automatizado abusivo que afecte la disponibilidad del servicio.</LI>
          <LI>Usar el servicio para actividades ilegales o para dañar a terceros.</LI>
          <LI>Redistribuir los datos presentándolos como propios sin citar la fuente original.</LI>
        </UL>
      </Section>

      <H2>6. Propiedad intelectual</H2>
      <Section>
        <P>
          El <b>código fuente</b> de La Pizarra tiene una licencia open source que se puede
          consultar en el repositorio. Los <b>datos económicos</b> pertenecen a sus fuentes
          originales (BCRA, INDEC, etc.) y se usan bajo sus términos de datos abiertos.
        </P>
        <P>
          El diseño, marca y contenidos editoriales originales del sitio son propiedad de
          los autores de La Pizarra.
        </P>
      </Section>

      <H2>7. Limitación de responsabilidad</H2>
      <Section>
        <P>
          En la máxima medida permitida por la ley, La Pizarra y sus autores <b>no serán
          responsables</b> por daños indirectos, pérdidas económicas, decisiones de inversión
          equivocadas ni interrupciones del servicio derivadas del uso del sitio.
        </P>
        <P>
          El servicio se ofrece &ldquo;tal como está&rdquo;, sin garantías de disponibilidad
          continua ni de idoneidad para un propósito particular.
        </P>
      </Section>

      <H2>8. Cambios y terminación</H2>
      <Section>
        <P>
          Podemos modificar el servicio o discontinuarlo en cualquier momento, avisando con
          anticipación razonable cuando sea posible. También podemos suspender cuentas que
          incumplan estos términos.
        </P>
        <P>
          Podemos actualizar estos términos; la versión vigente siempre está en{" "}
          <a href="https://lapizarra.ar/terminos">lapizarra.ar/terminos</a> con la fecha
          actualizada.
        </P>
      </Section>

      <H2>9. Ley aplicable</H2>
      <Section>
        <P>
          Estos términos se rigen por las leyes de la <b>República Argentina</b>. Cualquier
          controversia se someterá a los tribunales ordinarios de la Ciudad Autónoma de
          Buenos Aires.
        </P>
      </Section>

      <H2>10. Contacto</H2>
      <Section>
        <P>
          Cualquier pregunta sobre estos términos:{" "}
          <a href={`mailto:${EMAIL_CONTACTO}`}>{EMAIL_CONTACTO}</a>.
        </P>
        <P style={{ marginTop: 32 }}>
          <Link href="/privacidad" style={{ color: "var(--amber)" }}>
            Ver también: Política de Privacidad →
          </Link>
        </P>
      </Section>
    </LegalLayout>
  )
}
