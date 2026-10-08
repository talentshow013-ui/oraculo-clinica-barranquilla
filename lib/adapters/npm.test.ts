import { describe, expect, test } from "vitest";
import { comandoNpm } from "./npm";

describe("llamar a npm desde un script, en Mac/Linux y en Windows", () => {
  test("Mac y Linux: npm sin shell, argumentos tal cual", () => {
    expect(comandoNpm(["run", "-s", "radar:capturar", "--", "--q", "clínica estética medellín"], "darwin")).toEqual({ comando: "npm", args: ["run", "-s", "radar:capturar", "--", "--q", "clínica estética medellín"], shell: false });
  });
  test("Windows: npm.cmd con shell y los argumentos con espacios entre comillas", () => {
    expect(comandoNpm(["run", "-s", "radar:capturar", "--", "--q", "clínica estética medellín", "--ciudad", 'Dice "hola"'], "win32")).toEqual({
      comando: "npm.cmd",
      args: ["run", "-s", "radar:capturar", "--", "--q", '"clínica estética medellín"', "--ciudad", '"Dice \\"hola\\""'],
      shell: true,
    });
  });
});
