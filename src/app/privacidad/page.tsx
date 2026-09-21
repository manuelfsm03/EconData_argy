/**
 * /privacidad — Política de Privacidad de La Pizarra
 *
 * Servida estáticamente. Requerida por Google Cloud Console para aprobar
 * la pantalla de consentimiento del OAuth (login con Google).
 *
 * URL pública: https://lapizarra.ar/privacidad
 */

import type { Metadata } from "next"
import Link from "next/link"
import { LegalLayout, H2, P, UL, LI, Section } from "./_legal-layout"

export const metadata: Metadata = {
  title: "Política de Privacidad — La Pizarra",
  description: "Cómo La Pizarra recolecta, usa y protege tus datos personales.",
  robots: { index: true, follow: true },
}

const ULTIMA_ACTUALIZACION = "21 de septiembre de 2026"
const EMAIL_CONTACTO = "lapizarra.ar@gmail.com"

export default function PrivacidadPage() {
  return (
    <LegalLayout titulo="Política de Privacidad" ultimaActualizacion={ULTIMA_ACTUALIZACION}>
      <Section>
        <P>
          La Pizarra (&ldquo;<b>nosotros</b>&rdquo;, &ldquo;<b>el servicio</b>&rdquo;) es un
          proyecto open-source de análisis macroeconómico argentino disponible en{" "}
          <a href="https://lapizarra.ar">lapizarra.ar</a>. Esta política explica qué datos
          personales recolectamos, cómo los usamos y qué derechos tenés sobre ellos.
        </P>
        <P>
          Al usar el servicio aceptás las prácticas descritas en este documento. Si no estás
          de acuerdo, no ingreses ni crees una cuenta.
        </P>
      </Section>

      <H2>1. Qué datos recolectamos</H2>
      <Section>
        <P><b>Datos que vos nos das al registrarte:</b></P>
        <UL>
          <LI><b>Email</b> — para identificarte y enviarte notificaciones esenciales.</LI>
          <LI><b>Contraseña</b> (si te registrás con email) — almacenada cifrada mediante bcrypt por nuestro proveedor de autenticación.</LI>
        </UL>
        <P><b>Datos que recibimos de Google</b> si elegís iniciar sesión con Google:</P>
        <UL>
          <LI><b>Email verificado</b> asociado a tu cuenta de Google.</LI>
          <LI><b>Nombre y foto de perfil públicos</b> — solo para mostrarlos en tu sesión.</LI>
          <LI><b>Identificador único de Google</b> (Google ID) — para vincular tu cuenta.</LI>
        </UL>
        <P>
          No pedimos permisos adicionales de Google (ni contactos, ni Drive, ni Gmail).
          Solo usamos el alcance <code>openid email profile</code>.
        </P>
        <P><b>Datos técnicos automáticos:</b></P>
        <UL>
          <LI>Cookies de sesión emitidas por nuestro proveedor de autenticación (Supabase) para mantenerte logueado.</LI>
          <LI>Preferencias de interfaz (tema claro/oscuro, layout del dashboard) guardadas en el <code>localStorage</code> de tu navegador — no salen de tu equipo.</LI>
          <LI>Logs mínimos de errores del servidor, sin identificadores personales.</LI>
        </UL>
        <P>
          <b>No usamos</b> Google Analytics, píxeles de tracking, ni cookies publicitarias.
        </P>
      </Section>

      <H2>2. Para qué usamos tus datos</H2>
      <Section>
        <UL>
          <LI><b>Autenticarte</b> y mantener tu sesión activa mientras usás el dashboard.</LI>
          <LI><b>Guardar tus preferencias</b> del workspace (watchlists, layouts, etc.) asociadas a tu cuenta.</LI>
          <LI><b>Comunicarte cambios esenciales</b> (por ejemplo, recuperación de contraseña).</LI>
          <LI><b>Prevenir abuso</b> del servicio (rate limiting, detección de accesos anómalos).</LI>
        </UL>
        <P>
          <b>No vendemos</b> tus datos ni los usamos para publicidad. Nunca. La Pizarra es un
          proyecto sin fines de lucro construido por sus autores como herramienta pública.
        </P>
      </Section>

      <H2>3. Con quién compartimos tus datos</H2>
      <Section>
        <P>Trabajamos con un conjunto acotado de proveedores necesarios para operar el servicio:</P>
        <UL>
          <LI>
            <b>Supabase</b> (Postgres administrado + autenticación) — almacena tu email,
            contraseña cifrada y preferencias. Datos alojados en la Unión Europea.{" "}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
              supabase.com/privacy
            </a>.
          </LI>
          <LI>
            <b>Google</b> (si iniciás sesión con Google) — Google nos entrega tu email, nombre
            y foto según los alcances aprobados por vos.{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              policies.google.com/privacy
            </a>.
          </LI>
          <LI>
            <b>Vercel</b> (hosting) — procesa las requests HTTP hacia el sitio. No recibe tu
            contraseña ni tus preferencias persistentes.{" "}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
              vercel.com/legal/privacy-policy
            </a>.
          </LI>
        </UL>
        <P>
          Los datos económicos que muestra el dashboard vienen de fuentes públicas
          (BCRA, INDEC, Ministerio de Economía, etc.). Esas fuentes <b>no reciben</b>{" "}
          información tuya — las consultamos desde nuestro servidor, no desde tu navegador.
        </P>
        <P>
          Podemos compartir tus datos si una autoridad legal argentina así lo requiere por
          orden judicial. En ese caso, te avisaremos por email salvo que la orden nos lo
          impida.
        </P>
      </Section>

      <H2>4. Cuánto tiempo conservamos tus datos</H2>
      <Section>
        <UL>
          <LI><b>Datos de cuenta</b> — mientras tu cuenta esté activa.</LI>
          <LI><b>Sesiones</b> — hasta que cierres sesión o expire la cookie (30 días).</LI>
          <LI><b>Logs de error</b> — 30 días máximo.</LI>
        </UL>
        <P>
          Si eliminás tu cuenta, borramos tus datos personales dentro de los 30 días
          siguientes, salvo que una obligación legal nos obligue a conservar alguno.
        </P>
      </Section>

      <H2>5. Tus derechos</H2>
      <Section>
        <P>
          De acuerdo a la <b>Ley 25.326 de Protección de Datos Personales</b> (Argentina) y
          normas equivalentes, tenés derecho a:
        </P>
        <UL>
          <LI><b>Acceso</b> — pedir una copia de los datos que tenemos sobre vos.</LI>
          <LI><b>Rectificación</b> — corregir datos incorrectos o incompletos.</LI>
          <LI><b>Supresión</b> — pedir la eliminación de tu cuenta y datos asociados.</LI>
          <LI><b>Oposición</b> — oponerte al tratamiento de tus datos en ciertos casos.</LI>
          <LI><b>Portabilidad</b> — recibir tus datos en un formato estructurado.</LI>
        </UL>
        <P>
          Para ejercer cualquiera de estos derechos escribinos a{" "}
          <a href={`mailto:${EMAIL_CONTACTO}`}>{EMAIL_CONTACTO}</a>. Respondemos dentro de
          los 10 días hábiles.
        </P>
        <P>
          El titular del tratamiento es <b>La Pizarra</b> a través del correo indicado.
          También podés dirigir un reclamo a la <b>Agencia de Acceso a la Información
          Pública</b> (argentina.gob.ar/aaip), autoridad de aplicación en Argentina.
        </P>
      </Section>

      <H2>6. Seguridad</H2>
      <Section>
        <P>
          Todas las conexiones al sitio usan HTTPS. Las contraseñas se almacenan cifradas
          (bcrypt) y nunca en texto plano. Los tokens de sesión son firmados y verificados
          en cada request. Aun así, ninguna transmisión por internet es 100% segura — si
          detectás una vulnerabilidad, por favor avisanos a{" "}
          <a href={`mailto:${EMAIL_CONTACTO}`}>{EMAIL_CONTACTO}</a>.
        </P>
      </Section>

      <H2>7. Menores de edad</H2>
      <Section>
        <P>
          La Pizarra no está dirigida a menores de 13 años. Si detectamos una cuenta creada
          por un menor sin autorización, la eliminamos.
        </P>
      </Section>

      <H2>8. Cambios en esta política</H2>
      <Section>
        <P>
          Podemos actualizar este documento. Si el cambio es material (por ejemplo, un
          nuevo proveedor que reciba datos personales), te avisaremos por email antes de
          que entre en vigor. La versión más reciente siempre está en{" "}
          <a href="https://lapizarra.ar/privacidad">lapizarra.ar/privacidad</a> con la fecha
          de última actualización arriba.
        </P>
      </Section>

      <H2>9. Contacto</H2>
      <Section>
        <P>
          Cualquier duda sobre esta política:{" "}
          <a href={`mailto:${EMAIL_CONTACTO}`}>{EMAIL_CONTACTO}</a>.
        </P>
        <P style={{ marginTop: 32 }}>
          <Link href="/terminos" style={{ color: "var(--amber)" }}>
            Ver también: Términos de Servicio →
          </Link>
        </P>
      </Section>
    </LegalLayout>
  )
}
