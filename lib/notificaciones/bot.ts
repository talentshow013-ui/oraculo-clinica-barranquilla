/**
 * Bot de Telegram que RESPONDE: la coordinadora le escribe (texto, nota de voz o foto) y Oráculo
 * contesta con los números del motor. Solo hablan con él los chats de `TELEGRAM_CHAT_ID`.
 *
 * Reparto: aquí lo puro (qué puede entrar, qué contexto se le da al modelo, cómo se arma y se lee
 * la petición); `scripts/telegram-bot.ts` es el que escucha, descarga y envía. Los números vienen
 * del motor y el modelo solo los explica: se le prohíbe inventar en la instrucción de sistema.
 */
import type { ResultadoMotor } from "@/lib/datos";

/** Modelos en orden: el del .env (GEMINI_MODELO) y, si ese está saturado o retirado, los siguientes. */
export const MODELOS_GEMINI = [...new Set([process.env.GEMINI_MODELO, "gemini-3.5-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"].filter((m): m is string => !!m))];
export const MODELO_GEMINI = MODELOS_GEMINI[0]!;

/** ¿Este chat está en la lista (`TELEGRAM_CHAT_ID=111,222`)? Nadie más recibe respuesta. */
export function chatPermitido(chatId: string, lista: string | undefined): boolean {
  if (!lista) return false;
  return lista.split(",").map((x) => x.trim()).filter(Boolean).includes(String(chatId));
}

export type Entrada =
  | { tipo: "texto"; texto: string }
  | { tipo: "audio"; fileId: string; mime: string; texto: string }
  | { tipo: "imagen"; fileId: string; mime: string; texto: string }
  | { tipo: "otro"; texto: string };

interface MensajeTelegram {
  text?: string;
  caption?: string;
  voice?: { file_id: string; mime_type?: string };
  audio?: { file_id: string; mime_type?: string };
  photo?: { file_id: string; width?: number }[];
  document?: { file_id: string; mime_type?: string };
}

/** Qué mandó la persona: texto, nota de voz/audio, foto (la versión más grande) o algo que no se atiende. */
export function tipoDeMensaje(m: MensajeTelegram): Entrada {
  const texto = (m.text ?? m.caption ?? "").trim();
  if (m.voice) return { tipo: "audio", fileId: m.voice.file_id, mime: m.voice.mime_type ?? "audio/ogg", texto };
  if (m.audio) return { tipo: "audio", fileId: m.audio.file_id, mime: m.audio.mime_type ?? "audio/mpeg", texto };
  if (m.photo?.length) {
    const grande = [...m.photo].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]!;
    return { tipo: "imagen", fileId: grande.file_id, mime: "image/jpeg", texto };
  }
  if (m.document?.mime_type?.startsWith("image/")) return { tipo: "imagen", fileId: m.document.file_id, mime: m.document.mime_type, texto };
  if (m.text) return { tipo: "texto", texto };
  return { tipo: "otro", texto };
}

export interface CuentaParaBot {
  nombre: string;
  r: Pick<ResultadoMotor, "hoy" | "lote" | "reciente" | "previa" | "serie" | "campanas" | "hallazgos" | "plataEnRiesgoTotal" | "organico" | "pacientes" | "web">;
}

const r0 = (v: number | null | undefined) => (v == null ? null : Math.round(v));
const r3 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 1000) / 1000);

function pauta(a: { gasto: number; impresiones: number; clicsEnlace: number; resultados: number; conversacionesIniciadas?: number | null; costoConversacion?: number | null }) {
  return { gasto: r0(a.gasto), impresiones: a.impresiones, clicsEnlace: a.clicsEnlace, resultados: a.resultados, conversaciones: a.conversacionesIniciadas ?? null, costoPorConversacion: r0(a.costoConversacion) };
}

/**
 * Lo que el modelo necesita para contestar lo que pregunta un dueño: por cuenta, los últimos 14 días y
 * los 14 anteriores, ayer y los últimos 7 días, campañas al aire, hallazgos con plata; y una sola vez
 * orgánico, pacientes y sitio web. JSON compacto (miles de caracteres, no decenas de miles).
 */
