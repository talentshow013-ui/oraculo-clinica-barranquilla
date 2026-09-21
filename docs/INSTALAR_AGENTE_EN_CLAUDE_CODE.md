# Instalar el agente Oráculo en otro Claude Code (PC de la clínica, de la agencia o la VPS)

Oráculo son tres cosas: el **panel** (Next.js), el **motor** (`lib/`) y el **agente** (Claude Code con
las instrucciones de `CLAUDE.md`, las reglas de `.specify/memory/constitution.md` y los tres skills de
`.claude/skills/`). Todo vive en el repositorio; instalarlo en otro Claude Code es clonar el repo y
autorizar los conectores **una sola vez**.

## Reloj diario en Windows (para que responda en segundos)
Una sola vez, en PowerShell dentro de la carpeta `oraculo`:
`powershell -ExecutionPolicy Bypass -File deploy\instalar-reloj-windows.ps1`
Desde ahí, todos los días a las 6 a. m. (o al encender el PC) trae Meta, Google, Kommo, orgánico y
sitio web solos. El agente nunca tiene que ir a buscar nada en medio de una pregunta.

## 1. Requisitos en esa máquina

- Node.js 22 (`node -v`), Git y `gh` (opcional).
- Claude Code instalado y con sesión: `npm i -g @anthropic-ai/claude-code` → `claude` (abre un enlace;
  se inicia sesión con la suscripción de quien vaya a usarlo).
- Acceso de lectura al repositorio privado `talentshow013-ui/oraculo-clinica-barranquilla`
  (colaborador en GitHub o llave de despliegue de solo lectura).

## 2. Traer el proyecto

```bash
git clone git@github.com:talentshow013-ui/oraculo-clinica-barranquilla.git oraculo
cd oraculo
npm ci
cp .env.example .env        # ORACULO_FUENTE=archivo · usuario y clave del candado del panel
npm run doctor              # dice qué falta en ese equipo
```

## 3. Conectar Meta (una vez, con el Facebook que administra las cuentas)

```bash
claude mcp add --transport http meta_ads https://mcp.facebook.com/ads
claude            # dentro: /mcp → meta_ads → autorizar con Facebook
```

La autorización queda guardada en el perfil de Claude Code de esa máquina (no en el repo, no en
`.env`). Con eso el agente ve las cuentas publicitarias de ese Facebook. Apify es opcional (el radar
se captura gratis con `npm run radar:capturar`).

## 4. Usar el agente

Dentro de la carpeta del proyecto, `claude` y luego:

| Comando | Qué hace |
|---|---|
| `/oraculo-sincronizar` | Trae campañas, conjuntos, anuncios, desgloses, creativos, ranking de Meta, bitácora y públicos a `datos/lote.json` (receta exacta con límites del conector). |
| `/oraculo-semana` | Informe semanal de dirección desde `npm run verificar -- --json`. |
| `/oraculo-pregunta <pregunta>` | Responde con dato, regla y alternativa; discrepa con evidencia. |

El panel: `npm run dev` → http://localhost:3000/panel (usuario y clave del `.env`).

## 5. Reglas que el agente siempre respeta (están en `CLAUDE.md` y la constitución)

- Los números los calcula el motor; el agente interpreta. Nunca inventa cifras ni benchmarks.
- Dato ausente = «—», nunca cero. Cero jerga técnica en texto visible.
- Jamás un dato de paciente en el lote (guardián `validarSinPII`).
- Cada hallazgo dice de dónde sale, con qué método y con enlace al dato.
- Lo del mercado (radar, referencias) va aparte de lo propio y siempre con enlace para verificar.

## 6. Si es la VPS

Ya está instalado (`docs/DESPLIEGUE_VPS.md`). Solo faltan los tres inicios de sesión de la clínica
como usuario `oraculo`: `claude`, `/mcp` (Facebook) y `cloudflared tunnel login`. Después el reloj de
las 6:30 hace la sincronización solo.

## 7. Actualizar el agente

`git pull` en la carpeta del proyecto. Los skills, `CLAUDE.md` y el motor se actualizan con el código;
no hay nada que reinstalar. En la VPS lo hace el reloj diario antes de sincronizar.
