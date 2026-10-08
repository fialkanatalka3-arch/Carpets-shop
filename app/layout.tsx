import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Kotys Carpet — килими для твого дому",
  description: "Каталог килимів Kotys Carpet. Обери розмір, додай килим у кошик і залиш заявку на замовлення.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uk"><body>{children}</body></html>;
}
