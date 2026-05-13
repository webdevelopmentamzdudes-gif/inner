import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Management Platform",
  description: "Multi-ICP lead organization, tracking & KPI tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
