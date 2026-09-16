/**
 * Rutas para llegar a un anuncio con un clic, desde cualquier pantalla. Una sola fuente: si cambia
 * la pantalla de Creativos, cambia aquí y todos los enlaces (hallazgos, tablas, podio, copys) siguen.
 */

/** La ficha del anuncio dentro del panel (sección «Anuncio señalado» de Creativos). */
export function rutaAnuncio(anuncioId: string): string {
  return `/creativos?anuncio=${encodeURIComponent(anuncioId)}#anuncio-${anuncioId}`;
}

/** El mismo anuncio en el administrador de anuncios de Meta, para editarlo o prenderlo allá. */
export function urlAnuncioEnMeta(cuentaId: string, anuncioId: string): string {
  const cuenta = cuentaId.replace(/^act_/, "");
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${cuenta}&selected_ad_ids=${anuncioId}`;
}

/** Una campaña en el administrador de anuncios de Meta. */
export function urlCampanaEnMeta(cuentaId: string, campanaId: string): string {
  const cuenta = cuentaId.replace(/^act_/, "");
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cuenta}&selected_campaign_ids=${campanaId}`;
}
