"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useKimsy } from "@/lib/store";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/assessments", label: "Assessments", icon: ClipboardCheck },
  { href: "/review", label: "Review queue", icon: ShieldCheck },
  { href: "/framework", label: "Risk framework", icon: BookOpen },
  { href: "/reporting", label: "Management reporting", icon: FileBarChart },
];

function SidebarContent({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const { state } = useKimsy();
  const openExceptions = state.assessments.reduce(
    (count, assessment) => count + assessment.exceptions.filter((item) => item.status === "OPEN").length,
    0,
  );
  return (
    <div className="flex h-full flex-col bg-[#18231f] text-white">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[5px] bg-[#33a89c] text-sm font-black text-[#10201b]">K</div>
        <div>
          <p className="text-base font-semibold">Kimsy</p>
          <p className="text-[10px] uppercase text-[#a7b4af]">Risk intelligence</p>
        </div>
        {close && (
          <button onClick={close} className="ml-auto rounded p-1 text-[#bdc7c3] hover:bg-white/10" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="border-b border-white/10 px-3 py-3">
        <button className="flex w-full items-center gap-3 rounded-[5px] px-2 py-2 text-left hover:bg-white/5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[#30403a]">
            <Building2 className="h-4 w-4 text-[#9bcac3]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{state.organization.name}</p>
            <p className="truncate text-[10px] text-[#a6b1ad]">Single-tenant workspace</p>
          </div>
          <ChevronDown className="h-4 w-4 text-[#8d9a95]" />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4" aria-label="Primary navigation">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase text-[#7f8e88]">Workspace</p>
        <div className="space-y-1">
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={`flex h-10 items-center gap-3 rounded-[5px] px-3 text-sm transition-colors ${active ? "bg-[#294039] text-white" : "text-[#b9c3bf] hover:bg-white/5 hover:text-white"}`}
              >
                <item.icon className={`h-4 w-4 ${active ? "text-[#67c5b9]" : "text-[#8f9d97]"}`} />
                <span className="flex-1">{item.label}</span>
                {item.href === "/review" && openExceptions > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d45247] px-1 text-[10px] font-bold text-white">{openExceptions}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link
          href="/settings"
          onClick={close}
          className={`flex h-10 items-center gap-3 rounded-[5px] px-3 text-sm ${pathname.startsWith("/settings") ? "bg-[#294039] text-white" : "text-[#b9c3bf] hover:bg-white/5 hover:text-white"}`}
        >
          <Settings className="h-4 w-4 text-[#8f9d97]" />
          Settings
        </Link>
        <div className="mt-2 flex items-center gap-3 rounded-[5px] px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d6b56f] text-xs font-bold text-[#342b19]">JL</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">Jordan Lee</p>
            <p className="truncate text-[10px] text-[#9eaaa5]">Compliance officer</p>
          </div>
          <ChevronDown className="h-4 w-4 text-[#788680]" />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { state } = useKimsy();
  const pendingTasks = state.tasks.filter((task) => !task.complete).length;
  return (
    <div className="min-h-screen bg-[#f4f6f5] lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] lg:block">
        <SidebarContent />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />
          <aside className="relative h-full w-[280px] shadow-xl">
            <SidebarContent close={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-[#dce2df] bg-white px-4 sm:px-6 lg:px-8">
          <button className="mr-3 rounded-[5px] p-2 text-[#53615c] hover:bg-[#edf1ef] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden max-w-sm flex-1 items-center gap-2 rounded-[5px] border border-[#dbe1de] bg-[#f8f9f9] px-3 sm:flex">
            <Search className="h-4 w-4 text-[#74817c]" />
            <input className="h-9 w-full bg-transparent text-sm placeholder:text-[#8b9692] focus:outline-none" placeholder="Search risks, assessments, or evidence" aria-label="Search" />
            <kbd className="rounded border border-[#d5dcda] bg-white px-1.5 py-0.5 text-[10px] text-[#77837e]">⌘ K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-[4px] bg-[#e8f4f1] px-2 py-1 text-[10px] font-bold uppercase text-[#176b62] sm:inline-flex">
              {state.organization.operatingModel === "FIRST_LINE_LED" ? "First-line-led" : "Compliance-led"}
            </span>
            <button className="relative rounded-[5px] p-2 text-[#52605b] hover:bg-[#edf1ef]" aria-label={`${pendingTasks} pending notifications`}>
              <Bell className="h-5 w-5" />
              {pendingTasks > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-[#c74035]" />}
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
