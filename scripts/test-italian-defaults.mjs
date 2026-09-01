import { readFileSync } from "node:fs";

const page = readFileSync("src/app/page.jsx", "utf8");
const seed = readFileSync("src/lib/seed-data.js", "utf8");
const locale = readFileSync("src/features/localization/legacy-it.js", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(locale.includes(`LEGACY_DEFAULT_LANGUAGE = "it"`), "Manca lingua predefinita italiana");
assert(locale.includes(`appTitle: "CorSystem Repair Manager"`), "Manca branding italiano");
assert(locale.includes(`"预定": "Accettato"`), "Manca mapping stato italiano");

assert(page.includes(`{ value: "it", label: "Italiano" }`), "Italiano non presente nel selettore lingue");
assert(page.includes(`uiText.it = { ...uiText.es, ...legacyItalianText };`), "Dizionario italiano non registrato");
assert(page.includes(`return settings?.uiLanguage || settings?.printLanguage || "it";`), "Fallback UI non italiano");
assert(page.includes(`const [lang, setLang] = useState("it");`), "Login non parte in italiano");
assert(page.includes(`function StatusPill({ status, lang = "it" })`), "Stati non partono in italiano");
assert(page.includes(`legacyStatusLabelsIt[normalized]`), "Mapping stati italiano non usato");
assert(!page.includes(`uiLanguage: "zh"`), "Resta un default UI cinese nel client");
assert(!page.includes(`printLanguage: "zh"`), "Resta un default stampa cinese nel client");

assert(seed.includes(`uiLanguage: "it"`), "Seed UI non italiano");
assert(seed.includes(`printLanguage: "it"`), "Seed stampa non italiano");
assert(!seed.includes(`uiLanguage: "zh"`), "Seed contiene ancora default UI cinese");
assert(!seed.includes(`printLanguage: "zh"`), "Seed contiene ancora default stampa cinese");
assert(seed.includes(`Ciao {name}`), "Template WhatsApp seed non italiano");

console.log("✓ Default italiano, login, fallback, stati e seed verificati.");
