import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AssessmentCycle, FrameworkVersion, OrganizationSettings } from "@/lib/types";

function wrap(text: string, max = 88) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildAssessmentPdf(
  organization: OrganizationSettings,
  assessment: AssessmentCycle,
  framework: FrameworkVersion,
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  let page = pdf.addPage(pageSize);
  let y = 790;

  const ensure = (height = 40) => {
    if (y - height < 56) {
      page = pdf.addPage(pageSize);
      y = 790;
    }
  };
  const line = (text: string, size = 10, font = regular, color = rgb(0.19, 0.25, 0.22), gap = 15) => {
    ensure(gap);
    page.drawText(text, { x: 48, y, size, font, color });
    y -= gap;
  };
  const paragraph = (text: string, size = 9) => {
    for (const value of wrap(text)) line(value, size, regular, rgb(0.27, 0.33, 0.3), 13);
    y -= 5;
  };

  page.drawRectangle({ x: 0, y: 730, width: pageSize[0], height: 112, color: rgb(0.09, 0.14, 0.12) });
  page.drawText("KIMSY", { x: 48, y: 806, size: 10, font: bold, color: rgb(0.34, 0.76, 0.7) });
  page.drawText("Compliance risk assessment", { x: 48, y: 775, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`${organization.name}  |  ${assessment.reference}`, { x: 48, y: 750, size: 9, font: regular, color: rgb(0.78, 0.84, 0.81) });
  y = 700;
  line(assessment.businessUnit, 18, bold, rgb(0.09, 0.14, 0.12), 25);
  line(`${assessment.period}  |  Framework v${assessment.frameworkVersion}`, 9, regular, rgb(0.39, 0.45, 0.42), 24);
  line("EXECUTIVE POSITION", 8, bold, rgb(0.06, 0.46, 0.43), 18);
  paragraph("The principal compliance exposure arises from increasing customer complexity combined with deterioration in customer due diligence quality and review timeliness. Human review and the recorded assessment decisions remain authoritative.");

  line("ASSESSMENT GOVERNANCE", 8, bold, rgb(0.06, 0.46, 0.43), 18);
  paragraph(`Operating model: ${assessment.operatingModelSnapshot === "FIRST_LINE_LED" ? "First-line-led with compliance review" : "Compliance-led with same-officer finalization permitted"}. Assessment owner: ${assessment.owner}. Status: ${assessment.status.replaceAll("_", " ").toLowerCase()}.`);

  line("SCENARIO OUTCOMES", 8, bold, rgb(0.06, 0.46, 0.43), 18);
  const relevant = assessment.scenarioAssessments.filter((scenario) => scenario.relevant);
  if (!relevant.length) paragraph("No scenario results are available in this report snapshot.");
  for (const scenario of relevant) {
    const risk = framework.scenarios.find((item) => item.id === scenario.scenarioId);
    ensure(90);
    line(`${risk?.code ?? "Risk"}  ${risk?.title ?? "Scenario"}`, 10, bold, rgb(0.12, 0.17, 0.15), 16);
    line(`Rating: ${scenario.acceptedRating ?? scenario.proposedRating}  |  Appetite: ${risk?.appetite ?? "Not set"}  |  ${scenario.withinAppetite ? "Within appetite" : "OUTSIDE APPETITE"}`, 8, bold, scenario.withinAppetite ? rgb(0.09, 0.42, 0.29) : rgb(0.65, 0.17, 0.13), 14);
    paragraph(scenario.rationale, 8);
  }

  ensure(70);
  line("AUDIT NOTE", 8, bold, rgb(0.06, 0.46, 0.43), 18);
  paragraph(`Generated ${new Date().toISOString().slice(0, 10)} as a point-in-time report. AI outputs in Kimsy are proposals only and require explicit human acceptance. This report records ${assessment.operatingModelSnapshot === "COMPLIANCE_LED" ? "compliance-led ownership and may include same-officer approval" : "first-line fact ownership and second-line compliance review"}.`, 8);

  return pdf.save();
}
