const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function buildBankingApiUrl(desde: string, hasta: string): string {
  if (!DATE_RE.test(desde) || !DATE_RE.test(hasta)) {
    throw new Error("Las fechas de bancos deben usar YYYY-MM-DD")
  }
  return `/api/bcra-data?endpoint=bancos&desde=${desde}&hasta=${hasta}`
}
