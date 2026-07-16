/**
 * Shared helper for safely extracting a JSON object from raw LLM completion text.
 *
 * LLMs frequently wrap JSON responses in markdown code fences (```json ... ```)
 * or add stray text around the object. This function strips markdown fences and
 * isolates the first `{...}` block before parsing.
 *
 * This consolidates what were previously 6 near-identical copies of the same
 * logic (`sanitizeAndParseJson` in src/index.ts and 4 route.ts files, plus
 * `extractShieldJson` in PromptFilter.ts and agent.ts) into a single source of
 * truth. Fixing a bug here (e.g. the markdown-fence regex) now only needs to
 * happen in one place.
 *
 * @param rawText Raw text returned from an LLM completion call.
 * @throws Error if no `{...}` boundaries can be found, or if the extracted
 *   substring is not valid JSON.
 */
export function extractJsonFromText(rawText: string): any {
  const cleanText = rawText
    .replace(/^```(json)?\n/, '')
    .replace(/```$/, '')
    .trim();

  const startIdx = cleanText.indexOf('{');
  const endIdx = cleanText.lastIndexOf('}');

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`JSON boundaries not found in raw text. Raw (truncated): ${rawText.slice(0, 100)}`);
  }

  const jsonString = cleanText.slice(startIdx, endIdx + 1);
  return JSON.parse(jsonString);
}
