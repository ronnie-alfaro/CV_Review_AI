import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";
import { getLlmStatus, type LlmStatus } from "../../lib/llmStatus";

export function LlmStatusBadge() {
  const [status, setStatus] = useState<LlmStatus | undefined>();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const next = await getLlmStatus();
        if (mounted) setStatus(next);
      } catch {
        if (mounted) setStatus({ online: false, model: "local-model", baseUrl: "" });
      }
    }
    void load();
    const id = window.setInterval(load, 10000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  const online = status?.online ?? false;

  return (
    <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${online ? "border-teal-200 bg-teal-50 text-teal-900" : "border-slate-200 bg-white text-slate-600"}`} title={status?.baseUrl}>
      <span className={`h-2 w-2 rounded-full ${online ? "bg-teal-700" : "bg-red-600"}`} />
      <Cpu className="h-4 w-4" />
      <span>LLM {status?.model ?? "local-model"}: {online ? "Online" : "Offline"}</span>
    </div>
  );
}
