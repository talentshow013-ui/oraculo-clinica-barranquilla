import { describe, expect, test } from "vitest";
import { PublicacionOrganicaSchema } from "./types";
import { leerCsv, mapearVideosTikTok, mapearDiasTikTok, detectarTipoCsv } from "./organico.tiktok";

const CSV_VIDEOS = `Video title,Post time,Video link,Total views,Total likes,Total comments,Total shares,Average watch time,Reach
"Criolipólisis: antes y después 😍",2026-09-10 18:30:00,https://www.tiktok.com/@vivante/video/7300000000000000001,15400,820,44,63,6.8,12100
"Hifu sin dolor",2026-09-08 09:05:00,https://www.tiktok.com/@vivante/video/7300000000000000002,3200,120,5,8,4.1,`;

const CSV_VIDEOS_ES = `Título del video,Hora de publicación,Enlace del video,Visualizaciones totales,Me gusta totales,Comentarios totales,Veces compartido,Tiempo promedio de visualización
"Peeling en 30 segundos",2026-09-05 12:00:00,https://www.tiktok.com/@vivante/video/7300000000000000003,900,40,2,1,3.2`;

const CSV_DIAS = `Date,Video views,Profile views,Likes,Comments,Shares,Followers,Net followers
2026-09-10,20000,300,900,50,70,12500,35
2026-09-11,18000,250,700,40,60,12520,20`;

describe("TikTok orgánico · CSV de TikTok Studio", () => {
  test("lector de CSV con comillas, comas dentro y celdas vacías", () => {
    const filas = leerCsv('a,b,c\n"x, y",2,\n');
    expect(filas).toEqual([{ a: "x, y", b: "2", c: "" }]);
  });
  test("detecta si el archivo es de videos o de días", () => {
    expect(detectarTipoCsv(leerCsv(CSV_VIDEOS))).toBe("videos");
    expect(detectarTipoCsv(leerCsv(CSV_DIAS))).toBe("dias");
    expect(detectarTipoCsv([{ x: "1" }])).toBe("desconocido");
  });
  test("videos en inglés → publicaciones con id del enlace, hora local, métricas y vacíos como —", () => {
    const p = mapearVideosTikTok(leerCsv(CSV_VIDEOS));
    expect(p).toHaveLength(2);
    expect(PublicacionOrganicaSchema.safeParse(p[0]).success).toBe(true);
    expect(p[0]).toMatchObject({ id: "7300000000000000001", red: "tiktok", formato: "video", publicadoEn: "2026-09-10T18:30", texto: "Criolipólisis: antes y después 😍", enlace: "https://www.tiktok.com/@vivante/video/7300000000000000001", vistas: 15400, meGusta: 820, comentarios: 44, compartidos: 63, segundosPromedio: 6.8, alcance: 12100, interacciones: 927, guardados: null });
    expect(p[1]!.alcance).toBeNull();
  });
  test("videos en español → mismas columnas", () => {
    const p = mapearVideosTikTok(leerCsv(CSV_VIDEOS_ES));
    expect(p[0]).toMatchObject({ id: "7300000000000000003", texto: "Peeling en 30 segundos", vistas: 900, meGusta: 40, segundosPromedio: 3.2 });
  });
  test("días → serie con seguidores nuevos, totales, vistas e interacciones", () => {
    const d = mapearDiasTikTok(leerCsv(CSV_DIAS));
    expect(d[0]).toEqual({ red: "tiktok", fecha: "2026-09-10", seguidoresNuevos: 35, seguidoresTotal: 12500, alcance: null, vistas: 20000, interacciones: 1020 });
  });
});
