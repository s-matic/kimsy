"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Building2,
  ChevronDown,
  ClipboardList,
  Menu,
  MessageSquareText,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { useKimsy } from "@/lib/store";

const nav = [
  { href: "/", label: "Assessments", icon: MessageSquareText },
  { href: "/register", label: "Risk register", icon: ClipboardList },
  { href: "/setup", label: "Setup", icon: Settings2 },
];

function SidebarContent({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const { state } = useKimsy();
  return (
    <div className="flex h-full flex-col bg-[#17221e] text-white">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-[#69d3c5] text-[#10201b]"><Sparkles className="h-4 w-4" /></div>
        <div>
          <p className="text-base font-semibold">Kimsy</p>
          <p className="text-[10px] text-[#9caaa5]">Your risk assessment workspace</p>
        </div>
        {close && <button onClick={close} className="ml-auto rounded p-1 text-[#bdc7c3] hover:bg-white/10" aria-label="Close navigation"><X className="h-5 w-5" /></button>}
      </div>
      <div className="border-b border-white/10 px-3 py-3">
        <div className="flex items-center gap-3 rounded-[6px] px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] bg-[#30403a]"><Building2 className="h-4 w-4 text-[#9bcac3]" /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{state.configuration.organizationName}</p>
            <p className="truncate text-[10px] text-[#a6b1ad]">{state.configuration.units.length} organizational units</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4" aria-label="Primary navigation">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7f8e88]">Workspace</p>
        <div className="space-y-1">
          {nav.map((item) => {
            const active = item.href === "/"
              ? pathname === "/" || pathname.startsWith("/assessments")
              : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} onClick={close} className={`flex h-10 items-center gap-3 rounded-[6px] px-3 text-sm transition-colors ${active ? "bg-[#294039] text-white" : "text-[#b9c3bf] hover:bg-white/5 hover:text-white"}`}>
                <item.icon className={`h-4 w-4 ${active ? "text-[#69d3c5]" : "text-[#8f9d97]"}`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-[6px] px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d6b56f] text-xs font-bold text-[#342b19]">
            {(state.persona === "REVIEWER" ? state.configuration.review.reviewerName : state.configuration.review.assessorName).split(" ").map((part) => part[0]).join("").slice(0, 2) || "K"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{state.persona === "REVIEWER" ? state.configuration.review.reviewerName : state.configuration.review.assessorName}</p>
            <p className="truncate text-[10px] text-[#9eaaa5]">{state.persona === "REVIEWER" ? "Reviewer mode" : "Assessment owner"}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-[#788680]" />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { state, hydrated, setPersona } = useKimsy();

  if (!hydrated) return <div className="min-h-screen bg-[#f4f6f5]" />;
  if (!state.onboarded) return <>{children}</>;

  const canReview = state.configuration.review.mode === "REVIEWER";
  return (
    <div className="min-h-screen bg-[#f4f6f5] lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] lg:block"><SidebarContent /></aside>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" /><aside className="relative h-full w-[280px] shadow-xl"><SidebarContent close={() => setMobileOpen(false)} /></aside></div>}
      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-[#dce2df] bg-white px-4 sm:px-6 lg:px-8">
          <button className="mr-3 rounded-[5px] p-2 text-[#53615c] hover:bg-[#edf1ef] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          <div>
            <p className="text-sm font-semibold text-[#24302c]">{state.configuration.organizationName}</p>
            <p className="text-[11px] text-[#77837e]">Assessment workspace</p>
          </div>
          {canReview && <label className="ml-auto flex items-center gap-2 text-xs text-[#65726d]"><span className="hidden sm:inline">View as</span><select value={state.persona} onChange={(event) => setPersona(event.target.value as "ASSESSOR" | "REVIEWER")} className="h-9 rounded-[5px] border border-[#d4dcd8] bg-white px-2.5 text-xs font-semibold text-[#26322e]"><option value="ASSESSOR">Assessor</option><option value="REVIEWER">Reviewer</option></select></label>}
        </header>
        <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
