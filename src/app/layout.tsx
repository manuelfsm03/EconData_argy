import type { Metadata } from "next";
import { Caveat, IBM_Plex_Mono, Inter, Inter_Tight, Newsreader } from "next/font/google";
import "./globals.css";
import "@/client/styles/forum-approved.css";
import "@/client/styles/forum-approved-responsive.css";
import "@/client/styles/forum-bridge.css";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Dos cargas de Inter_Tight con nombre de variable distinto: el Foro (PR #119)
// usa --font-tight, el landing nuevo (feat/landing-hero-logo) usa
// --font-landing-sans con un peso más (300). No se pisan, cada CSS referencia
// la suya.
const interTight = Inter_Tight({
  variable: "--font-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const interTightLanding = Inter_Tight({
  variable: "--font-landing-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Newsreader sí comparte nombre de variable (--font-editorial) entre el Foro
// y el landing nuevo: una sola carga, con la unión de los pesos que pide cada
// rama (300 lo agrega el landing, 400-600 ya lo usaba el Foro).
const newsreader = Newsreader({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

// Tipografía tiza, solo para el título del hero (HeroLanding) — el resto de
// la app sigue con Inter/IBM Plex Mono, esto no toca el panel funcional.
const caveat = Caveat({
  variable: "--font-chalk",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "La Pizarra",
  description: "Dashboard macroeconómico argentino — tipos de cambio, inflación, BCRA, deuda y más",
};

const themeInitScript = `
  (function() {
    try {
      var t = localStorage.getItem('lp-theme') || 'dark';
      document.documentElement.setAttribute('data-theme', t);
    } catch(e) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${ibmPlexMono.variable} ${inter.variable} ${interTight.variable} ${interTightLanding.variable} ${newsreader.variable} ${caveat.variable}`}>
        {children}
      </body>
    </html>
  );
}
