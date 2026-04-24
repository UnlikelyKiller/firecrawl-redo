export const EXTRACTION_SYSTEM_PROMPT = `You are a data extraction assistant. Extract structured data from the provided content according to the JSON schema.
Return ONLY valid JSON matching the schema. Do not include any explanation or markdown formatting.
For fields you cannot find in the content, use null.
For each extracted field, you MUST include a confidence score between 0 and 1 and a source quote from the content.`;

export function buildExtractionPrompt(markdown: string, schemaJson: string): string {
  return `Extract data from the following content according to this JSON schema:\n\n${schemaJson}\n\nContent:\n${markdown}`;
}