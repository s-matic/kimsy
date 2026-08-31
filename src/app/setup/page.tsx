"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw, Save, Settings2 } from "lucide-react";
import { StructuredEditor, type Stage } from "@/components/onboarding";
import { Badge, Button, PageHeader, Panel } from "@/components/ui";
import { validateConfiguration } from "@/lib/scoring";
import { useKimsy } from "@/lib/store";
import type { WorkspaceConfiguration } from "@/lib/types";

const tabs: Array<{ stage: Exclude<Stage, "REVIEW">; label: string }> = [
  { stage: "ORGANIZATION", label: "Organization" },
  { stage: "WORKFLOW", label: "Ownership" },
  { stage: "SCENARIOS", label: "Risk scenarios" },
  { stage: "DESIGN", label: "Assessment design" },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default function SetupPage() {
  const router = useRouter();
  const { state, updateConfiguration, resetWorkspace } = useKimsy();
  const [stage, setStage] = useState<Exclude<Stage, "REVIEW">>("ORGANIZATION");
  const [draft, setDraft] = useState<WorkspaceConfiguration>(() => clone(state.configuration));
  const [saved, setSaved] = useState(false);
  const errors = validateConfiguration(draft);

  const save = () => {
    updateConfiguration(draft);
    setSaved(true);
  };

  const reset = () => {
    if (!window.confirm("Reset this browser workspace and return to onboarding?")) return;
    resetWorkspace();
    router.replace("/");
  };

  return <div className="space-y-5">
    <PageHeader eyebrow="Workspace setup" title="Your methodology, made usable" description="Keep the structure close to the spreadsheets and documents your team already understands. Changes recalculate existing register rows." actions={<Button disabled={errors.length > 0} onClick={save}><Save className="h-4 w-4" />Save configuration</Button>} />
    {saved && <div className="flex items-center gap-2 rounded-[6px] border border-[#b9decf] bg-[#eff9f4] px-4 py-3 text-xs font-semibold text-[#176b4b]"><CheckCircle2 className="h-4 w-4" />Configuration saved and existing rows recalculated.</div>}
    <div className="grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)]">
      <Panel className="h-fit overflow-hidden"><div className="border-b border-[#e2e7e5] px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#77837e]">Configure</p></div><nav className="p-2">{tabs.map((tab) => <button key={tab.stage} onClick={() => setStage(tab.stage)} className={`flex w-full items-center gap-2 rounded-[5px] px-3 py-2.5 text-left text-xs font-semibold ${stage === tab.stage ? "bg-[#edf7f5] text-[#0f766e]" : "text-[#53615c] hover:bg-[#f4f7f6]"}`}><Settings2 className="h-3.5 w-3.5" />{tab.label}</button>)}</nav><div className="border-t border-[#e2e7e5] p-3"><button onClick={reset} className="inline-flex items-center gap-2 text-xs font-semibold text-[#9a3c33]"><RotateCcw className="h-3.5 w-3.5" />Reset workspace</button></div></Panel>
      <Panel className="overflow-hidden"><div className="flex items-start justify-between border-b border-[#e2e7e5] px-5 py-4"><div><h2 className="text-sm font-semibold">{tabs.find((tab) => tab.stage === stage)?.label}</h2><p className="mt-1 text-xs text-[#71807a]">Edit the confirmed structure directly.</p></div><Badge tone={errors.length ? "warning" : "success"}>{errors.length ? `${errors.length} checks` : "Valid"}</Badge></div><div className="p-5"><StructuredEditor stage={stage} configuration={draft} setConfiguration={(configuration) => { setDraft(configuration); setSaved(false); }} /></div></Panel>
    </div>
    {errors.length > 0 && <div className="rounded-[6px] border border-[#ead5a5] bg-[#fffaf0] px-4 py-3"><p className="text-xs font-semibold text-[#7a5a1c]">Configuration checks</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#786846]">{errors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}</ul></div>}
  </div>;
}
