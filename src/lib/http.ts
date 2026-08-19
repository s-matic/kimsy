export async function readJsonResponse(response: Response) {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`Kimsy received an empty server response (HTTP ${response.status}).`);
  }
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new Error(`Kimsy received an invalid server response (HTTP ${response.status}).`);
  }
}
