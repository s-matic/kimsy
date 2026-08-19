export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ configured: Boolean(process.env.OPENAI_API_KEY) });
}
