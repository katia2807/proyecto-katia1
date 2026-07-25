import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createE2eDataDir, removeE2eDataDir } from "../e2e/helpers/e2e-data-dir";

describe("directorio de datos E2E", () => {
  it("aísla dos ejecuciones y no reutiliza el store de una ejecución terminada", () => {
    const firstRun = createE2eDataDir();
    const secondRun = createE2eDataDir();
    let restartedRun: string | null = null;

    try {
      expect(secondRun).not.toBe(firstRun);
      writeFileSync(join(firstRun, "store.json"), '{"run":"first"}', "utf8");
      expect(existsSync(join(secondRun, "store.json"))).toBe(false);

      removeE2eDataDir(firstRun);
      restartedRun = createE2eDataDir();
      expect(restartedRun).not.toBe(firstRun);
      expect(existsSync(join(restartedRun, "store.json"))).toBe(false);
    } finally {
      if (existsSync(firstRun)) removeE2eDataDir(firstRun);
      removeE2eDataDir(secondRun);
      if (restartedRun) removeE2eDataDir(restartedRun);
    }
  });

  it("rechaza limpiar rutas que no pertenecen al aislamiento E2E", () => {
    expect(() => removeE2eDataDir(process.cwd())).toThrow(
      "Se rechazó limpiar un directorio ajeno a E2E",
    );
  });
});
