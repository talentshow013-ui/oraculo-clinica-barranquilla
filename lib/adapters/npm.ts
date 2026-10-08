/**
 * Llamar a `npm run …` desde otro script, igual en Mac/Linux (VPS) y en Windows (PC de la clínica).
 * En Windows `npm` es `npm.cmd` y solo arranca con shell: sin esto los comandos que encadenan a
 * otros (`npm run hoy`, `mensajes`, `radar:referencias`) fallaban en silencio y usaban datos viejos.
 */
import { spawn, spawnSync, type SpawnOptions, type SpawnSyncOptions } from "node:child_process";

export function comandoNpm(args: ReadonlyArray<string>, plataforma: NodeJS.Platform = process.platform): { comando: string; args: string[]; shell: boolean } {
  if (plataforma !== "win32") return { comando: "npm", args: [...args], shell: false };
  const citar = (a: string) => (/[\s"&|<>^()]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
  return { comando: "npm.cmd", args: args.map(citar), shell: true };
}

export function npmSync(args: ReadonlyArray<string>, opciones: SpawnSyncOptions = {}) {
  const c = comandoNpm(args);
  return spawnSync(c.comando, c.args, { env: process.env, ...opciones, shell: c.shell });
}

export function npmAsync(args: ReadonlyArray<string>, opciones: SpawnOptions = {}) {
  const c = comandoNpm(args);
  return spawn(c.comando, c.args, { env: process.env, ...opciones, shell: c.shell });
}
