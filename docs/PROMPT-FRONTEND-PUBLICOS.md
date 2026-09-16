# Prompt para el agente de frontend — pestaña «Públicos»

Copia desde aquí hasta el final y pásaselo al agente. **La pestaña ya existe y funciona** con datos
reales (`app/(panel)/publicos/page.tsx`, ruta `/publicos`, entrada en el menú lateral y en el móvil).
Su trabajo es solo pulir lo visual. Lo funcional está hecho y probado (370 tests): no lo rehagas.

---

Eres el agente de frontend del panel **Oráculo** (Next 15 App Router, React 19, Tailwind 4, tema
CLARO, sin librerías de UI). El motor (`lib/`) **no se toca**. Tampoco `config/**`, `scripts/**`,
`middleware.ts`, `app/(panel)/campanas/acciones.ts`. Componentes en `components/ui.tsx` (`Panel`,
`Kpi`, `Tabla`, `Th`, `Celda`, `Etiqueta`, `Aviso`, `Barra`, `Grid`, `Titulo`); reutilízalos. Cero
jerga técnica en texto visible. Dato ausente = «—». Al terminar: `npm run typecheck && npm test &&
npm run build` deben pasar; no cambies tests. Haz commit tú mismo (solo `app/` y `components/`).

## Qué hay en `/publicos` (léelo antes de tocar)

`const r = await motor()` entrega:

- `r.publicos` (`ResultadoPublicos`, tipo en `@/lib/tipos`): `referencia` (costo por resultado de
  la cuenta), `ganadores` y `todos` (`PublicoEvaluado[]`: `nombre`, `resumen` de la segmentación en
  una frase, `cuadrante` ganador|al_costo|caro|sin_senal, `resultados`, `costoResultado`,
  `diferencia` vs referencia, `gasto`, `frecuencia`, `estado`, `campanaId`, `segmentacion` completa),
  `porTipo` / `porEdad` / `porGenero` / `porRadio` (`GrupoPublico[]`) y `sugerencias`
  (`SegmentacionSugerida[]`: `titulo`, `porQue`, `evidencia[]`, `conjuntoId`).
- `r.referencias` (`EstudioReferencias`): `ciudades[]` (Cartagena, Santa Marta, Medellín, Miami)
  con `aprendizajes[]`, `aQuienLeHablan[]`, `angulos[]`, `servicios[]`, `ganadores[]` (cada uno con
  `verificar` = enlace a la Biblioteca de anuncios) y `transversal[]`.
- `CRITERIOS_PUBLICO` de `@/config/publicos-referencia` (criterio del asesor, no dato).

La página tiene **cuatro bloques que no se mezclan**, en este orden: (1) tus públicos ganadores,
(2) qué segmentación usar, (3) lo que hacen en otras ciudades, (4) criterio del asesor. Cada fila de
conjunto tiene `id="ganador-<id>"` (bloque 1) o `id="conjunto-<id>"` (tabla «Todos»); las
sugerencias enlazan con `#ganador-…` / `#conjunto-…` y el aterrizaje ya resalta la fila.

## Pule estas 6 cosas

1. **Cabecera de bloque**: los cuatro rótulos «Bloque 1 · …», «Bloque 2 · …» deben verse como una
   secuencia: un número grande en círculo (acento para los bloques de dato propio, marino para el
   del mercado, gris para el del criterio) a la izquierda del título del `Panel`.
2. **Tabla de conjuntos** (`TablaPublicos`): la columna «Conjunto · segmentación» es larga; muestra
   el `resumen` de la segmentación como chips pequeños (uno por parte separada por « · ») en vez de
   una línea de texto, con el tipo de público como primer chip en color (advantage=marino,
   similar=acento, remarketing=bien, intereses=ojo, amplio=neutro). Máximo 6 chips y «+N».
3. **Grupos** (por tipo/edad/género/radio): añade una `Barra` por fila proporcional a los
   resultados del grupo, para ver de un vistazo dónde está el volumen; la fila «mejor» en negrita.
4. **Bloque 3 (ciudades)**: las tarjetas por ciudad deben tener la misma altura en cada fila
   (`grid` con `items-stretch`), con la bandera del país como texto (🇨🇴 / 🇺🇸) junto al nombre, y
   «Verificar ↗» siempre visible como botón chico (mismo estilo que en Radar).
5. **Bloque 4 (criterio)**: cada tarjeta con un encabezado «Público N» pequeño y las etiquetas de
   servicio al final; el bloque «Corte» en rojo suave ya existe, déjalo. En móvil, las tarjetas
   deben plegarse (`Plegable` de `components/cliente/plegable.tsx`) mostrando solo el título.
6. **Vacíos**: cuando `r.publicos.sinDatos` o `r.referencias.sinDatos`, el `Aviso` debe ir dentro
   de un `Panel` con el mismo rótulo del bloque, para que la estructura de cuatro bloques no cambie.

Entrega: archivos modificados, una captura de `/publicos` en escritorio y otra en móvil, y el
resultado de `npm run typecheck && npm test && npm run build`.
