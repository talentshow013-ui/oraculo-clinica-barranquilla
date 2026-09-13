# PROMPT — Cuentas publicitarias: que el panel analice UNA cuenta a la vez

> Pégalo completo al agente del motor. Es una actividad nueva del frontend que ya está
> construida y probada con datos de demostración; falta el cableado en `lib/`.

## Qué hace el frontend hoy (ya construido en `app/`)

La clínica tiene **varias cuentas publicitarias** de Meta (hoy tres). En la barra superior hay un
**selector de cuenta** (`components/cliente/selector-cuenta.tsx`): al elegir una, TODO el panel
(las 13 pantallas) se recalcula para esa cuenta y la elección se recuerda al navegar.

Cómo viaja la elección, sin API propia (regla 3.2 del prompt maestro):

1. El selector escribe una cookie: `cuenta=<id>; path=/; max-age=31536000; samesite=lax`.
2. Llama a `router.refresh()`: los Server Components vuelven a ejecutar `await motor()`.
3. `motor()` lee la cookie con `cookies()` de `next/headers` y devuelve el resultado **de esa
   cuenta**. Si la cookie no existe o trae un id desconocido, usa la cuenta principal.
4. `app/(panel)/layout.tsx` lleva `export const dynamic = "force-dynamic"` (ya lo tenía el repo).

## Lo que hay que cablear en `lib/` (contrato)

### 1. Dos campos nuevos en `ResultadoMotor`

```ts
interface CuentaPublicitaria {
  id: string;                 // el id de la cuenta en Meta, p. ej. "act_1048227"
  nombre: string;             // lo que ve el dueño: "Vivante Riomar"
  plataforma: "meta" | "tiktok";
  moneda: "COP";
  activa: boolean;            // false = sin pauta en el periodo (se muestra, pero se avisa)
  ultimaSincronizacion: string | null;  // ISO con zona; null si nunca
}

interface ResultadoMotor {
  cuenta: CuentaPublicitaria;    // la analizada en esta petición
  cuentas: CuentaPublicitaria[]; // todas las disponibles, para el selector (orden: principal primero)
  // …todo lo demás igual
}
```

### 2. `motor()` acepta la cuenta

```ts
export async function motor(cuentaId?: string): Promise<ResultadoMotor>
```

- Si `cuentaId` no viene, se lee de la cookie `cuenta` (`(await cookies()).get("cuenta")?.value`)
  dentro de un `try/catch` (fuera de una petición —compilación, scripts— no hay cookies: se usa
  la principal).
- El lote se **filtra por cuenta antes de correr el motor**: `InsightRow.cuentaId === cuentaId`
  (el campo `cuentaId` ya existe en el contrato). Embudo, creativos y desgloses también por
  cuenta; el radar de mercado es compartido (la competencia no depende de la cuenta).
- Nada de promediar entre cuentas ni de sumar las tres «para tener más datos»: cada cuenta tiene
  su análisis. Si un día se quiere «todas juntas», es una cuenta virtual explícita, no un default.
- Cache por cuenta (el motor ya cachea por clave: añadir el `cuentaId` a la clave).

### 3. De dónde salen las cuentas

- `config/cliente.ts`: `cuentasPublicitarias: CuentaPublicitaria[]` (nombre público, id, plataforma).
  El seed de demostración lleva tres (`act_1048227` Vivante Riomar · `act_2213904` Vivante Norte ·
  `act_3390118` Vivante Médicos, esta última sin pauta) con escala distinta para que cambiar se
  note.
- `ultimaSincronizacion` sale del `EstadoFuente` de «Campañas y audiencias» para esa cuenta.

### 4. Lo que el frontend ya contempla (no hay que hacer nada)

- Cuenta sin pauta (`activa: false`): el selector la muestra con «sin pauta»; las pantallas
  pintan «—» y los avisos de cobertura, no ceros.
- El id se muestra pequeño al lado del nombre; en celular se oculta.
- La cookie es del navegador de quien mira: dos personas pueden analizar cuentas distintas a la vez.

## Cómo comprobar (yo lo corro sobre el mock; tú sobre el motor)

- `motor("act_2213904").cuenta.id === "act_2213904"` y `plataEnRiesgoTotal` distinto al de la principal.
- Con la cookie puesta, `/panel`, `/embudo` y `/creativos` muestran el nombre de esa cuenta en la
  barra superior y sus cifras cambian.
- Sin cookie: la principal. Con cookie inválida: la principal, sin error.
- `npm run typecheck` · `npm test` · `npm run build` limpios.

## Además, en la misma barra (ya hecho, solo para que lo sepas)

La cabecera quedó en UNA fila: selector de cuenta · periodo (con la atribución y la fecha de
sincronización al pasar el mouse) · chip ámbar con los días sin datos · chip gris con los avisos ·
plata en riesgo. Los huecos y advertencias siguen SIEMPRE a la vista, pero plegados en su chip,
con el texto completo al pasar el mouse. Nada de esto toca `lib/`.
