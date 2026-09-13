/**
 * Captura anuncios de la Biblioteca pública de Meta con un navegador (Playwright) y los
 * deja en un archivo de tarjetas crudas listo para `npm run importar-radar`.
 *
 *   npm run radar:capturar -- --q "clínica estética barranquilla"          (descubrir quién pauta)
 *   npm run radar:capturar -- --pagina 123456789012345 --nombre "Dermalux"  (seguir a un competidor)
 *   opciones: --pais CO --estado active|inactive|all --max 60 --salida datos/radar-ui.json --sin-imagenes --visible
 *
 * Por qué así: la API oficial no expone comerciales fuera de la UE; Apify cobra por resultado.
 * Este capturador es gratis y guarda los creativos en public/radar/ para que el panel los muestre.
 * Si Meta cambia el DOM, el respaldo es Apify (mismo contrato, ver docs/CONEXION_MCP.md).
 *
 * Requiere una vez: npx playwright install chromium
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import { mapearTarjetaUI, type TarjetaCruda } from "@/lib/adapters/radar.ui";
import { hoyBogota } from "@/lib/format/fechas";

function arg(nombre: string, defecto?: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith("--") ? process.argv[i + 1] : defecto;
}
const flag = (nombre: string) => process.argv.includes(nombre);

const q = arg("--q");
const pagina = arg("--pagina");
const pais = (arg("--pais", "CO") ?? "CO").toUpperCase();
const estado = arg("--estado", "active") ?? "active";
const max = Number(arg("--max", "60"));
const salida = resolve(process.cwd(), arg("--salida", "datos/radar-ui.json") ?? "datos/radar-ui.json");
const descargar = !flag("--sin-imagenes");
const visible = flag("--visible");

if (!q && !pagina) {
  console.error('Uso: npm run radar:capturar -- --q "clínica estética barranquilla" | --pagina <id>');
  process.exit(1);
}

const url = pagina
  ? `https://www.facebook.com/ads/library/?active_status=${estado}&ad_type=all&country=${pais}&view_all_page_id=${pagina}&media_type=all`
  : `https://www.facebook.com/ads/library/?active_status=${estado}&ad_type=all&country=${pais}&q=${encodeURIComponent(q!)}&search_type=keyword_unordered&media_type=all`;

/** Extrae, en el navegador, una tarjeta cruda por cada anuncio con identificador. */
async function extraerTarjetas(page: Page): Promise<TarjetaCruda[]> {
  return page.evaluate(() => {
    const salida: Array<{ texto: string; imagenes: string[]; videosPoster: string[]; enlaces: string[]; paginaHref: string | null; plataformas: string[] }> = [];
    const vistos = new Set<string>();
    const re = /(identificador de la biblioteca|library id)\s*:?\s*\d{6,}/i;
    const reCuerpo = /ver detalles del anuncio|see ad details|publicidad|sponsored/i;

    // Cada tarjeta es el contenedor más pequeño que incluye el identificador Y el cuerpo del anuncio
    // (página, copy, creativo). El encabezado solo (id + fecha) vive en un div hermano más interno.
    const candidatos = Array.from(document.querySelectorAll("div")).filter((d) => {
      const t = d.innerText || "";
      return re.test(t) && reCuerpo.test(t) && t.length > 60 && t.length < 6000 && (t.match(/identificador de la biblioteca|library id/gi) || []).length === 1;
    });
    // Nos quedamos con los más internos (que no contengan otro candidato).
    const internos = candidatos.filter((d) => !candidatos.some((o) => o !== d && d.contains(o)));

    for (const d of internos) {
      const texto = (d.innerText || "").replace(/​/g, "").trim();
      const id = texto.match(/(?:identificador de la biblioteca|library id)\s*:?\s*(\d{6,})/i)?.[1];
      if (!id || vistos.has(id)) continue;
      vistos.add(id);

      const imagenes: string[] = [];
      d.querySelectorAll("img").forEach((img) => {
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w < 200 || h < 200) return;
        let mejor = img.currentSrc || img.src;
        if (img.srcset) {
          let bw = 0;
          for (const cand of img.srcset.split(",")) {
            const [u, dens] = cand.trim().split(/\s+/);
            const n = parseInt((dens || "1x").replace(/\D/g, ""), 10) || 1;
            if (u && n >= bw) {
              bw = n;
              mejor = u;
            }
          }
        }
        if (mejor && mejor.startsWith("http") && !imagenes.includes(mejor)) imagenes.push(mejor);
      });
      const videosPoster: string[] = [];
      d.querySelectorAll("video").forEach((v) => {
        const p = v.getAttribute("poster");
        if (p && p.startsWith("http")) videosPoster.push(p);
        else if (v.currentSrc || v.src) videosPoster.push(v.currentSrc || v.src);
      });
      const enlaces: string[] = [];
      let paginaHref: string | null = null;
      d.querySelectorAll("a[href]").forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        if (!href) return;
        if (/l\.facebook\.com\/l\.php|lm\.facebook\.com/.test(href) || !/facebook\.com|instagram\.com/.test(href)) enlaces.push(href);
        else if (!paginaHref && /facebook\.com\/(?!ads\/library)[^/?#]+\/?(\?id=\d+)?$/.test(href)) paginaHref = href;
      });
      const plataformas: string[] = [];
      const t = texto.toLowerCase();
      // Los iconos de plataforma no tienen texto: se infieren de aria-labels/máscaras cuando existen.
      d.querySelectorAll("[aria-label], [title]").forEach((el) => {
        const lab = ((el.getAttribute("aria-label") || el.getAttribute("title")) ?? "").toLowerCase();
        for (const p of ["facebook", "instagram", "messenger", "audience network", "threads", "whatsapp"]) {
          if (lab.includes(p) && !plataformas.includes(p)) plataformas.push(p);
        }
      });
      if (plataformas.length === 0 && /plataformas|platforms/.test(t)) plataformas.push("facebook");

      salida.push({ texto, imagenes, videosPoster, enlaces, paginaHref, plataformas });
    }
    return salida;
  });
}

