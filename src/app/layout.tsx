import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { StoreProvider } from "@/lib/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Kimsy | AI risk assessment workspace",
  description: "Turn your existing risk methodology into a focused, AI-assisted assessment workspace.",
  icons: { icon: [{ url: "/kimsy-icon.svg", type: "image/svg+xml" }] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full">
        <TooltipProvider>
          <StoreProvider>
            <AppShell>{children}</AppShell>
          </StoreProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
