export async function GET() {
  return Response.json({ error: "PDF reporting is not part of the focused local-first workspace." }, { status: 410 });
}
