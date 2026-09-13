# Oráculo — Inteligencia de marketing para la clínica

Un panel que lee los datos de las campañas y de la agenda, encuentra dónde se está perdiendo la
plata, lo dice en pesos y propone qué hacer. Corre en tu computador; no hay servidores ni costos
mensuales. El análisis semanal se hace con el asistente (Claude Code) usando tu suscripción.

---

## Para la coordinadora — 5 pasos

1. **Instala Node.js** (una sola vez): descarga la versión *LTS* en <https://nodejs.org> e instálala con todo por defecto.
2. **Descarga el proyecto**: en GitHub, botón verde **Code → Download ZIP**, descomprime en `Documentos\Oraculo`
   (o clónalo con `git clone …` si ya usas Git).
3. **Ejecuta el instalador**: clic derecho sobre `instalar.ps1` → **Ejecutar con PowerShell**.
   Si Windows pregunta por permisos, acepta. Al terminar, se abre el panel en el navegador con datos de demostración.
4. **Cada semana, actualiza los datos**: abre la carpeta del proyecto en VS Code con Claude Code y escribe
   `/oraculo-sincronizar`. Cuando termine, escribe `/oraculo-semana` para generar el informe de la semana.
5. **Para volver a abrir el panel** otro día: doble clic en `instalar.ps1` de nuevo (ya no reinstala nada),
   o en una terminal dentro de la carpeta: `npm run dev` y entra a <http://localhost:3000/panel>.

¿Una duda sobre la cuenta? Escríbele al asistente `/oraculo-pregunta` seguido de la pregunta.
Por ejemplo: `/oraculo-pregunta ¿subimos el presupuesto de la campaña facial?`

### Qué vas a ver

| Pantalla | Para qué sirve |
|---|---|
| Centro de Mando | Lo que importa hoy: plata en riesgo, qué hacer esta semana |
| Diagnóstico | Cada problema con su evidencia, su acción y cuánto cuesta |
| Oportunidades | Qué probar, con criterio de corte |
| Embudo | Los 8 pasos desde que alguien ve el anuncio hasta que vuelve a comprar |
| Rendimiento | Inversión, retorno declarado, retorno real y retorno sobre margen |
| Creativos | Qué anuncio escalar, arreglar o apagar |
| Audiencias | Dónde se gasta: edad, zona, franja horaria |
| Competencia | Qué sostiene el mercado y dónde hay espacio libre |
| Biblioteca | Mensajes que han funcionado |
| Consejo | Siete marcos de auditoría con su fuente |
| Métricas | Las 145 métricas explicadas |
| Informe | Una página para la reunión de dirección |
| Fuentes | Estado y calidad de los datos |

### Varias cuentas publicitarias

La clínica puede tener varias cuentas de anuncios. Arriba a la izquierda se elige **una**; todo
el panel se recalcula para esa cuenta (nunca se suman entre sí). Las cuentas se definen en
`config/cliente.ts` (`cuentasPublicitarias`); la que aparece sin pauta se muestra "sin pauta".

### Tres cosas que el panel hace a propósito

- Cuando un dato no existe muestra **—**, nunca un cero. "No hubo" y "no sabemos" son cosas distintas.
- Hasta que se calibren los tickets y costos de cada procedimiento (reunión con la clínica), las cifras
  de margen aparecen como **—**. Sin margen real, el retorno no significa nada.
- **No guarda datos de pacientes.** Si alguien intenta cargar nombres o teléfonos, la carga se detiene.

---

## Para desarrollo

```
npm install
npm run seed          # datos de demostración (180 días, deterministas)
npm run typecheck     # TypeScript strict
npm test              # 233 tests (Vitest)
npm run verificar     # corre el motor sin interfaz e imprime hallazgos por plata
npm run radar:capturar -- --q "clínica estética barranquilla"   # radar de competencia (Biblioteca pública, gratis)
npm run importar-radar -- datos/radar-ui.json                   # fusiona el radar en datos/lote.json
npm run dev           # http://localhost:3000/panel
npm run build && npm start
```

**Por qué el contrato manda:** `lib/adapters/types.ts` es la única fuente de verdad del dato. Los
datos de demostración y los reales pasan por el mismo esquema; conectar la fuente real (`datos/lote.json`,
`ORACULO_FUENTE=archivo`) no toca ningún componente. Lee `docs/CONTRATO_DATOS.md`.

Estructura:

```
app/(panel)/*        13 pantallas (Server Components), diseño del agente de frontend integrado
components/          primitivas propias, gráficas SVG propias, selector de cuenta (cookie), sin librerías de UI
lib/adapters/        contrato Zod + fuentes (demostración, archivo) + mapeadores del radar (Biblioteca UI, Apify)
lib/metrics/         núcleo (razones nulables, solo suma crudos), embudo, creativos, catálogo (145), resolver
lib/diagnostics/     motor + 26 reglas deterministas
lib/competitive/     radar por longevidad, clasificador de ángulos, espacios vacíos
lib/opportunities/   hipótesis con criterio de corte, ICE, memoria de experimentos
lib/frameworks/      7 lentes de auditoría con fuente
lib/privacy/         k-anonimato, guardián de datos sensibles
lib/format/          COP, porcentajes, fechas Bogotá, etiquetas públicas
config/              cliente (tickets en cero hasta calibrar), umbrales con origen
scripts/             seed, verificar, validar-lote, radar-capturar (Playwright), importar-radar
.claude/skills/      oraculo-sincronizar · oraculo-semana · oraculo-pregunta
docs/                CONTRATO_DATOS · REGLAS_DIAGNOSTICO · CUMPLIMIENTO · CONEXION_MCP (interno) · PROMPT-FRONTEND
specs/               especificación, plan y tareas (spec-kit)
```

Documento funcional de referencia: `PROMPT_ORACULO_v2.md`. Principios no negociables:
`.specify/memory/constitution.md`.

## Antes de entregar al cliente

1. Calibrar `config/cliente.ts` (tickets, costos, horario, cupos, municipios).
2. Cargar 60 días de agenda y ventas agregados.
3. Definir 6-10 competidores del radio.
4. Revisar `docs/CUMPLIMIENTO.md` con el cliente.
5. Conectar la fuente real (`docs/CONEXION_MCP.md`) en el equipo de la coordinadora.
