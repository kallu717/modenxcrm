import type { Metadata } from "next";
import AuthGate from "@/components/AuthGate";
import Toast from "@/components/Toast";
import { THEME_BOOT_SCRIPT } from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "bdCRM for ModenX",
  description: "ModenX CRM",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script sets data-theme before React loads, so the server's
    // HTML and the browser's differ on purpose there.
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthGate>{children}</AuthGate>
        <Toast />
      </body>
    </html>
  );
}
