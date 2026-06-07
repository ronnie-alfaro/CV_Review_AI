export type LlmStatus = {
  online: boolean;
  model: string;
  baseUrl: string;
};

export async function getLlmStatus(): Promise<LlmStatus> {
  const response = await fetch("/api/llm/status");
  if (!response.ok) {
    throw new Error("Could not read LLM status.");
  }
  return response.json() as Promise<LlmStatus>;
}
