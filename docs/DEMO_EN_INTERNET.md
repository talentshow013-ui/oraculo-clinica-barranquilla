# Demo en internet (temporal, hasta la VPS)

Para que la clínica vea el panel con **sus datos reales** antes de tener la VPS, hay una copia
desplegada en Railway (cuenta de la agencia). No reemplaza la arquitectura final
(`docs/DESPLIEGUE_VPS.md`): no tiene Claude Code adentro ni reloj diario; los datos se actualizan
a mano desde este PC.

- URL: https://oraculo-vivante.up.railway.app (candado: usuario `vivante`; la clave está en la
  variable `ORACULO_CLAVE` del servicio, no en el repositorio).
- Proyecto Railway `oraculo-vivante-demo`, servicio `panel`, volumen `/data` (ahí se guardan los
  resultados que anote la clínica: `ORACULO_RUTA_RESULTADOS=/data/resultados-clinica.json`).
- Variables: `ORACULO_FUENTE=archivo`, `ORACULO_USUARIO`, `ORACULO_CLAVE`, `ORACULO_CACHE_SEG=600`,
  `ORACULO_RUTA_RESULTADOS`. Next escucha en el puerto que Railway asigna (8080); el dominio apunta ahí.

## Actualizar los datos del demo

1. En este PC: `/oraculo-sincronizar` (o los crudos a mano en `datos/crudo/`) → `npm run importar-meta`
   → `npm run validar-lote`.
2. Carpeta limpia para subir (el lote está en `.gitignore`, por eso no se sube desde GitHub):
   ```
   D=/c/Users/redom/AppData/Local/Temp/oraculo-deploy
   rm -rf "$D" && mkdir -p "$D" && git archive HEAD | tar -x -C "$D"
   mkdir -p "$D/datos" && cp datos/lote.json "$D/datos/lote.json"
   printf 'node_modules/\n.next/\n.env\n' > "$D/.gitignore"
   ```
3. Desplegar esa carpeta al servicio `panel` (herramienta `deploy` del conector de Railway en Claude
   Code, o `railway up` desde la carpeta con la CLI enlazada al proyecto).
4. Comprobar: sin clave responde 401; con clave, 200 en `/panel`, `/campanas`, `/audiencias`.

## Apagar el demo

Cuando la VPS esté andando, borrar el proyecto en Railway (consume horas de uso). Antes, si la clínica
anotó resultados ahí, copiar `/data/resultados-clinica.json` a la VPS (`datos/resultados.json`).
