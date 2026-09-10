"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  Globe2,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StructuredEditor, type Stage } from "@/components/onboarding";
import { Badge, Button, PageHeader, Panel } from "@/components/ui";
import { validateConfiguration } from "@/lib/scoring";
import { useKimsy } from "@/lib/store";
import { normalizeAllowedWebSource } from "@/lib/web-source-policy";
import type { WorkspaceConfiguration } from "@/lib/types";

type SettingsSection = Exclude<Stage, "REVIEW"> | "AGENT";

const tabs: Array<{ stage: SettingsSection; label: string; description: string; icon: LucideIcon }> = [
  { stage: "ORGANIZATION", label: "Organization", description: "Edit the confirmed organizational structure.", icon: Settings2 },
  { stage: "WORKFLOW", label: "Ownership", description: "Set who owns and completes assessments.", icon: Settings2 },
  { stage: "SCENARIOS", label: "Risk scenarios", description: "Maintain the risk scenario library.", icon: Settings2 },
  { stage: "DESIGN", label: "Assessment design", description: "Configure questions, ratings, and calculations.", icon: Settings2 },
  { stage: "AGENT", label: "General agent", description: "Control how the workspace assistant may use external information.", icon: Bot },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function GeneralAgentEditor({ configuration, setConfiguration }: {
  configuration: WorkspaceConfiguration;
  setConfiguration: (configuration: WorkspaceConfiguration) => void;
}) {
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const allowedSources = configuration.agent?.allowedWebSources ?? [];
  const addSource = () => {
    const normalized = normalizeAllowedWebSource(source);
    if (!normalized) {
      setError("Enter a valid domain, such as eba.europa.eu.");
      return;
    }
    if (allowedSources.includes(normalized)) {
      setError("That domain is already allowed.");
      return;
    }
    setConfiguration({ ...configuration, agent: { ...configuration.agent, allowedWebSources: [...allowedSources, normalized] } });
    setSource("");
    setError("");
  };
  const removeSource = (domain: string) => setConfiguration({
    ...configuration,
    agent: { ...configuration.agent, allowedWebSources: allowedSources.filter((sourceDomain) => sourceDomain !== domain) },
  });

  return <div className="space-y-4">
    <div className="flex items-start gap-3 rounded-[11px] border border-[#dfe2ee] bg-[#f4f5fb] p-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-white text-[#586ad0] shadow-sm"><Bot className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-[#30323c]">General-purpose agent</p><p className="mt-1 text-xs leading-5 text-[#707482]">Set workspace-wide boundaries for the assistant people chat with outside a specific setup or assessment workflow.</p></div></div>

    <div className="rounded-[11px] border border-[#e1e2e7] bg-white p-4">
      <div className="flex items-start gap-3"><Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6876ca]" /><div><p className="text-xs font-semibold text-[#363944]">Allowed web sources</p><p className="mt-1 text-[11px] leading-5 text-[#777b88]">When web search is used, the agent may only retrieve information from these domains. An empty list means web search is not allowed.</p></div></div>
      <form onSubmit={(event) => { event.preventDefault(); addSource(); }} className="mt-4 flex flex-col gap-2 sm:flex-row"><input aria-label="Allowed web source" value={source} onChange={(event) => { setSource(event.target.value); setError(""); }} className="h-10 min-w-0 flex-1 rounded-[9px] border border-[#dedfe5] bg-white px-3 text-sm text-[#30323c] shadow-sm placeholder:text-[#a0a3ae] focus:border-[#7785d8] focus:outline-none focus:ring-3 focus:ring-[#e9ebfa]" placeholder="eba.europa.eu" /><Button type="submit" variant="secondary" disabled={!source.trim()}><Plus className="h-3.5 w-3.5" />Add source</Button></form>
      {error && <p role="alert" className="mt-2 text-[11px] text-[#a42c21]">{error}</p>}
    </div>

    {allowedSources.length > 0 ? <div className="overflow-hidden rounded-[11px] border border-[#e1e2e7] bg-white"><div className="border-b border-[#e8e9ed] bg-[#fafafd] px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#858895]">{allowedSources.length} allowed domain{allowedSources.length === 1 ? "" : "s"}</div><div className="divide-y divide-[#ececf0]">{allowedSources.map((domain) => <div key={domain} className="flex items-center gap-3 px-4 py-3"><Globe2 className="h-4 w-4 shrink-0 text-[#858895]" /><span className="min-w-0 flex-1 truncate font-mono text-xs text-[#424550]">{domain}</span><button type="button" aria-label={`Remove ${domain}`} onClick={() => removeSource(domain)} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#9a6964] hover:bg-[#fff2f0]"><X className="h-3.5 w-3.5" /></button></div>)}</div></div> : <div className="rounded-[11px] border border-dashed border-[#d6d8df] px-4 py-6 text-center"><p className="text-xs font-semibold text-[#5d606c]">Web search is not allowed</p><p className="mt-1 text-[10px] text-[#8b8e99]">Add a domain when you are ready to permit a trusted source.</p></div>}
  </div>;
}

export default function SettingsPage() {
  const router = useRouter();
  const { state, updateConfiguration, resetWorkspace } = useKimsy();
  const [stage, setStage] = useState<SettingsSection>("ORGANIZATION");
  const [draft, setDraft] = useState<WorkspaceConfiguration>(() => clone(state.configuration));
  const [saved, setSaved] = useState(false);
  const errors = validateConfiguration(draft);
  const selectedTab = tabs.find((tab) => tab.stage === stage)!;

  const updateDraft = (configuration: WorkspaceConfiguration) => {
    setDraft(configuration);
    setSaved(false);
  };
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
    <PageHeader eyebrow="Workspace" title="Settings" description="Configure your organization, assessment method, and the boundaries Kimsy should work within." actions={<Button disabled={errors.length > 0} onClick={save}><Save className="h-4 w-4" />Save settings</Button>} />
    {saved && <div className="flex items-center gap-2 rounded-[6px] border border-[#b9decf] bg-[#eff9f4] px-4 py-3 text-xs font-semibold text-[#176b4b]"><CheckCircle2 className="h-4 w-4" />Settings saved.</div>}
    <div className="grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)]">
      <Panel className="h-fit overflow-hidden"><nav aria-label="Workspace settings" className="p-2">{tabs.map((tab) => <button key={tab.stage} onClick={() => setStage(tab.stage)} className={`flex w-full items-center gap-2 rounded-[7px] px-3 py-2.5 text-left text-xs font-semibold ${stage === tab.stage ? "bg-[#eff1fb] text-[#5364c2]" : "text-[#5d606c] hover:bg-[#f4f4f7]"}`}><tab.icon className="h-3.5 w-3.5" />{tab.label}</button>)}</nav><div className="border-t border-[#e5e5e9] p-3"><button onClick={reset} className="inline-flex items-center gap-2 text-xs font-semibold text-[#9a3c33]"><RotateCcw className="h-3.5 w-3.5" />Reset workspace</button></div></Panel>
      <Panel className="overflow-hidden"><div className="flex items-start justify-between gap-4 border-b border-[#ededf0] px-5 py-4"><div><h2 className="text-sm font-semibold text-[#292b35]">{selectedTab.label}</h2><p className="mt-1 text-xs text-[#797c89]">{selectedTab.description}</p></div><Badge tone={errors.length ? "warning" : "success"}>{errors.length ? `${errors.length} checks` : "Valid"}</Badge></div><div className="p-5">{stage === "AGENT" ? <GeneralAgentEditor configuration={draft} setConfiguration={updateDraft} /> : <StructuredEditor stage={stage} configuration={draft} setConfiguration={updateDraft} />}</div></Panel>
    </div>
    {errors.length > 0 && <div className="rounded-[6px] border border-[#ead5a5] bg-[#fffaf0] px-4 py-3"><p className="text-xs font-semibold text-[#7a5a1c]">Configuration checks</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#786846]">{errors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}</ul></div>}
  </div>;
}
