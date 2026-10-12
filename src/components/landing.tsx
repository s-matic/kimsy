"use client";

import { ArrowRight, Calculator, CalendarCheck, CheckCircle2, FileText, MessageSquareText, ShieldCheck, Sparkles, Table2, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui";
import { useKimsy } from "@/lib/store";

const steps: Array<{ title: string; description: string }> = [
  { title: "Describe how you assess risk", description: "Tell Kimsy about your organization, or upload the spreadsheet, policy, or methodology you already use." },
  { title: "Confirm your workspace", description: "Kimsy proposes units, risk scenarios, assessment fields, and scoring. You edit and confirm each part." },
  { title: "Assess by conversation", description: "Explain what changed. Kimsy suggests register updates, and nothing is applied until you approve it." },
];

const features: Array<{ icon: LucideIcon; title: string; description: string }> = [
  { icon: Sparkles, title: "AI-guided setup", description: "A setup conversation turns your existing methodology into a working configuration instead of imposing a generic GRC model." },
  { icon: FileText, title: "Bring your documents", description: "Import PDF, Word, Excel, CSV, and image sources as the starting point for setup and assessments." },
  { icon: Table2, title: "Structured risk register", description: "A spreadsheet-style register per organizational unit, with inline editing and your own typed fields." },
  { icon: Calculator, title: "Transparent scoring", description: "Chained matrix and weighted-threshold calculations you can inspect and adjust, never a black box." },
  { icon: ShieldCheck, title: "You stay in control", description: "Every AI proposal is shown as a change you explicitly apply or discard." },
  { icon: UserCheck, title: "Optional reviewer mode", description: "Work alone, or add a reviewer who approves or returns whole assessments." },
  { icon: CalendarCheck, title: "Compliance plans", description: "Turn assessed risks into a planned set of compliance activities for the period ahead." },
];

const previewRows: Array<{ scenario: string; level: string; tone: string }> = [
  { scenario: "Outsourced payment operations", level: "High", tone: "bg-[#fdecea] text-[#b42318]" },
  { scenario: "Customer due diligence", level: "Medium", tone: "bg-[#fff4de] text-[#9a6200]" },
  { scenario: "Sanctions screening", level: "Low", tone: "bg-[#e8f6ef] text-[#176b4b]" },
];

export function Landing({ onStart }: { onStart: () => void }) {
  const { loadSample } = useKimsy();

  return <div className="flex min-h-screen flex-col bg-[#f5f5f7] text-[#23242d]">
    <header className="shrink-0"><div className="mx-auto flex h-[72px] max-w-[1180px] items-center px-4 sm:px-6"><BrandMark className="h-7 w-7" /><p className="font-display ml-2 text-[26px] leading-none text-[#20212a]">Kimsy</p><Button size="sm" className="ml-auto" onClick={onStart}>Get started</Button></div></header>

    <main className="flex-1">
      <section className="enter-soft mx-auto grid max-w-[1180px] items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-24 lg:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#e3e4e8] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#4e5160] shadow-sm"><Sparkles className="h-3.5 w-3.5 text-[#586ad0]" />AI risk assessment workspace</p>
          <h1 className="font-display mt-6 text-[40px] leading-[1.08] text-[#24252e] sm:text-[56px]">Replace your risk spreadsheet with a conversation</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#6c6f7d]">Kimsy turns the risk methodology you already have into a focused, AI-assisted assessment workspace and a structured, editable risk register.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button className="h-11 px-5" onClick={onStart}>Get started<ArrowRight className="h-4 w-4" /></Button>
            <Button variant="secondary" className="h-11 px-5" onClick={loadSample}>Explore sample workspace</Button>
          </div>
          <p className="mt-4 text-xs text-[#858895]">No account needed. Setup stays private to this browser.</p>
        </div>

        <div aria-hidden="true" className="rounded-[22px] border border-[#e3e4e8] bg-white p-4 shadow-[var(--shadow-float)] sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#25262f] text-white"><MessageSquareText className="h-4 w-4" /></div>
            <div className="rounded-[14px] bg-[#f4f5fc] px-4 py-3 text-sm leading-6 text-[#434a80]">We moved payment processing to a new vendor this quarter.</div>
          </div>
          <div className="mt-4 rounded-[14px] border border-[#ededf0]">
            <div className="flex items-center justify-between border-b border-[#ededf0] bg-[#fafafd] px-4 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#727687]">Proposed register update</p><CheckCircle2 className="h-4 w-4 text-[#586ad0]" /></div>
            <div className="divide-y divide-[#ededf0]">{previewRows.map((row) => <div key={row.scenario} className="flex items-center gap-3 px-4 py-3"><p className="min-w-0 flex-1 truncate text-sm font-medium text-[#30313b]">{row.scenario}</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.tone}`}>{row.level}</span></div>)}</div>
          </div>
          <div className="mt-4 flex justify-end gap-2"><span className="rounded-[10px] border border-[#dedfe5] px-3.5 py-2 text-xs font-semibold text-[#2d2f3a]">Discard</span><span className="rounded-[10px] bg-[#25262f] px-3.5 py-2 text-xs font-semibold text-white">Apply changes</span></div>
        </div>
      </section>

      <section className="border-y border-[#e8e8ec] bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#626ec0]">How it works</p>
          <h2 className="font-display mt-2 text-[30px] leading-tight text-[#24252e] sm:text-[36px]">From methodology to register in three steps</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">{steps.map((step, index) => <li key={step.title}><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eff1fb] text-sm font-semibold text-[#4759b5]">{index + 1}</div><h3 className="mt-4 text-base font-semibold text-[#2c2e38]">{step.title}</h3><p className="mt-2 text-sm leading-6 text-[#747786]">{step.description}</p></li>)}</ol>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#626ec0]">What you get</p>
        <h2 className="font-display mt-2 text-[30px] leading-tight text-[#24252e] sm:text-[36px]">Built for one compliance professional</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map((feature) => <div key={feature.title} className="rounded-[18px] border border-[#e5e5e9] bg-white p-5 shadow-[var(--shadow-panel)]"><div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#f0f1f5] text-[#555968]"><feature.icon className="h-4 w-4" /></div><h3 className="mt-4 text-sm font-semibold text-[#2c2e38]">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-[#747786]">{feature.description}</p></div>)}</div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 pb-16 sm:px-6 lg:pb-24">
        <div className="rounded-[22px] bg-[#25262f] px-6 py-12 text-center sm:px-10 sm:py-14">
          <h2 className="font-display text-[30px] leading-tight text-white sm:text-[36px]">Ready to retire the spreadsheet?</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#b9bbc7]">Set up your workspace in a single conversation. You can change everything later.</p>
          <Button variant="secondary" className="mt-7 h-11 px-5" onClick={onStart}>Start your workspace<ArrowRight className="h-4 w-4" /></Button>
        </div>
      </section>
    </main>

    <footer className="shrink-0 border-t border-[#e8e8ec]"><div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:px-6"><div className="flex items-center"><BrandMark className="h-5 w-5" /><p className="font-display ml-2 text-lg leading-none text-[#20212a]">Kimsy</p></div><p className="text-[11px] text-[#9295a1] sm:ml-auto">Kimsy can make mistakes. Review all suggested assessment changes.</p></div></footer>
  </div>;
}
