/**
 * Referentes ORGÁNICOS: cómo les va en Instagram a las clínicas y doctoras que mejor lo hacen, con sus
 * publicaciones públicas (API oficial de Instagram, Business Discovery). Meta no da alcance ni vistas de
 * cuentas ajenas: solo «me gusta», comentarios, texto, tipo y fecha. Se compara con los mismos números.
 */
export interface PublicacionPublica {
  /** null = la cuenta oculta los «me gusta» de esa publicación. */
  likes: number | null;
  comentarios: number;
  /** REELS, FEED… */
  tipo: string;
  fecha: string;
  enlace: string;
  texto: string;
}

export interface ResumenReferente {
  usuario: string;
  seguidores: number;
  publicaciones: number;
  medianaMeGusta: number | null;
  medianaComentarios: number | null;
  /** Publicaciones por semana en el tramo leído. */
  porSemana: number | null;
  parteReels: number | null;
  mejores: PublicacionPublica[];
}

const mediana = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export function resumirCuenta(c: { usuario: string; seguidores: number }, pubs: ReadonlyArray<PublicacionPublica>): ResumenReferente {
  const fechas = pubs.map((p) => Date.parse(p.fecha)).filter(Number.isFinite);
  const dias = fechas.length > 1 ? (Math.max(...fechas) - Math.min(...fechas)) / 86_400_000 : 0;
  const peso = (p: PublicacionPublica) => (p.likes ?? 0) + p.comentarios * 3;
  return {
    usuario: c.usuario,
    seguidores: c.seguidores,
    publicaciones: pubs.length,
    medianaMeGusta: mediana(pubs.filter((p) => p.likes != null).map((p) => p.likes!)),
    medianaComentarios: mediana(pubs.map((p) => p.comentarios)),
    porSemana: dias > 0 ? Math.round(((pubs.length / dias) * 7) * 10) / 10 : null,
    parteReels: pubs.length ? pubs.filter((p) => p.tipo === "REELS").length / pubs.length : null,
    mejores: [...pubs].sort((a, b) => peso(b) - peso(a)).slice(0, 3),
  };
}
