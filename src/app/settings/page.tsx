"use client";

import { Database, Info, LockKeyhole, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import { Badge, Button, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { useKimsy } from "@/lib/store";
import type { OperatingModel } from "@/lib/types";

export default function SettingsPage() {
  const { state, setOperatingModel, resetDemo } = useKimsy();
  const model = state.organization.operatingModel;
  const options: Array<{ value: OperatingModel; title: string; description: string; icon: typeof UserRound }> = [
    { value: "FIRST_LINE_LED", title: "First-line-led", description: "Business contributors provide facts. Compliance reviews AI proposals by exception and provides final approval.", icon: UserRound },
    { value: "COMPLIANCE_LED", title: "Compliance-led", description: "Compliance gathers facts, performs checks, and may finalize its own assessment. Business input remains optional.", icon: ShieldCheck },
  ];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Organization settings" description="Configure how new assessments are owned, reviewed, and governed across the organization." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          <PanelHeader title="Assessment operating model" description="Applied organization-wide to new cycles. Existing assessments retain their original model." />
          <div className="space-y-3 px-5 py-5">{options.map((option) => <button key={option.value} onClick={() => setOperatingModel(option.value)} className={`flex w-full items-start gap-4 rounded-[6px] border p-4 text-left transition-colors ${model === option.value ? "border-[#0f766e] bg-[#edf7f5]" : "border-[#d9e0dd] bg-white hover:border-[#9fb9b3]"}`}><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] ${model === option.value ? "bg-[#0f766e] text-white" : "bg-[#edf2f0] text-[#52605b]"}`}><option.icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{option.title}</p>{model === option.value && <Badge tone="success">Active</Badge>}</div><p className="mt-1 text-xs leading-5 text-[#697671]">{option.description}</p></div><div className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${model === option.value ? "border-[#0f766e]" : "border-[#aeb9b4]"}`}>{model === option.value && <span className="h-2 w-2 rounded-full bg-[#0f766e]" />}</div></button>)}</div>
          <div className="flex gap-2 border-t border-[#e2e7e5] bg-[#f8faf9] px-5 py-4 text-xs leading-5 text-[#60706a]"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0f766e]" /><p>Changing this setting never alters in-progress or finalized assessment workflows. The active model is snapshotted when a cycle is created.</p></div>
        </Panel>
        <div className="space-y-5">
          <Panel><PanelHeader title="Workspace" /><dl className="divide-y divide-[#e7ebe9] text-xs"><div className="flex justify-between px-5 py-3.5"><dt className="text-[#71807a]">Organization</dt><dd className="font-semibold">{state.organization.name}</dd></div><div className="flex justify-between px-5 py-3.5"><dt className="text-[#71807a]">Data region</dt><dd className="font-semibold">{state.organization.dataRegion}</dd></div><div className="flex justify-between px-5 py-3.5"><dt className="text-[#71807a]">Review cadence</dt><dd className="font-semibold">{state.organization.reviewCadence}</dd></div></dl></Panel>
          <Panel><PanelHeader title="Security boundary" /><div className="space-y-3 px-5 py-4 text-xs text-[#5e6c66]"><div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[#187653]" />Invite-only access</div><div className="flex items-center gap-2"><Database className="h-4 w-4 text-[#187653]" />Private evidence storage</div><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#187653]" />Append-only audit history</div></div></Panel>
          <Panel><PanelHeader title="Demo environment" /><div className="px-5 py-4"><p className="text-xs leading-5 text-[#6a7772]">Reset all locally stored interactions to the seeded product state.</p><Button variant="secondary" className="mt-3 w-full" onClick={resetDemo}><RotateCcw className="h-4 w-4" />Reset demo data</Button></div></Panel>
        </div>
      </div>
    </div>
  );
}
