// Tipos que el CLI reconoce de la API pública de La Pizarra.
// Solo modelamos los campos que efectivamente usamos, para no acoplarnos
// a cada cambio interno del backend.

export interface DolarRate {
  compra: number;
  venta: number;
  nombre: string;
  actualizacion: string | null;
  variacion: number | null;
}

export interface DolaresResponse {
  success: boolean;
  source?: string;
  timestamp?: string | null;
  as_of?: string | null;
  checked_at?: string;
  rates: Record<string, DolarRate>;
  spreads: {
    brechaBlueOficial?: number | null;
    brechaMepOficial?: number | null;
    brechaCclOficial?: number | null;
    brechaCclMep?: number | null;
  };
}

export interface SeriePunto {
  fecha: string;
  valor: number;
}

// Un bono, tal cual lo devuelve /api/bonos (screener). Solo tocamos los
// campos que la vista pretty y csv necesitan.
export interface Bono {
  ticker: string;
  nombre?: string;
  ley?: string;
  cupon?: number | null;
  vencimiento?: string | null;
  precio?: number | null;
  tir?: number | null;
  durationMod?: number | null;
  paridad?: number | null;
  currentYield?: number | null;
  change1D?: number | null;
  asOf?: string | null;
  fuente?: string | null;
  priceStatus?: string | null;
}

// Riesgo país — subset de lo que devuelve /api/riesgo-pais.
export interface RiesgoPaisResponse {
  data: {
    actual: {
      riesgoPaisBps: number | null;
      var1w: number | null;
      var1m: number | null;
      spreadAr: number | null;
      us10y: number | null;
      arTir: number | null;
      gd30Precio: number | null;
      metodologia: string;
    };
    regionales: Record<
      string,
      { bps: number; moneda: string; nota: string; esVivo: boolean }
    >;
    globalesTir: Array<{
      ticker: string;
      tir: number | null;
      precio: number | null;
      durationMod: number | null;
    }>;
  };
  updated_at: string;
  source: string;
}

// Fila del pizarrón agro (Rosario).
export interface AgroGrano {
  disponible: number | null;
  fobOficial: number | null;
  retencion: number;
  unidad: string;
}

export interface AgroLocalResponse {
  soja: AgroGrano;
  maiz: AgroGrano;
  trigo: AgroGrano;
  girasol: AgroGrano;
  updated_at: string;
  source: string;
}

// Ítem de noticias tal como lo devuelve /api/news o /api/rss-news.
export interface NewsItem {
  id?: string;
  title: string;
  link: string;
  description?: string | null;
  source?: string;
  pubDate?: string;
  category?: string;
  region?: string;
}

// Punto de inflación como lo devuelve /api/inflation.
export interface InflationPoint {
  date?: string;
  fecha?: string;
  value?: number;
  valor?: number;
  monthlyChange?: number | null;
  yearlyChange?: number | null;
}
