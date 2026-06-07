import { ChangeEvent } from "react";
import { ArrowRight, Upload } from "lucide-react";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { Field } from "../components/Field";
import { parseResume } from "../../lib/api";
import { useAlignmentStore } from "../../store/useAlignmentStore";
import type { CandidateProfile } from "../../../../shared/schemas";

export function ResumeStep() {
  const { candidate, loading, setCandidate, setStep, setLoading, setError } = useAlignmentStore();

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(undefined);
    try {
      setCandidate(await parseResume(file));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not parse resume.");
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) {
    if (candidate) setCandidate({ ...candidate, [key]: value });
  }

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[380px_1fr]">
      <Panel>
        <h2 className="text-2xl font-semibold">Upload Resume</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Add a PDF or DOCX resume. The extracted profile stays editable before analysis.</p>
        <label className="mt-6 flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-4 text-center">
          <Upload className="h-8 w-8 text-primary" />
          <span className="text-sm font-medium">{loading ? "Parsing..." : "Choose PDF or DOCX"}</span>
          <input className="hidden" type="file" accept=".pdf,.docx" onChange={onFile} />
        </label>
        <Button className="mt-5 w-full" disabled={!candidate} onClick={() => setStep("job")}>
          Continue to Job Description
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Panel>

      <Panel className="grid gap-4">
        <h2 className="text-xl font-semibold">Review extracted profile</h2>
        {!candidate ? (
          <div className="rounded-md bg-muted p-6 text-sm text-muted-foreground">Upload a resume to review parsed sections.</div>
        ) : (
          <>
            {candidate.sections.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <div className="text-sm font-semibold">Detected CV structure</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidate.sections.map((section) => (
                    <span key={`${section.heading}-${section.kind}`} className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {section.heading}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Field label="Name" value={candidate.name ?? ""} onChange={(e) => update("name", e.target.value)} />
            <Field label="Summary" value={candidate.summary ?? ""} onChange={(e) => update("summary", e.target.value)} />
            <Field label="Skills" value={candidate.skills.join(", ")} onChange={(e) => update("skills", e.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
            <Field label="Experience" value={formatExperience(candidate.experience)} onChange={(e) => update("experience", parseExperienceBlocks(e.target.value))} />
            <Field label="Education" value={candidate.education.join("\n")} onChange={(e) => update("education", e.target.value.split("\n").filter(Boolean))} />
            <Field label="Certifications" value={candidate.certifications.join("\n")} onChange={(e) => update("certifications", e.target.value.split("\n").filter(Boolean))} />
            <Field label="Projects" value={candidate.projects.join("\n")} onChange={(e) => update("projects", e.target.value.split("\n").filter(Boolean))} />
          </>
        )}
      </Panel>
    </section>
  );
}

type ExperienceItem = CandidateProfile["experience"][number];

function formatExperience(experience: ExperienceItem[]): string {
  return experience.map((item) => {
    const heading = [item.title, item.company, item.dates].filter(Boolean).join(" | ");
    const bullets = item.bullets.map((bullet) => `- ${bullet.replace(/^[-•]\s*/, "").trim()}`);
    return [heading, ...bullets].filter(Boolean).join("\n");
  }).join("\n\n");
}

function parseExperienceBlocks(value: string): ExperienceItem[] {
  const blocks = value.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const [heading = "Role | Company", ...bulletLines] = lines;
    const [title = "Role", company = "Company", dates] = heading.split("|").map((part) => part.trim());
    return {
      title,
      company,
      dates,
      bullets: bulletLines.map((line) => line.replace(/^[-•]\s*/, "").trim()).filter(Boolean)
    };
  });
}