async function main() {
  const browser = await chromium.launch({ headless: !visible, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    viewport: { width: 1400, height: 1000 },
    locale: "es-CO",
    timezoneId: "America/Bogota",
  });
  const page = await context.newPage();
  console.log(`Biblioteca de anuncios · ${pagina ? `página ${pagina}` : `"${q}"`} · ${pais} · ${estado}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(6_000);

  // Cerrar diálogo de cookies si aparece.
  for (const texto of ["Permitir todas las cookies", "Allow all cookies", "Aceptar todas", "Solo permitir cookies esenciales"]) {
    const btn = page.getByRole("button", { name: texto }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      break;
    }
  }

  const total = (await page.evaluate(() => (document.body.innerText.match(/~?\s*([\d.,]+)\s+(resultados|results)/i) || [])[1] ?? null)) as string | null;
  if (total) console.log(`Resultados reportados por la Biblioteca: ${total}`);

  // Scroll progresivo hasta reunir `max` tarjetas o agotar.
  let tarjetas: TarjetaCruda[] = [];
  let sinCambio = 0;
  for (let i = 0; i < 40 && tarjetas.length < max && sinCambio < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 1400));
    await page.waitForTimeout(1_600);
    const ahora = await extraerTarjetas(page);
    if (ahora.length === tarjetas.length) sinCambio++;
    else sinCambio = 0;
    tarjetas = ahora;
  }
  // Esperar a que carguen las imágenes visibles y volver a extraer para capturar mejores resoluciones.
  await page.evaluate(async () => {
    await Promise.all(Array.from(document.images).filter((i) => !i.complete).map((i) => new Promise((r) => (i.onload = i.onerror = r))));
  });
  tarjetas = (await extraerTarjetas(page)).slice(0, max);
  console.log(`Tarjetas con identificador: ${tarjetas.length}`);

  // Descarga de creativos a public/radar/<id>.jpg (Meta caduca sus URLs; el archivo local perdura).
  if (descargar) {
    const dir = resolve(process.cwd(), "public", "radar");
    mkdirSync(dir, { recursive: true });
    let n = 0;
    for (const t of tarjetas) {
      const id = t.texto.match(/(?:identificador de la biblioteca|library id)\s*:?\s*(\d{6,})/i)?.[1];
      const src = t.videosPoster[0] ?? t.imagenes[0];
      if (!id || !src) continue;
      const destino = resolve(dir, `${id}.jpg`);
      if (existsSync(destino)) {
        t.urlMediaLocal = `/radar/${id}.jpg`;
        continue;
      }
      try {
        const resp = await context.request.get(src, { timeout: 25_000 });
        if (!resp.ok()) continue;
        const buf = await resp.body();
        if (buf.length < 8_000) continue;
        writeFileSync(destino, buf);
        t.urlMediaLocal = `/radar/${id}.jpg`;
        n++;
      } catch {
        /* siguiente */
      }
    }
    console.log(`Creativos descargados: ${n} (en public/radar/)`);
  }

  await browser.close();

  const hoy = hoyBogota();
  const anuncios = tarjetas.map((t) => mapearTarjetaUI(t, hoy)).filter((a) => a.anuncioId);
  const paginas = new Set(anuncios.map((a) => a.competidorId));
  const previo = existsSync(salida) ? (JSON.parse(readFileSync(salida, "utf8")) as { tarjetas?: TarjetaCruda[] }) : {};
  const fusion = new Map<string, TarjetaCruda>();
  for (const t of previo.tarjetas ?? []) {
    const id = t.texto.match(/(?:identificador de la biblioteca|library id)\s*:?\s*(\d{6,})/i)?.[1];
    if (id) fusion.set(id, t);
  }
  for (const t of tarjetas) {
    const id = t.texto.match(/(?:identificador de la biblioteca|library id)\s*:?\s*(\d{6,})/i)?.[1];
    if (id) fusion.set(id, t);
  }
  writeFileSync(salida, JSON.stringify({ capturadoEn: `${hoy}`, consulta: { q, pagina, pais, estado }, tarjetas: [...fusion.values()] }, null, 2), "utf8");
  console.log(`OK · ${anuncios.length} anuncios de ${paginas.size} páginas en esta corrida · ${fusion.size} acumulados → ${salida}`);
  console.log(`Siguiente: npm run importar-radar -- ${salida.replace(process.cwd() + "\\", "").replace(/\\/g, "/")}`);
  for (const a of anuncios.slice(0, 8)) {
    console.log(`  · ${a.nombreAnunciante} · ${a.diasCorriendo} d · x${a.variantesDelConcepto} · ${a.anguloDetectado} · ${a.copy.slice(0, 70).replace(/\n/g, " ")}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
