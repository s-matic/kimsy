import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kimsy | AI risk assessment workspace",
  description: "Turn your existing risk methodology into a focused, AI-assisted assessment workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
