export const APP_DISPLAY_NAME = "CorSystem Repair Manager";
export const APP_SHORT_NAME = "CorSystem Repair";
export const APP_DESCRIPTION =
  "Gestionale CorSystem per clienti, dispositivi, accettazioni, riparazioni, tecnici, preventivi, ricambi, pagamenti e notifiche.";

export const COMPANY_PROFILE = Object.freeze({
  brandName: "CorSystem",
  displayName: "CORSYSTEM HUB TECNOLOGICO",
  tagline: "connecting world",
  address: "Corso Manfredonia n. 4, Zapponeta",
  vatNumber: "04194770717",
  email: "info@corsystemit",
  emailHref: "",
  phone: "3283645185",
  whatsapp: "3283645185",
  logoPath: "/brand/corsystem-logo.svg"
});

export const STORAGE_KEY = "corsystem-repair-manager-v1";
export const THEME_STORAGE_KEY = "corsystem-repair-theme";

export const APP_METADATA = {
  title: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION
};

export const DEFAULT_LOCALE = "it-IT";
export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_TIMEZONE = "Europe/Rome";

export function companyPhoneHref() {
  return `tel:${COMPANY_PROFILE.phone}`;
}

export function companyContactLine() {
  return `${COMPANY_PROFILE.address} · P.IVA ${COMPANY_PROFILE.vatNumber} · Tel/WhatsApp ${COMPANY_PROFILE.phone}`;
}
