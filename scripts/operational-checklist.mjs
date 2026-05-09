const requiredProductionVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ERP_ORG_ID",
  "ANTIFRAUD_ACCESS_CODE",
];

const requiredStagingVars = [
  "E2E_MODE",
  "E2E_BASE_URL",
  "E2E_STAGING_EMAIL",
  "E2E_STAGING_PASSWORD",
];

function checkVars(vars) {
  return vars.map((name) => ({
    name,
    ok: Boolean(process.env[name]),
  }));
}

function printSection(title, checks) {
  console.log(`\n${title}`);
  for (const check of checks) {
    console.log(`${check.ok ? "[OK]" : "[MISSING]"} ${check.name}`);
  }
}

const productionChecks = checkVars(requiredProductionVars);
const stagingChecks = checkVars(requiredStagingVars);

printSection("Variables de producción", productionChecks);
printSection("Variables para E2E de staging", stagingChecks);

console.log("\nChecklist operativo (backups y continuidad)");
console.log("- [ ] Backup diario automático de Supabase habilitado.");
console.log("- [ ] Última restauración de prueba validada (fecha registrada internamente).");
console.log("- [ ] Rotación de claves y revisión de usuarios con acceso administrativo.");
console.log("- [ ] Ejecución semanal de smoke E2E staging: npm run e2e -- --grep staging");
console.log("- [ ] Usuarios owner_admin revisados en Supabase Auth + tabla perfiles.");

const hasMissing =
  productionChecks.some((entry) => !entry.ok) ||
  (process.env.E2E_MODE === "staging" && stagingChecks.some((entry) => !entry.ok));

if (hasMissing) {
  process.exitCode = 1;
}
