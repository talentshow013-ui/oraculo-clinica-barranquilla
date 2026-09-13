# ORÁCULO — Diseño del sistema
**Fecha:** 2026-09-13 · **Cliente:** Clínica estética (Barranquilla) · **Estado:** aprobado

## 1. Qué es

Sistema local de inteligencia de marketing para una clínica estética. Lee los datos de Meta
(Facebook, Instagram, Ads Manager) y los datos reales del negocio (leads, citas, procedimientos
vendidos), calcula el embudo completo hasta el dinero, y un **consejo de agentes de marketing**
(CMO, media buyer, estratega de contenido, copywriter, director creativo, social/community,
SEO/SEM, analista) emite veredictos accionables que el gerente ve en un panel.

**Principio rector:** los números los calcula el código (determinista, testeado); los veredictos
los da el consejo (Claude Code); la decisión la toma el gerente. Claude nunca inventa cifras.

## 2. Restricciones de despliegue

- Corre 100% local en el PC Windows de la coordinadora. Sin backend, sin nube, sin API key de Anthropic.
- El motor de análisis es **Claude Code (VS Code) con la suscripción de la coordinadora**.
- Se distribuye por GitHub: `git clone` + `instalar.ps1`.
- Secretos (token Meta) en `.env`, nunca en el repo.
- Idioma de todo lo visible: español (Colombia).

## 3. Arquitectura — 4 capas

### Capa 1 — Ingesta (`oraculo/ingesta/`)
- **Meta Graph API** (fuente principal): página FB (insights, posts), Instagram (insights, media,
  reels), Ads (campañas/conjuntos/anuncios, insights diarios con desglose), comentarios.
- **CSV** (`datos/meta/`): exportes de Ads Manager / Business Suite como respaldo.
- **Datos de negocio** (`datos/negocio/`): `leads.csv`, `citas.csv`, `ventas.csv` — plantillas
  que llena la coordinadora. Es lo único que permite ROAS real.
- Destino: **DuckDB** embebida en `data/oraculo.duckdb`. Cargas idempotentes (upsert por clave natural).

### Capa 2 — Métricas (`oraculo/metricas/`)
Cálculo determinista, cubierto por tests. Produce `dashboard/data/*.json` (contrato con el panel):
- `resumen.json`: semáforo global, KPIs semana vs semana anterior vs 4 semanas, alertas.
- `embudo.json`: Impresiones → Clics → Leads → Citas → Procedimientos → Ingresos; tasas por etapa;
  por canal (orgánico FB / orgánico IG / pagado) y por procedimiento.
- `campanas.json`: por campaña/conjunto/anuncio: gasto, CPM, CTR, CPL, CPA, ROAS real, frecuencia,
  fatiga creativa (CTR decreciente + frecuencia > 3), veredicto sugerido (MATAR/ESCALAR/PROBAR/OBSERVAR).
- `contenido.json`: por publicación: alcance, engagement rate, save rate, share rate, hook rate
  (reels), score compuesto, tipo (reel/carrusel/imagen), tema/procedimiento detectado, mejor hora/día.
- `comunidad.json`: volumen de comentarios/mensajes, tiempo de respuesta, sentimiento básico,
  preguntas frecuentes (para contenido).
- `roi.json`: ingresos por procedimiento, CAC por canal, ticket promedio, LTV estimado, payback.
- `insights.json`: escrito por el consejo (capa 3) — veredictos, decisiones, próximos pasos.
- `meta.json`: fecha de actualización, rango de datos, calidad de datos (qué faltó).

Anomalías: z-score contra las 4 semanas previas. Benchmarks del nicho en `oraculo/conocimiento/benchmarks.yaml`.

### Capa 3 — Consejo ORÁCULO (`.claude/`)
Comandos (skills) para Claude Code:
- `/oraculo-semana` — war-room semanal: semáforo, 3 decisiones, qué matar/escalar, plan de contenido.
- `/oraculo-campanas` — auditoría de ads con veredicto por anuncio y presupuesto recomendado.
- `/oraculo-contenido` — calendario próxima semana con copies listos y briefs de diseño.
- `/oraculo-diagnostico` — auditoría 360° (embudo, ads, contenido, comunidad, ROI, competencia).
- `/oraculo-pregunta` — el gerente pregunta en lenguaje natural; el consejo responde con datos.

Agentes (`.claude/agents/`): `cmo` (orquesta y sintetiza), `media-buyer`, `estratega-contenido`,
`copywriter`, `director-creativo`, `social-community`, `seo-sem`, `analista-datos`.
Cada agente lee `clinica.yaml` + su base de conocimiento en `oraculo/conocimiento/` (nicho estético
Barranquilla: estacionalidad, objeciones, regulación de publicidad médica en Colombia, benchmarks).
Salidas: `reportes/YYYY-Www-<tipo>.md` + `dashboard/data/insights.json`.

Regla dura: todo veredicto cita la métrica y el archivo JSON de donde sale.

### Capa 4 — Panel (`dashboard/`, lo construye el agente Design)
SPA estática (HTML/JS), sin servidor, lee `dashboard/data/*.json`. Vistas: Resumen ejecutivo,
Embudo, Campañas, Contenido, Comunidad, ROI. Se entrega `PROMPT-FRONTEND.md` con contrato de
datos, vistas, y decisión que habilita cada pantalla.

## 4. Flujo de la coordinadora
1. Semanal: llena `datos/negocio/*.csv` (o los exporta del sistema de agenda).
2. `oraculo actualizar` → fetch API + import CSV + métricas + abre el panel.
3. En Claude Code: `/oraculo-semana` → reporte + veredictos en el panel.
4. Envía el reporte al gerente / lo revisan en el panel.

## 5. CLI (`oraculo`)
`oraculo init` (crea `.env`, `clinica.yaml`, plantillas) · `oraculo fetch [--desde --hasta]` ·
`oraculo import` · `oraculo calcular` · `oraculo actualizar` (todo) · `oraculo panel` · `oraculo doctor`
(verifica token, permisos, datos faltantes).

## 6. Stack
Python 3.12 + uv · DuckDB · httpx (Graph API v21+) · pydantic (config/contratos) · typer (CLI) ·
pytest · PowerShell para instalador. Sin dependencias pesadas.

## 7. Manejo de errores
- Token vencido/permiso faltante → `oraculo doctor` lo dice en español con el paso para arreglarlo.
- API caída → se usa lo último en DuckDB y `meta.json` marca datos desactualizados; el panel lo muestra.
- CSV mal formado → se reporta fila y columna; no se carga parcial.
- Rate limits → backoff exponencial; paginación completa.

## 8. Testing
- Métricas: pytest con fixtures sintéticas (embudo, ROAS, fatiga, anomalías, scoring). TDD.
- Ingesta: tests contra respuestas grabadas de Graph API (sin red).
- Contratos JSON: validación pydantic + `schemas/*.json` que el frontend puede usar.

## 9. Fuera de alcance (v1)
CRM en vivo, WhatsApp API, Google Ads, TikTok, multi-clínica, servidor web.

## 10. Entregables
Repo con instalador · consejo completo · pipeline · tests · `PROMPT-FRONTEND.md` · `README.md`
para la coordinadora (5 pasos) · `docs/` para el gerente.
