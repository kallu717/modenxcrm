import type { Metadata } from "next";
import Masthead from "@/components/Masthead";
import "./globals.css";

export const metadata: Metadata = {
  title: "ModenX Pipeline",
  description: "ModenX CRM",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <Masthead />
        <div className="max-w-[1320px] w-full mx-auto px-[18px] pb-[60px] flex-1">{children}</div>
      </body>
    </html>
  );
}
