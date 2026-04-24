export const REPAIR_SYSTEM_PROMPT = `You are a JSON repair assistant. The provided JSON does not match the required schema.
Fix the JSON to match the schema. Return ONLY valid JSON. Do not include explanations.`;

export function buildRepairPrompt(invalidJson: string, errors: string, schemaJson: string): string {
  return `The following JSON has validation errors:\n\n${invalidJson}\n\nErrors:\n${errors}\n\nFix it to match this schema:\n${schemaJson}`;
}