export async function POST() {
  return Response.json({ error: "Use /api/ai/workspace for the AI-first assessment flow." }, { status: 410 });
}