export function componerContexto(cuentas: ReadonlyArray<CuentaParaBot>, hoy: string): string {
  const primera = cuentas[0]?.r;
  const salida: Record<string, unknown> = {
    hoy,
    nota: "Cifras en pesos colombianos (COP). 'ultimos14Dias' y '14DiasAnteriores' son ventanas iguales para comparar. 'ayer' es el último día completo con datos.",
    cuentas: cuentas.map(({ nombre, r }) => {
      const conDatos = r.serie.filter((p) => p.agregado);
      const ayer = conDatos[conDatos.length - 1];
      return {
        nombre,
        datosHasta: r.lote.meta.hasta,
        ultimos14Dias: pauta(r.reciente),
        "14DiasAnteriores": pauta(r.previa),
        ayer: ayer ? { fecha: ayer.fecha, ...pauta(ayer.agregado!) } : null,
        ultimos7Dias: conDatos.slice(-7).map((p) => ({ fecha: p.fecha, gasto: r0(p.agregado!.gasto), conversaciones: p.agregado!.conversacionesIniciadas ?? null })),
        campanasAlAire: r.campanas.filter((c) => c.alAire).map((c) => ({ nombre: c.nombre, estado: c.estado, gastoPeriodo: r0(c.total.gasto), conversaciones: c.total.conversacionesIniciadas ?? null, costoPorConversacion: r0(c.costoConversacion), ultimoDia: c.ultimoDia })),
        campanasPausadas: r.campanas.filter((c) => !c.alAire).slice(0, 8).map((c) => ({ nombre: c.nombre, estado: c.estado, gastoPeriodo: r0(c.total.gasto), ultimoDia: c.ultimoDia })),
        plataEnRiesgo: r0(r.plataEnRiesgoTotal),
        hallazgos: r.hallazgos.slice(0, 6).map((h) => ({ titulo: h.titulo, explicacion: h.explicacion, severidad: h.severidad, plataEnRiesgo: r0(h.plataEnRiesgo), acciones: h.acciones.slice(0, 2) })),
      };
    }),
  };
  if (primera?.organico && !primera.organico.sinDatos) {
    salida.organico = {
      redes: primera.organico.redes.map((x) => ({ red: x.red, alias: x.alias, seguidores: x.seguidores, seguidoresGanadosPeriodo: x.seguidoresGanados, publicaciones: x.publicaciones, alcance: x.alcance, tasaInteraccion: r3(x.tasaInteraccion) })),
      merecenPauta: primera.organico.paraPauta.slice(0, 4).map((p) => ("titulo" in p ? (p as { titulo: string }).titulo : JSON.stringify(p).slice(0, 80))),
    };
  }
  if (primera?.pacientes && !primera.pacientes.sinDatos) {
    salida.pacientes = { totales: primera.pacientes.totales, tasas: Object.fromEntries(Object.entries(primera.pacientes.tasas).map(([k, v]) => [k, r3(v as number | null)])) };
  }
  if (primera?.web && !primera.web.sinDatos) {
    salida.web = { resumen: primera.web.resumen, pautaMeta: primera.web.pautaMeta };
  }
  return JSON.stringify(salida);
}

export const INSTRUCCION_SISTEMA = [
  "Eres ORÁCULO, el director de marketing y analítica de Estética Vivante, una clínica estética en Barranquilla (Colombia). Hablas por Telegram con la coordinadora y la gerencia: personas con prisa, sin conocimientos técnicos.",
  "",
  "Reglas:",
  "1. Respondes SOLO con los números del JSON de contexto. Si un dato no está, dices «ese dato no lo tengo» y qué haría falta. Jamás inventes cifras, promedios ni comparaciones con el mercado.",
  "2. Corto: 3 a 8 líneas. Primera línea = la respuesta o la decisión. Luego el dato que la sostiene. Luego qué hacer, si aplica. Sin saludos largos, sin jerga (di «conversaciones», no «leads de messenger»; «plata», no «spend»).",
  "3. Pesos colombianos con punto de miles: $1.250.000. Porcentajes con una decimal.",
  "4. «hoy» en el contexto es la fecha de hoy; los datos de pauta llegan hasta 'datosHasta'. Si preguntan por hoy y los datos van hasta ayer, responde con ayer y dilo en cuatro palabras.",
  "5. Si te mandan una nota de voz, entiéndela y responde a lo que preguntan; no la transcribas.",
  "6. Si te mandan una foto (una captura del administrador de anuncios, un anuncio, una publicación), describe lo que ves en una línea y opina como director de marketing: qué está bien, qué cambiar, y crúzalo con los números del contexto si aplica.",
  "7. Nunca cambias nada en las plataformas ni prometes hacerlo: si piden «apaga X», respondes qué recomiendas y que se lo pidan al Oráculo del computador (Claude Code), que lo hace con confirmación.",
  "8. Nunca menciones nombres, teléfonos ni datos de pacientes; solo conteos.",
  "9. Sin markdown: nada de asteriscos, almohadillas ni tablas. Texto plano con saltos de línea y, si acaso, «•» para listas.",
].join("\n");

export interface PeticionGemini {
  system_instruction: { parts: { text: string }[] };
  contents: { role: "user"; parts: ({ text: string } | { inline_data: { mime_type: string; data: string } })[] }[];
  generationConfig: { temperature: number; maxOutputTokens: number };
}

/** Arma la petición a Gemini: instrucción de sistema, contexto (JSON del motor), adjunto (audio/imagen en base64) y la pregunta. */
export function armarPeticionGemini(x: { sistema: string; contexto: string; texto: string; adjunto?: { mime: string; base64: string } | null }): PeticionGemini {
  const parts: PeticionGemini["contents"][0]["parts"] = [{ text: `CONTEXTO (JSON del motor de Oráculo, fecha y cifras reales):\n${x.contexto}` }];
  if (x.adjunto) parts.push({ inline_data: { mime_type: x.adjunto.mime, data: x.adjunto.base64 } });
  const pregunta = x.texto.trim() || (x.adjunto ? (x.adjunto.mime.startsWith("audio/") ? "Responde a lo que pregunto en esta nota de voz." : "Mira esta imagen y dime qué opinas como director de marketing.") : "¿Cómo vamos?");
  parts.push({ text: `PREGUNTA: ${pregunta}` });
  return { system_instruction: { parts: [{ text: x.sistema }] }, contents: [{ role: "user", parts }], generationConfig: { temperature: 0.3, maxOutputTokens: 2000 } };
}

/** Texto de la respuesta de Gemini, o null si vino vacía o con error. */
export function extraerTextoGemini(json: unknown): string | null {
  const j = json as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const t = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  return t ? t : null;
}

/** Telegram en texto plano: fuera asteriscos, títulos y guiones de markdown. */
export function limpiarParaTelegram(t: string): string {
  return t
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1$2")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
}
