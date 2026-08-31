export const INTAKE_ACCESSORIES = [
  "Nessuno",
  "Custodia",
  "SIM",
  "Caricatore",
  "Cavo",
  "Alimentatore",
  "Penna/Stylus",
  "Altro"
];

export const INTAKE_CONDITION_FLAGS = [
  "Display rotto",
  "Vetro posteriore rotto",
  "Scocca danneggiata",
  "Segni di urto",
  "Possibile ossidazione/liquidi",
  "Dispositivo non si accende",
  "Non testabile in accettazione"
];

export function createEmptyIntake() {
  return {
    clientId: "",
    deviceId: "",
    reportedIssue: "",
    initialCondition: [],
    accessories: [],
    notes: "",
    frontPhoto: "",
    backPhoto: "",
    signatureDataUrl: "",
    privacyAccepted: false
  };
}

export function validateIntake(intake) {
  const errors = {};
  if (!String(intake?.clientId || "").trim()) errors.clientId = "Seleziona un cliente";
  if (!String(intake?.deviceId || "").trim()) errors.deviceId = "Seleziona o registra un dispositivo";
  if (!String(intake?.reportedIssue || "").trim()) errors.reportedIssue = "Descrivi il problema segnalato";
  return { valid: Object.keys(errors).length === 0, errors };
}
