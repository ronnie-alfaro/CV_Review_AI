import { ChangeEvent, ReactNode } from "react";
import { ArrowRight, CircleAlert, CircleCheck, Compass, Eye, Plus, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, Upload } from "lucide-react";
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
        <div className="mt-4 rounded-md bg-muted/40 px-3 py-2 text-sm leading-6 text-muted-foreground">
          Supports PDF and DOCX. Scanned PDFs may need OCR before upload.
        </div>
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
                <div className="text-sm font-semibold">Phase 1: Detected CV structure</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidate.sections.map((section) => (
                    <span key={`${section.heading}-${section.kind}`} className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {section.heading}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <ParseAuditPanel candidate={candidate} />
            <CandidateCard candidate={candidate} />
            <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-4 md:grid-cols-4">
              <Metric label="Roles" value={candidate.experience.length} />
              <Metric label="Skills" value={candidate.skills.length} />
              <Metric label="Projects" value={candidate.projects.length} />
              <Metric label="Sections" value={candidate.sections.length} />
            </div>
            {candidate.experience.length <= 1 && candidate.rawText.toLowerCase().includes("experience") && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                Only one role was detected. Review the experience section carefully before continuing.
              </div>
            )}
            <Field label="Name" value={candidate.name ?? ""} onChange={(e) => update("name", e.target.value)} />
            <Field label="Summary" value={candidate.summary ?? ""} onChange={(e) => update("summary", e.target.value)} />
            <Field label="Skills" value={candidate.skills.join(", ")} onChange={(e) => update("skills", e.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
            <ExperienceEditor experience={candidate.experience} onChange={(experience) => update("experience", experience)} />
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

function CandidateCard({ candidate }: { candidate: CandidateProfile }) {
  const card = candidate.candidateCard;
  const swot = card.swot;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-panel">
      <div className="bg-primary px-5 py-5 text-primary-foreground">
        <div className="flex items-center gap-2 text-sm font-medium opacity-90">
          <Sparkles className="h-4 w-4" />
          Candidate card
        </div>
        <h3 className="mt-3 text-2xl font-semibold">{card.headline}</h3>
        <p className="mt-2 text-sm opacity-85">{card.archetype}</p>
      </div>
      <div className="grid gap-5 p-5">
        <div className="grid gap-3">
          <NarrativeRow icon={<Target className="h-4 w-4" />} title="What this CV is selling" text={card.marketPositioning} />
          <NarrativeRow icon={<Compass className="h-4 w-4" />} title="Market narrative" text={card.sellingNarrative} />
          <NarrativeRow icon={<Eye className="h-4 w-4" />} title="Likely reader takeaway" text={card.readerTakeaway} />
        </div>

        <div>
          <div className="text-sm font-semibold">FODA / SWOT</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SwotBlock title="Strengths" tone="green" items={swot.strengths} />
            <SwotBlock title="Weaknesses" tone="amber" items={swot.weaknesses} />
            <SwotBlock title="Opportunities" tone="blue" items={swot.opportunities} />
            <SwotBlock title="Threats" tone="red" items={swot.threats} />
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" />
            Trajectory
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.trajectory}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <IdentityList title="Technical identity" items={card.technicalIdentity} />
          <IdentityList title="Leadership identity" items={card.leadershipIdentity} />
        </div>

        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Strongest signals
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {card.strongestSignals.map((signal) => (
              <div key={signal.label} className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-sm font-semibold">{signal.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{signal.value}</div>
                {signal.evidence.length > 0 && (
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">
                    {signal.evidence.slice(0, 3).join(" · ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NarrativeRow({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function SwotBlock({ title, tone, items }: { title: string; tone: "green" | "amber" | "blue" | "red"; items: string[] }) {
  const tones = {
    green: "border-teal-200 bg-teal-50 text-teal-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    blue: "border-sky-200 bg-sky-50 text-sky-950",
    red: "border-red-200 bg-red-50 text-red-950"
  };
  return (
    <div className={`rounded-md border p-4 ${tones[tone]}`}>
      <div className="text-sm font-semibold">{title}</div>
      <ul className="mt-2 grid gap-2 text-sm leading-6">
        {(items.length ? items : ["No clear signal detected."]).slice(0, 5).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function IdentityList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(items.length ? items : ["Needs more evidence"]).slice(0, 10).map((item) => (
          <span key={item} className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">{item}</span>
        ))}
      </div>
    </div>
  );
}

function ParseAuditPanel({ candidate }: { candidate: CandidateProfile }) {
  const audit = candidate.parseAudit;
  const needsAttention = audit.status === "Needs attention";
  const review = audit.status === "Review";
  return (
    <div className={`rounded-md border p-4 ${needsAttention ? "border-red-200 bg-red-50" : review ? "border-amber-200 bg-amber-50" : "border-teal-200 bg-teal-50"}`}>
      <div className="flex items-center gap-2">
        {audit.status === "Pass" ? <CircleCheck className="h-5 w-5 text-teal-700" /> : <CircleAlert className={`h-5 w-5 ${needsAttention ? "text-red-700" : "text-amber-700"}`} />}
        <div className="text-sm font-semibold">Phase 2: Parse audit · {audit.status}</div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <Metric label="Roles" value={audit.extractedCounts.roles} />
        <Metric label="Skills" value={audit.extractedCounts.skills} />
        <Metric label="Projects" value={audit.extractedCounts.projects} />
        <Metric label="Education" value={audit.extractedCounts.education} />
        <Metric label="Certs" value={audit.extractedCounts.certifications} />
      </div>
      {audit.warnings.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {audit.warnings.map((warning) => (
            <div key={warning} className="rounded-md bg-white px-3 py-2 text-sm leading-6 text-muted-foreground">
              {warning}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">The extracted counts are consistent with the detected CV sections.</p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function ExperienceEditor({ experience, onChange }: { experience: ExperienceItem[]; onChange: (experience: ExperienceItem[]) => void }) {
  function updateRole(index: number, next: ExperienceItem) {
    onChange(experience.map((item, itemIndex) => itemIndex === index ? next : item));
  }

  function removeRole(index: number) {
    onChange(experience.filter((_, itemIndex) => itemIndex !== index));
  }

  function addRole() {
    onChange([...experience, { title: "Role", company: "Company", dates: "", bullets: [] }]);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">Experience</div>
        <Button variant="secondary" type="button" onClick={addRole}>
          <Plus className="h-4 w-4" />
          Add role
        </Button>
      </div>
      {experience.map((item, index) => (
        <div key={`${item.title}-${item.company}-${index}`} className="rounded-md border border-border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <input className="rounded-md border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={item.title} onChange={(event) => updateRole(index, { ...item, title: event.target.value })} placeholder="Role" />
            <input className="rounded-md border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={item.company} onChange={(event) => updateRole(index, { ...item, company: event.target.value })} placeholder="Company" />
            <input className="rounded-md border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={item.dates ?? ""} onChange={(event) => updateRole(index, { ...item, dates: event.target.value })} placeholder="Dates" />
          </div>
          <textarea
            className="mt-3 min-h-28 w-full resize-y rounded-md border border-input px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring"
            value={item.bullets.map((bullet) => `- ${bullet.replace(/^[-•]\s*/, "").trim()}`).join("\n")}
            onChange={(event) => updateRole(index, { ...item, bullets: event.target.value.split("\n").map((line) => line.replace(/^[-•]\s*/, "").trim()).filter(Boolean) })}
            placeholder="- Achievement or responsibility"
          />
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" type="button" onClick={() => removeRole(index)}>
              <Trash2 className="h-4 w-4" />
              Remove role
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
