import Script from "next/script";
import "./globals.css";
import { APP_METADATA, DEFAULT_LOCALE, THEME_STORAGE_KEY } from "@/config/corsystem";

export const metadata = APP_METADATA;

export const viewport = {
  width: "device-width",
  initialScale: 1
};

const themeScript = `
(() => {
  try {
    const theme = localStorage.getItem("${THEME_STORAGE_KEY}") === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <body>
        <Script id="corsystem-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
