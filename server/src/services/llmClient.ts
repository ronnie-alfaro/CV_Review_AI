import { config } from "../config.js";

type Message = { role: "system" | "user"; content: string };

export class LocalLlmClient {
  async status(): Promise<{ online: boolean; model: string; baseUrl: string }> {
    try {
      const response = await fetch(`${config.llmBaseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${config.llmApiKey}`
        },
        signal: AbortSignal.timeout(Math.min(config.llmTimeoutMs, 2000))
      });
      return {
        online: response.ok,
        model: config.llmModel,
        baseUrl: config.llmBaseUrl
      };
    } catch {
      return {
        online: false,
        model: config.llmModel,
        baseUrl: config.llmBaseUrl
      };
    }
  }

  async generateJson<T>(messages: Message[], schema: { parse: (data: unknown) => T }, fallback: T): Promise<T> {
    try {
      const response = await fetch(`${config.llmBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.llmApiKey}`
        },
        body: JSON.stringify({
          model: config.llmModel,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages
        }),
        signal: AbortSignal.timeout(config.llmTimeoutMs)
      });

      if (!response.ok) return fallback;
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return fallback;
      return schema.parse(JSON.parse(content));
    } catch {
      return fallback;
    }
  }
}

export const llmClient = new LocalLlmClient();
