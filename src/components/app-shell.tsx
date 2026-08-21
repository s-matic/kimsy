"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Building2,
  ChevronDown,
  LibraryBig,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import { useKimsy } from "@/lib/store";

const nav = [
  { href: "/", label: "Assistant", icon: MessageSquareText },
  { href: "/register", label: "Risk register", icon: Table2 },
  { href: "/setup", label: "Methodology", icon: LibraryBig },
];

function SidebarContent({ close, compact = false, toggleCompact }: { close?: () => void; compact?: boolean; toggleCompact?: () => void }) {
  const pathname = usePathname();
  const { state } = useKimsy();
  const personName = state.persona === "REVIEWER" ? state.configuration.review.reviewerName : state.configuration.review.assessorName;
  const unitName = (unitId: string) => state.configuration.units.find((unit) => unit.id === unitId)?.name ?? "Unknown unit";

  return (
    <div className="flex h-full flex-col bg-[#fbfbfc] text-[#292a34]">
      <div className={`flex h-[74px] shrink-0 items-center ${compact ? "justify-center px-2" : "px-5"}`}>
        <Link href="/" onClick={close} className="flex min-w-0 items-center gap-2.5" aria-label="Kimsy home">
          <Sparkles className="h-6 w-6 shrink-0 stroke-[1.5] text-[#25262f]" />
          {!compact && <span className="font-display truncate text-[27px] leading-none text-[#20212a]">Kimsy</span>}
        </Link>
        {close ? (
          <button onClick={close} className="ml-auto rounded-lg p-1.5 text-[#777a88] hover:bg-[#eeeef2]" aria-label="Close navigation"><X className="h-4 w-4" /></button>
        ) : toggleCompact ? (
          <button onClick={toggleCompact} className={`${compact ? "absolute right-2 top-5" : "ml-auto"} rounded-lg p-1.5 text-[#777a88] hover:bg-[#eeeef2]`} aria-label={compact ? "Expand navigation" : "Collapse navigation"}>{compact ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</button>
        ) : null}
      </div>

      <div className={`px-3 ${compact ? "pb-2" : "pb-4"}`}>
        <div className={`flex items-center rounded-[12px] border border-[#e4e5e9] bg-white ${compact ? "justify-center p-2" : "gap-3 px-3 py-2.5"}`} title={compact ? state.configuration.organizationName : undefined}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#f0f1f5] text-[#555968]"><Building2 className="h-4 w-4" /></div>
          {!compact && <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#343640]">{state.configuration.organizationName}</p><p className="mt-0.5 truncate text-[10px] text-[#858895]">{state.configuration.units.length} organizational units</p></div>}
        </div>
      </div>

      <nav className="px-3" aria-label="Primary navigation">
        <div className="space-y-1">
          {nav.map((item) => {
            const active = item.href === "/"
              ? pathname === "/" || pathname.startsWith("/assessments")
              : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} onClick={close} title={compact ? item.label : undefined} className={`flex h-11 items-center rounded-[11px] text-sm font-medium transition-colors ${compact ? "justify-center px-2" : "gap-3 px-3"} ${active ? "bg-[#ececf1] text-[#262832]" : "text-[#565967] hover:bg-[#f1f1f4] hover:text-[#292b35]"}`}>
                <item.icon className={`h-[17px] w-[17px] shrink-0 ${active ? "text-[#5369d2]" : "text-[#777b89]"}`} />
                {!compact && item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {!compact && <div className="mt-7 min-h-0 flex-1 overflow-y-auto px-5">
        <div className="flex items-center justify-between"><p className="text-[11px] font-semibold text-[#7a7d8b]">Recent assessments</p><ChevronDown className="h-3.5 w-3.5 text-[#989aa5]" /></div>
        <div className="mt-3 space-y-1">
          {state.assessments.length === 0 ? <p className="py-2 text-xs text-[#9699a6]">No assessments yet</p> : state.assessments.slice(0, 4).map((assessment) => <Link key={assessment.id} href={`/assessments/${assessment.id}`} onClick={close} className="block rounded-lg px-2 py-2 text-xs text-[#696c7b] hover:bg-[#f0f0f3] hover:text-[#30313b]"><span className="block truncate font-medium">{unitName(assessment.unitId)}</span><span className="mt-0.5 block truncate text-[10px] text-[#999ba7]">{assessment.period}</span></Link>)}
        </div>
      </div>}

      <div className={`mt-auto border-t border-[#ebebee] p-3 ${compact ? "flex justify-center" : ""}`}>
        <div className={`flex items-center rounded-[11px] ${compact ? "justify-center p-1" : "gap-3 px-2 py-2"}`} title={compact ? personName : undefined}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#30323d] text-xs font-semibold text-white">
            {personName.split(" ").map((part) => part[0]).join("").slice(0, 2) || "K"}
          </div>
          {!compact && <><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#333540]">{personName || "Workspace owner"}</p><p className="mt-0.5 truncate text-[10px] text-[#8b8e9b]">{state.persona === "REVIEWER" ? "Reviewer" : "Compliance owner"}</p></div><ChevronDown className="h-3.5 w-3.5 text-[#989aa5]" /></>}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const { state, hydrated, setPersona } = useKimsy();

  if (!hydrated) return <div className="min-h-screen bg-[#f5f5f7]" />;
  if (!state.onboarded) return <>{children}</>;

  const canReview = state.configuration.review.mode === "REVIEWER";
  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <aside className={`fixed inset-y-3 left-3 z-30 hidden overflow-hidden rounded-[22px] border border-[#e5e5e9] bg-white shadow-[var(--shadow-float)] transition-[width] duration-300 lg:block ${compact ? "w-[68px]" : "w-[264px]"}`}><SidebarContent compact={compact} toggleCompact={() => setCompact((current) => !current)} /></aside>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-[#20212a]/30 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" /><aside className="absolute inset-y-3 left-3 w-[280px] overflow-hidden rounded-[22px] border border-[#e5e5e9] bg-white shadow-[var(--shadow-float)]"><SidebarContent close={() => setMobileOpen(false)} /></aside></div>}

      <div className={`min-w-0 transition-[padding] duration-300 ${compact ? "lg:pl-[92px]" : "lg:pl-[288px]"}`}>
        <header className="sticky top-0 z-20 flex h-16 items-center bg-[#f5f5f7]/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button className="mr-3 rounded-[10px] border border-[#e0e1e6] bg-white p-2 text-[#5c5f6d] shadow-sm hover:bg-[#f5f5f7] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          <p className="truncate text-xs font-medium text-[#777a88]">{state.configuration.organizationName} <span className="mx-2 text-[#c1c2c9]">/</span> Assessment workspace</p>
          {canReview && <label className="ml-auto flex items-center gap-2 text-xs text-[#737684]"><span className="hidden sm:inline">View as</span><select value={state.persona} onChange={(event) => setPersona(event.target.value as "ASSESSOR" | "REVIEWER")} className="h-9 rounded-[10px] border border-[#dfe0e5] bg-white px-3 text-xs font-semibold text-[#30323c] shadow-sm"><option value="ASSESSOR">Assessor</option><option value="REVIEWER">Reviewer</option></select></label>}
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 pb-10 pt-2 sm:px-6 lg:px-8 lg:pb-12">{children}</main>
      </div>
    </div>
  );
}
