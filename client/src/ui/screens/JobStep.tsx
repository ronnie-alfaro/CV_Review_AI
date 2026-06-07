import { ChangeEvent, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { Field } from "../components/Field";
import { parseJob } from "../../lib/api";
import { useAlignmentStore } from "../../store/useAlignmentStore";

export function JobStep() {
  const store = useAlignmentStore();
  const [text, setText] = useState("");

  async function parseFromText() {
    store.setLoading(true);
    store.setError(undefined);
    try {
      store.setJob(await parseJob({ text }));
      store.setStep("jobReview");
    } catch (error) {
      store.setError(error instanceof Error ? error.message : "Could not parse job description.");
    } finally {
      store.setLoading(false);
    }
  }

  async function parseFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    store.setLoading(true);
    store.setError(undefined);
    try {
      store.setJob(await parseJob({ file }));
      store.setStep("jobReview");
    } catch (error) {
      store.setError(error instanceof Error ? error.message : "Could not parse job description.");
    } finally {
      store.setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-8">
      <Panel className="grid gap-4">
        <h2 className="text-2xl font-semibold">Add Job Description</h2>
        <Field label="Paste job description" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full role description here..." />
        <div className="flex flex-wrap gap-3">
          <Button onClick={parseFromText} disabled={text.length < 20 || store.loading}>Parse Description</Button>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
            <FileUp className="h-4 w-4" />
            Upload PDF or DOCX
            <input className="hidden" type="file" accept=".pdf,.docx" onChange={parseFromFile} />
          </label>
        </div>
      </Panel>
    </section>
  );
}
