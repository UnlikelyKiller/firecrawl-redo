export const CLASSIFY_SYSTEM_PROMPT = `You are a content relevance classifier. Rate how relevant the provided content is to the given task on a scale of 0 to 1. Return a JSON object with "score" and "reason" fields.`;

export function buildClassifyPrompt(markdown: string, task: string): string {
  return `Rate the relevance of this content to the task: "${task}"\n\nContent:\n${markdown}`;
}