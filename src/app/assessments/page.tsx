"use client";

import Link from "next/link";
import { ArrowRight, Filter, Plus, Search } from "lucide-react";
import { Badge, Button, PageHeader, Panel, Progress } from "@/components/ui";
import { useKimsy } from "@/lib/store";

export default function AssessmentsPage() {
  const { state } = useKimsy();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assessment register"
        title="Compliance risk assessments"
        description="Track periodic reviews across business units using the operating model active when each cycle started."
        actions={<Link href="/assessments/new" className="inline-flex h-9 items-center gap-2 rounded-[5px] border border-[#0f766e] bg-[#0f766e] px-3.5 text-sm font-semibold text-white hover:bg-[#0b625c]"><Plus className="h-4 w-4" />New assessment</Link>}
      />
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#dce2df] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex h-9 max-w-sm flex-1 items-center gap-2 rounded-[5px] border border-[#d4dbd8] px-3">
            <Search className="h-4 w-4 text-[#74817c]" />
            <input className="w-full bg-transparent text-sm focus:outline-none" placeholder="Search assessments" aria-label="Search assessments" />
          </div>
          <Button variant="secondary"><Filter className="h-4 w-4" />Filter</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse text-left">
            <thead><tr className="border-b border-[#e2e7e5] bg-[#f8faf9] text-[10px] font-bold uppercase text-[#71807a]"><th className="px-5 py-3">Assessment</th><th className="px-4 py-3">Operating model</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Due date</th><th className="px-5 py-3"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {state.assessments.map((assessment) => {
                const open = assessment.exceptions.filter((item) => item.status === "OPEN").length;
                return (
                  <tr key={assessment.id} className="border-b border-[#e7ebe9] last:border-b-0 hover:bg-[#fafcfb]">
                    <td className="px-5 py-4"><Link href={`/assessments/${assessment.id}`} className="text-sm font-semibold text-[#1c2824] hover:text-[#0f766e]">{assessment.businessUnit}</Link><p className="mt-1 text-[11px] text-[#77837e]">{assessment.reference} · Framework v{assessment.frameworkVersion}</p></td>
                    <td className="px-4 py-4"><Badge tone="info">{assessment.operatingModelSnapshot === "FIRST_LINE_LED" ? "First-line-led" : "Compliance-led"}</Badge></td>
                    <td className="px-4 py-4"><Badge tone={assessment.status === "FINALIZED" ? "success" : assessment.status === "IN_REVIEW" ? "warning" : "neutral"}>{assessment.status.replaceAll("_", " ").toLowerCase()}</Badge>{open > 0 && <p className="mt-1.5 text-[10px] font-semibold text-[#a42c21]">{open} open exception{open === 1 ? "" : "s"}</p>}</td>
                    <td className="px-4 py-4 text-xs text-[#4d5b56]">{assessment.owner}</td>
                    <td className="w-44 px-4 py-4"><Progress value={assessment.completion} /></td>
                    <td className="px-4 py-4 text-xs text-[#4d5b56]">{assessment.dueDate}</td>
                    <td className="px-5 py-4 text-right"><Link href={`/assessments/${assessment.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-[5px] text-[#4c5a55] hover:bg-[#edf2f0]" aria-label={`Open ${assessment.businessUnit}`}><ArrowRight className="h-4 w-4" /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
