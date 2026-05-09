export const privacyPolicy = {
  dataClassification: [
    "Datos personales de empleados/clientes: sensibles, solo roles autorizados.",
    "Información financiera: sensible, sin acceso público.",
  ],
  controls: [
    "RLS habilitado en todas las tablas críticas.",
    "MFA recomendado para owner_admin y gerencia.",
    "Sin borrado físico: solo anulación lógica con motivo.",
    "Auditoría append-only en audit_log.",
  ],
  backupPolicy: {
    frequency: "diaria",
    retention: "mensual",
    restoreDrill: "trimestral",
  },
};
