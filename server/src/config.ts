import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 5174),
  llmBaseUrl: process.env.LLM_BASE_URL ?? "http://localhost:8080/v1",
  llmModel: process.env.LLM_MODEL ?? "local-model",
  llmApiKey: process.env.LLM_API_KEY ?? "not-needed",
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 3000)
};
