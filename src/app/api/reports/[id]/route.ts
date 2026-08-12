import { initialState } from "@/lib/seed";
import { buildAssessmentPdf } from "@/lib/report";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const assessment = initialState.assessments.find((item) => item.id === id) ?? initialState.assessments[0];
  const framework = initialState.frameworkVersions.find((item) => item.version === assessment.frameworkVersion) ?? initialState.frameworkVersions[0];
  const bytes = await buildAssessmentPdf(initialState.organization, assessment, framework);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${assessment.reference}-management-report.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
