import { readFileSync, writeFileSync } from "node:fs";

const pagePath = "src/app/page.jsx";
const seedPath = "src/lib/seed-data.js";

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`Pattern non trovato: ${label}`);
  return source.replace(search, replacement);
}

function replaceRegexRequired(source, regex, replacement, label) {
  if (typeof replacement === "string" && source.includes(replacement)) return source;
  if (!regex.test(source)) throw new Error(`Pattern non trovato: ${label}`);
  regex.lastIndex = 0;
  return source.replace(regex, replacement);
}

let page = readFileSync(pagePath, "utf8");

page = replaceRequired(
  page,
  `} from "@/components/ui";`,
  `} from "@/components/ui";\nimport { legacyItalianText, legacyStatusLabelsIt } from "@/features/localization/legacy-it";`,
  "import localizzazione italiana"
);

page = replaceRegexRequired(
  page,
  /const languages = \[\n\s*\{ value: "zh", label: "中文" \},\n\s*\{ value: "es", label: "Español" \}\n\];/,
  `const languages = [\n  { value: "it", label: "Italiano" },\n  { value: "es", label: "Español" },\n  { value: "zh", label: "中文" }\n];`,
  "elenco lingue"
);

page = replaceRequired(
  page,
  `};\n\nfunction getLang(settings) {`,
  `};\n\n// CorSystem usa l'italiano come lingua primaria. Le chiavi non ancora\n// migrate mantengono temporaneamente la traduzione spagnola, mai il cinese.\nuiText.it = { ...uiText.es, ...legacyItalianText };\n\nfunction getLang(settings) {`,
  "registrazione dizionario italiano"
);

page = replaceRegexRequired(
  page,
  /function getLang\(settings\) \{\n\s*return settings\?\.uiLanguage \|\| settings\?\.printLanguage \|\| "zh";\n\}/,
  `function getLang(settings) {\n  return settings?.uiLanguage || settings?.printLanguage || "it";\n}`,
  "default getLang"
);

page = replaceRegexRequired(
  page,
  /function makeT\(lang\) \{\n\s*const dict = uiText\[lang\] \|\| uiText\.zh;\n\s*return \(key, vars = \{\}\) => \{\n\s*const value = dict\[key\] \|\| uiText\.zh\[key\] \|\| key;/,
  `function makeT(lang) {\n  const dict = uiText[lang] || uiText.it;\n  return (key, vars = {}) => {\n    const fallback = lang === "zh" ? uiText.zh : uiText.it;\n    const value = dict[key] || fallback[key] || uiText.es[key] || key;`,
  "fallback traduzioni"
);

page = page.replace(/function StatusPill\(\{ status, lang = "zh" \}\)/g, `function StatusPill({ status, lang = "it" })`);
page = page.replace(/const \[lang, setLang\] = useState\("zh"\);/g, `const [lang, setLang] = useState("it");`);
page = page.replace(/uiLanguage: "zh"/g, `uiLanguage: "it"`);
page = page.replace(/printLanguage: "zh"/g, `printLanguage: "it"`);
page = page.replace(/settings\.printLanguage \|\| "zh"/g, `settings.printLanguage || "it"`);

// Dove il legacy aveva solo un bivio spagnolo/cinese, l'italiano usa il ramo
// latino come fallback. Le principali etichette sono sovrascritte da legacyItalianText.
page = page.replace(/lang === "es"(?! \|\| lang === "it")/g, `(lang === "es" || lang === "it")`);

const statusFunction = /function statusLabel\(status, lang(?: = "[^"]+")?\) \{[\s\S]*?\n\}/;
if (statusFunction.test(page) && !page.includes(`legacyStatusLabelsIt[normalized]`)) {
  page = page.replace(statusFunction, `function statusLabel(status, lang = "it") {\n  const normalized = normalizeStatus(status);\n  if (lang === "it") return legacyStatusLabelsIt[normalized] || legacyStatusLabelsIt[status] || normalized;\n  if (lang === "es") return statusLabelsEs[normalized] || statusLabelsEs[status] || normalized;\n  return statusLabels[normalized] || statusLabels[status] || normalized;\n}`);
}

// Titoli e messaggi legacy usati prima che siano disponibili le impostazioni server.
page = page.replace(/const APP_DISPLAY_NAME = "[^"]+";/g, `const APP_DISPLAY_NAME = "CorSystem";`);
page = page.replace(
  /const DEFAULT_WHATSAPP_PROGRESS_TEMPLATE = `Hola \{name\},[\s\S]*?Gracias\.`;/,
  `const DEFAULT_WHATSAPP_PROGRESS_TEMPLATE = \`Ciao {name},\n\nCorSystem ti informa che puoi consultare lo stato della riparazione qui:\n{url}\n\nPratica: {ticket}\nDispositivo: {device}\n\nGrazie.\`;`
);

writeFileSync(pagePath, page);

let seed = readFileSync(seedPath, "utf8");
seed = seed.replace(/uiLanguage: "zh"/g, `uiLanguage: "it"`);
seed = seed.replace(/printLanguage: "zh"/g, `printLanguage: "it"`);
seed = seed.replace(
  /export const defaultWhatsappProgressTemplate = `Hola \{name\},[\s\S]*?Gracias\.`;/,
  `export const defaultWhatsappProgressTemplate = \`Ciao {name},\n\nCorSystem ti informa che puoi consultare lo stato della riparazione qui:\n{url}\n\nPratica: {ticket}\nDispositivo: {device}\n\nGrazie.\`;`
);
writeFileSync(seedPath, seed);

console.log("✓ Localizzazione italiana legacy applicata.");
