import type { Metadata } from "next";
import AuthGate from "@/components/AuthGate";
import Toast from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "ModenX Pipeline",
  description: "ModenX CRM",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <AuthGate>{children}</AuthGate>
        <Toast />
      </body>
    </html>
  );
}
