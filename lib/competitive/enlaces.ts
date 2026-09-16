/**
 * Enlaces públicos para verificar lo que dice el radar. Todo lo que se afirma de un competidor
 * debe poder abrirse en la Biblioteca de anuncios de Meta con un clic; si no, no se afirma.
 */
const BIBLIOTECA = "https://www.facebook.com/ads/library/";

/** El anuncio exacto, por su id de la Biblioteca. */
export function urlAnuncioBiblioteca(anuncioId: string): string {
  return `${BIBLIOTECA}?id=${encodeURIComponent(anuncioId)}`;
}

/** Búsqueda por palabras en Colombia (para comprobar quién pauta —o que nadie pauta— un tema). */
export function urlBusquedaBiblioteca(consulta: string, pais = "CO"): string {
  const q = encodeURIComponent(consulta.trim().replace(/\s+/g, " "));
  return `${BIBLIOTECA}?active_status=all&ad_type=all&country=${pais}&q=${q}&search_type=keyword_unordered&media_type=all`;
}

/** Todos los anuncios de una página, si se conoce su id numérico; si no, la búsqueda por su nombre. */
export function urlAnunciosDePagina(nombre: string, urlPagina: string | null, pais = "CO"): string {
  const id = urlPagina?.match(/facebook\.com\/(\d{6,})\/?$/)?.[1];
  if (id) return `${BIBLIOTECA}?active_status=all&ad_type=all&country=${pais}&view_all_page_id=${id}&search_type=page`;
  return urlBusquedaBiblioteca(nombre, pais);
}
