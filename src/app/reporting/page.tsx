"use client";

import { Download, FileBarChart, TrendingUp } from "lucide-react";
import { Badge, Metric, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { useKimsy } from "@/lib/store";

export default function ReportingPage() {
  const { state } = useKimsy();
  const current = state.assessments[0];
  const categories = [
    { name: "Financial crime", score: 88, rating: "High", color: "#c74035" },
    { name: "Customer conduct", score: 62, rating: "Moderate", color: "#d39a2e" },
    { name: "Regulatory obligations", score: 36, rating: "Low", color: "#268166" },
    { name: "Markets compliance", score: 12, rating: "Low", color: "#268166" },
  ];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Management view" title="Compliance risk position" description="Exposure, movement, appetite, and action translated for management decision-making." actions={<a href={`/api/reports/${current.id}`} className="inline-flex h-9 items-center gap-2 rounded-[5px] border border-[#0f766e] bg-[#0f766e] px-3.5 text-sm font-semibold text-white hover:bg-[#0b625c]"><Download className="h-4 w-4" />Export board PDF</a>} />
      <Panel className="grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4"><Metric label="Units assessed" value="2 of 3" detail="67% annual coverage" /><Metric label="Outside appetite" value="2" detail="1 new this period" tone="danger" /><Metric label="High residual exposure" value="1" detail="CDD failure risk" tone="danger" /><Metric label="Actions on track" value="83%" detail="5 of 6 within due date" tone="success" /></Panel>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.75fr)]">
        <Panel>
          <PanelHeader title="Exposure by risk category" description="Current residual position across assessed business units" />
          <div className="space-y-5 px-5 py-6">{categories.map((category) => <div key={category.name}><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-[#3b4944]">{category.name}</span><Badge tone={category.rating === "High" ? "danger" : category.rating === "Moderate" ? "warning" : "success"}>{category.rating}</Badge></div><div className="h-3 overflow-hidden rounded-[3px] bg-[#edf1ef]"><div className="h-full rounded-[3px]" style={{ width: `${category.score}%`, backgroundColor: category.color }} /></div></div>)}</div>
        </Panel>
        <Panel>
          <PanelHeader title="Management conclusion" action={<Badge tone="info">Draft</Badge>} />
          <div className="px-5 py-5"><div className="flex items-center gap-2 text-[#a42c21]"><TrendingUp className="h-4 w-4" /><p className="text-xs font-bold uppercase">Exposure increased</p></div><p className="mt-3 text-sm leading-6 text-[#3c4a45]">The overall compliance risk position remains manageable, but Retail Banking&apos;s customer due diligence exposure is now outside appetite following customer expansion and weaker control performance.</p><div className="mt-4 rounded-[4px] border-l-2 border-[#c74035] bg-[#fff5f4] px-4 py-3"><p className="text-xs font-semibold text-[#84251d]">Decision required</p><p className="mt-1 text-xs leading-5 text-[#76544f]">Confirm whether remediation capacity and the Q4 platform migration provide a credible return to appetite.</p></div></div>
        </Panel>
      </div>
      <Panel className="overflow-hidden">
        <PanelHeader title="Assessment outcomes" description="Latest position by business unit" />
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-[#e2e7e5] bg-[#f8faf9] text-[10px] font-bold uppercase text-[#71807a]"><th className="px-5 py-3">Business unit</th><th className="px-4 py-3">Assessment</th><th className="px-4 py-3">Position</th><th className="px-4 py-3">Movement</th><th className="px-4 py-3">Appetite breaches</th><th className="px-5 py-3">Report</th></tr></thead><tbody>{state.assessments.map((assessment, index) => <tr key={assessment.id} className="border-b border-[#e7ebe9] last:border-b-0"><td className="px-5 py-4 text-sm font-semibold">{assessment.businessUnit}</td><td className="px-4 py-4 text-xs text-[#5d6a65]">{assessment.period}</td><td className="px-4 py-4"><Badge tone={index === 0 ? "danger" : index === 1 ? "warning" : "success"}>{index === 0 ? "High" : index === 1 ? "Moderate" : "Low"}</Badge></td><td className="px-4 py-4 text-xs font-semibold text-[#596761]">{index === 0 ? "Increased" : "Stable"}</td><td className="px-4 py-4 text-xs text-[#596761]">{assessment.scenarioAssessments.filter((item) => item.relevant && !item.withinAppetite).length}</td><td className="px-5 py-4">{assessment.status === "FINALIZED" ? <a href={`/api/reports/${assessment.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0f766e]"><FileBarChart className="h-3.5 w-3.5" />PDF</a> : <span className="text-xs text-[#8a9591]">Not final</span>}</td></tr>)}</tbody></table></div>
      </Panel>
    </div>
  );
}
