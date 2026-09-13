# Contrato de datos

**Definición normativa:** `lib/adapters/types.ts` (esquemas Zod). Este documento es la lectura humana.
Si difieren, manda el código.

## Por qué el contrato manda

La ruta fácil es maquetar pantallas y luego pelear para que los datos entren; termina siempre
reescribiendo la mitad de los componentes el día que se conecta la fuente real. Aquí va al revés:
tipos calcados de lo que entregan las fuentes, la interfaz encima, alimentada por datos de
demostración que respetan exactamente el mismo contrato. Conectar la fuente real no toca ni un
componente: se escribe `datos/lote.json` y se cambia `ORACULO_FUENTE=archivo`.

## Reglas transversales

| Regla | Consecuencia |
|---|---|
| `null` ≠ `0` | Dato no entregado = `null`; la interfaz muestra `—`. "No hubo" y "no sabemos" son afirmaciones distintas. |
| Fechas `YYYY-MM-DD` en hora Bogotá | Nunca `toISOString()` crudo. Ver `lib/format/fechas.ts`. |
| Solo se suman crudos | Toda razón se recalcula desde sumas. No existe función que promedie razones (test: 91/1000 = 9,1 %). |
| Esquemas estrictos donde hay personas | `RegistroEmbudo` y `BreakdownRow` rechazan cualquier campo extra. |
| Sin datos de paciente | `validarSinPII` detiene la carga si aparece nombre, cédula, teléfono, correo, dirección, historia… (Ley 1581 de 2012). |
| `nRegistros` obligatorio en desgloses | Cruces con menos de 5 personas se ocultan (k-anonimato). |

## Tipos

### `InsightRow` — una entidad × un día
Identidad: `fuente` (meta·tiktok·radar·clinica), `fecha`, `nivel` (cuenta·campana·conjunto·anuncio), `id`, `nombre`, `padreId`, `cuentaId`, `objetivo`, `estado`.
Entrega: `gasto`\*, `impresiones`\*, `alcance`, `frecuencia`, `subastasGanadas`, `pujaPromedio`.
Interacción: `clics`\*, `clicsEnlace`\*, `clicsUnicos`, `interacciones`, `reacciones`, `comentarios`, `compartidos`, `guardados`, `visitasPerfil`, `seguidoresNuevos`, `vistasLandingPage`.
Video: `reproducciones`, `reproducciones2s`, `reproducciones3s`, `reproducciones6s`, `reproduccionesThru`, `p25`…`p100`, `tiempoReproduccionTotal`, `duracionCreativoSeg`.
Mensajería: `conversacionesIniciadas`, `conversacionesRespondidas`.
Resultado: `resultados`\*, `tipoResultado`, `valorConversion`, `ventanaAtribucion`\* (se muestra siempre en la interfaz).
\* obligatorio y no negativo. **Todo lo demás es nullable.** Durante 2026 Meta retiró alcance orgánico de Página: si mañana desaparece otro campo, el panel muestra `—` y sigue.

Compatibilidad: Meta reporta gancho a 3 s y ThruPlay; TikTok a 2 s y 6 s. `hookRate` usa 3 s y cae a 2 s; `holdRate` usa ThruPlay y cae a 6 s.

### `BreakdownRow`
`InsightRow` + `dimension` (edad·genero·edad_genero·ubicacion·pais·plataforma·ubicacion_anuncio·dispositivo·hora·dia_semana) + `valor` + `nRegistros`. **No suman al total** (deduplicación de alcance): la interfaz lo advierte.

### `RegistroEmbudo` — agregado, sin PII posible
`fecha`, `campanaId`, `fuenteAtribuida`, `paso`, `cantidad`, `valorCOP`, `servicio`, `sede`, `nRegistros`.
Pasos: `impresion → clic → conversacion → lead_calificado → cita_agendada → cita_asistida → venta → recompra`.

### `Creativo`
`id`, `anuncioId`, `formato`, `urlMiniatura`, `copyPrincipal`, `titular`, `descripcion`, `cta`, `urlDestino`, `fechaPrimerGasto`, `diasActivo`, `servicio`, `anguloDetectado` (14), `nivelConsciencia` (1-5), `confianzaClasificacion`, `senalesDeteccion[]`.

### `AnuncioCompetidor`
`competidorId`, `nombreAnunciante`, `anuncioId`, `primeraVez`, `ultimaVez`, `diasCorriendo`, `activo`, `plataformas[]`, `copy`, `titular`, `cta`, `urlMedia`, `tipoMedia`, `urlDestino`, `dominioDestino`, `alcanceRango` (**null si la fuente no lo expone; jamás estimado**), `variantesDelConcepto`, `servicioDetectado`, `anguloDetectado`, `nivelConsciencia`, `usaPrecio`, `usaUrgencia`, `usaProfesional`, `usaTestimonio`, `usaGarantia`, `puntuacionLongevidad` (la recalcula el motor).

### `Competidor`, `Experimento`, `LoteDatos`, `FuenteDatos`
Ver `lib/adapters/types.ts` y `specs/001-panel-oraculo/data-model.md`.

## Archivos

- `datos/seed.json` — demostración; `npm run seed` lo genera (180 días deterministas).
- `datos/lote.json` — datos reales; lo escribe la sincronización (`/oraculo-sincronizar`).
- `datos/experimentos.json` — memoria de lo probado; se fusiona en cada lote.
- `npm run validar-lote [ruta]` valida cualquier archivo contra el contrato y el guardián.

## Cuando se conecte la fuente real

1. El skill de sincronización escribe `datos/lote.json` mapeando cada respuesta al contrato.
2. `npm run validar-lote` en verde.
3. `ORACULO_FUENTE=archivo` en `.env`.
4. **No se toca ni un componente.** Ese fue el punto de todo el diseño.
