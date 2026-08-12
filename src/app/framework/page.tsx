"use client";

import { useRef, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, FileSpreadsheet, FileText, Plus, Sparkles, UploadCloud } from "lucide-react";
import { Badge, Button, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { useKimsy } from "@/lib/store";

export default function FrameworkPage() {
  const { state, publishDraftFramework } = useKimsy();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<{ fileName: string; sections: number; preview: string } | null>(null);
  const published = state.frameworkVersions.find((item) => item.status === "PUBLISHED");
  const draft = state.frameworkVersions.find((item) => item.status === "DRAFT");

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/framework/import", { method: "POST", body: form });
      const result = await response.json();
      setImportResult({ fileName: file.name, sections: result.sections?.length ?? 1, preview: result.preview ?? "Content extracted and ready for mapping." });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Customer methodology" title="Compliance risk framework" description="The published customer framework is the exclusive basis for questionnaires, assessment proposals, scoring, and appetite evaluation." actions={<><input ref={inputRef} type="file" accept=".pdf,.docx,.xlsx,.csv" className="hidden" onChange={(event) => upload(event.target.files?.[0])} /><Button loading={uploading} onClick={() => inputRef.current?.click()}><UploadCloud className="h-4 w-4" />Import source</Button></>} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_340px]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader title={`Published framework · v${published?.version}`} description={`${published?.name} · Published ${published?.publishedAt}`} action={<Badge tone="success"><CheckCircle2 className="mr-1 h-3 w-3" />Active</Badge>} />
            <div className="grid border-b border-[#e2e7e5] sm:grid-cols-4"><div className="border-b px-5 py-4 sm:border-b-0 sm:border-r"><p className="text-xs text-[#71807a]">Risk scenarios</p><p className="mt-1.5 text-xl font-semibold">{published?.scenarios.length}</p></div><div className="border-b px-5 py-4 sm:border-b-0 sm:border-r"><p className="text-xs text-[#71807a]">Taxonomy groups</p><p className="mt-1.5 text-xl font-semibold">4</p></div><div className="border-b px-5 py-4 sm:border-b-0 sm:border-r"><p className="text-xs text-[#71807a]">Mapped controls</p><p className="mt-1.5 text-xl font-semibold">15</p></div><div className="px-5 py-4"><p className="text-xs text-[#71807a]">Source files</p><p className="mt-1.5 text-xl font-semibold">{published?.sources.length}</p></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="border-b border-[#e2e7e5] bg-[#f8faf9] text-[10px] font-bold uppercase text-[#71807a]"><th className="px-5 py-3">Scenario</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Inherent</th><th className="px-4 py-3">Appetite</th><th className="px-5 py-3">Source</th></tr></thead><tbody>{published?.scenarios.map((risk) => <tr key={risk.id} className="border-b border-[#e7ebe9] last:border-b-0"><td className="px-5 py-4"><p className="text-sm font-semibold">{risk.title}</p><p className="mt-1 text-[10px] font-bold text-[#0f766e]">{risk.code}</p></td><td className="px-4 py-4 text-xs text-[#5b6963]">{risk.category}</td><td className="px-4 py-4"><Badge tone={risk.inherentRating === "Severe" || risk.inherentRating === "High" ? "danger" : "warning"}>{risk.inherentRating}</Badge></td><td className="px-4 py-4"><Badge>{risk.appetite}</Badge></td><td className="max-w-[220px] truncate px-5 py-4 text-[11px] text-[#6e7b76]">{risk.sourceCitation}</td></tr>)}</tbody></table></div>
          </Panel>
        </div>
        <div className="space-y-5">
          {draft && <Panel><PanelHeader title={`Draft · ${draft.version}`} description="Validation required before publishing" action={<Badge tone="warning">Needs review</Badge>} /><div className="space-y-3 px-5 py-4"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-4 w-4 text-[#8a6417]" /><p className="text-xs leading-5 text-[#6b5b37]">One appetite update needs confirmation against the existing scoring scale.</p></div><Button className="w-full" onClick={publishDraftFramework}><BookOpen className="h-4 w-4" />Validate and publish</Button></div></Panel>}
          {importResult && <Panel><PanelHeader title="Import ready for mapping" action={<Badge tone="info"><Sparkles className="mr-1 h-3 w-3" />Extracted</Badge>} /><div className="px-5 py-4"><p className="truncate text-sm font-semibold">{importResult.fileName}</p><p className="mt-1 text-xs text-[#6d7a75]">{importResult.sections} source section{importResult.sections === 1 ? "" : "s"} identified</p><p className="mt-3 line-clamp-4 rounded-[4px] bg-[#f4f7f6] px-3 py-2 text-[11px] leading-5 text-[#61706a]">{importResult.preview}</p><Button variant="secondary" className="mt-3 w-full">Open mapping workspace</Button></div></Panel>}
          <Panel><PanelHeader title="Source documents" /><div className="divide-y divide-[#e7ebe9]">{published?.sources.map((source) => <div key={source.id} className="flex items-center gap-3 px-5 py-3"><div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#edf2f0] text-[#52605b]">{source.type === "XLSX" || source.type === "CSV" ? <FileSpreadsheet className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{source.name}</p><p className="mt-0.5 text-[10px] text-[#7e8a85]">{source.size} · {source.uploadedAt}</p></div><Badge tone="success">{source.status}</Badge></div>)}</div><button onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 border-t border-[#e2e7e5] px-5 py-3 text-xs font-semibold text-[#0f766e] hover:bg-[#f7faf9]"><Plus className="h-3.5 w-3.5" />Add source</button></Panel>
        </div>
      </div>
    </div>
  );
}
