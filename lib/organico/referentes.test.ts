import { describe, expect, test } from "vitest";
import { resumirCuenta, type PublicacionPublica } from "./referentes";

const pub = (likes: number | null, coms: number, dias: number, tipo = "REELS", texto = "post"): PublicacionPublica => ({ likes, comentarios: coms, tipo, fecha: new Date(Date.UTC(2026, 9, 20) - dias * 86_400_000).toISOString(), enlace: `https://instagram.com/p/${dias}`, texto });

describe("Referentes orgánicos · resumen de una cuenta con sus publicaciones públicas", () => {
  const pubs = [pub(100, 10, 0), pub(20, 1, 2), pub(30, 2, 4, "FEED"), pub(5000, 300, 6, "REELS", "colaboración con influenciador"), pub(null, 4, 7)];
  const r = resumirCuenta({ usuario: "dra.x", seguidores: 100_000 }, pubs);
  test("medianas de «me gusta» y comentarios (Instagram a veces oculta los «me gusta»: no cuentan como cero)", () => {
    expect(r.medianaMeGusta).toBe(65);
    expect(r.medianaComentarios).toBe(4);
    expect(r.publicaciones).toBe(5);
  });
  test("ritmo de publicación, parte de reels y las mejores (comentarios pesan más que «me gusta»)", () => {
    expect(r.porSemana).toBeCloseTo(5, 0);
    expect(r.parteReels).toBeCloseTo(0.8, 2);
    expect(r.mejores[0]!.texto).toContain("colaboración");
    expect(r.mejores.length).toBeLessThanOrEqual(3);
  });
  test("una cuenta sin publicaciones no rompe", () => {
    expect(resumirCuenta({ usuario: "x", seguidores: 10 }, [])).toMatchObject({ publicaciones: 0, medianaMeGusta: null, porSemana: null });
  });
});
