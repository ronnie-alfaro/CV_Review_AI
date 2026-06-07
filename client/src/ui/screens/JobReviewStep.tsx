import { BarChart3, BriefcaseBusiness, FileText, Pencil, Radar, Sparkles } from "lucide-react";
import { runAnalysis } from "../../lib/api";
import { useAlignmentStore } from "../../store/useAlignmentStore";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import type { JobDescription } from "../../../../shared/schemas";

export function JobReviewStep() {
  const store = useAlignmentStore();

  async function analyze() {
    if (!store.candidate || !store.job) return;
    store.setLoading(true);
    store.setError(undefined);
    try {
      store.setAnalysis(await runAnalysis(store.candidate, store.job));
      store.setStep("analysis");
    } catch (error) {
      store.setError(error instanceof Error ? error.message : "Could not analyze alignment.");
    } finally {
      store.setLoading(false);
    }
  }

  if (!store.job) {
    return (
      <section className="mx-auto max-w-4xl px-5 py-8">
        <Panel>
          <h2 className="text-xl font-semibold">No job description parsed yet</h2>
          <Button className="mt-5" onClick={() => store.setStep("job")}>Add Job Description</Button>
        </Panel>
      </section>
    );
  }

  const skillEmphasis = getSkillEmphasis(store.job);
  const roleSignals = getRoleSignals(store.job);
  const priorities = getPriorities(store.job);
  const maxSkillWeight = Math.max(1, ...skillEmphasis.map((skill) => skill.weight));

  return (
    <section className="mx-auto grid max-w-5xl gap-6 px-5 py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
            <FileText className="h-4 w-4" />
            Job description parsed
          </div>
          <h2 className="text-3xl font-semibold">Review extracted requirements</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Check what the system found before generating the resume alignment analysis.
          </p>
        </div>
        <Button variant="secondary" onClick={() => store.setStep("job")}>
          <Pencil className="h-4 w-4" />
          Edit Description
        </Button>
      </div>

      <Panel className="overflow-hidden p-0">
        <div className="bg-primary px-6 py-6 text-primary-foreground">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90">
            <BriefcaseBusiness className="h-4 w-4" />
            Role snapshot
          </div>
          <h3 className="mt-3 text-2xl font-semibold">{store.job.title ?? "Target role"}</h3>
          <p className="mt-2 text-sm opacity-85">Seniority: {store.job.seniority ?? "Not specified"}</p>
        </div>
        <div className="grid gap-0 md:grid-cols-3">
          <SnapshotMetric label="Critical" value={priorities.critical.length} tone="red" />
          <SnapshotMetric label="Important" value={priorities.important.length} tone="amber" />
          <SnapshotMetric label="Nice to have" value={priorities.nice.length} tone="slate" />
        </div>
        <div className="border-t border-border p-5">
          <div className="mb-3 flex items-center gap-2">
            <Radar className="h-5 w-5 text-teal-700" />
            <h3 className="text-lg font-semibold">What this role is really asking for</h3>
          </div>
          <div className="grid gap-3">
            {roleSignals.map((signal) => (
              <div key={signal.title} className="rounded-md bg-muted/40 px-4 py-3">
                <div className="text-sm font-semibold">{signal.title}</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{signal.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-teal-700" />
          <h3 className="text-lg font-semibold">Skill emphasis</h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">The strongest signals should be easiest to find in the CV.</p>
        <div className="mt-5 grid gap-3">
          {skillEmphasis.map((skill) => (
            <div key={skill.name} className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{skill.name}</span>
                <span className="text-xs text-muted-foreground">{skill.weight >= 3 ? "High emphasis" : skill.weight === 2 ? "Medium emphasis" : "Supporting"}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-teal-700" style={{ width: `${Math.max(32, (skill.weight / maxSkillWeight) * 100)}%` }} />
              </div>
            </div>
          ))}
          {!skillEmphasis.length && (
            <div className="rounded-md bg-muted/40 px-4 py-3 text-sm text-muted-foreground">No explicit skills were extracted.</div>
          )}
        </div>
      </Panel>

      <div className="grid gap-5">
        <PriorityPanel title="Critical requirements" items={priorities.critical} tone="red" />
        <PriorityPanel title="Important requirements" items={priorities.important} tone="amber" />
        <PriorityPanel title="Nice to have" items={priorities.nice} tone="slate" />
        <RequirementPanel title="Likely screening filters" items={getScreeningFilters(store.job)} />
      </div>

      <Panel className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Ready to analyze the CV</h3>
          <p className="mt-1 text-sm text-muted-foreground">The next step compares these requirements against the candidate evidence.</p>
        </div>
        <Button className="md:min-w-52" disabled={store.loading} onClick={analyze}>
          <BarChart3 className="h-4 w-4" />
          {store.loading ? "Generating..." : "Generate Analysis"}
        </Button>
      </Panel>
    </section>
  );
}

function SnapshotMetric({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "slate" }) {
  const colors = {
    red: "text-red-900 bg-red-50",
    amber: "text-amber-900 bg-amber-50",
    slate: "text-slate-800 bg-slate-50"
  };
  return (
    <div className={`border-r border-border px-5 py-5 last:border-r-0 ${colors[tone]}`}>
      <div className="text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase">{label}</div>
    </div>
  );
}

function getPriorities(job: JobDescription) {
  return {
    critical: job.requiredSkills,
    important: [...job.technicalRequirements, ...job.leadershipRequirements, ...job.responsibilities],
    nice: [...job.preferredSkills, ...job.softSkills]
  };
}

function getScreeningFilters(job: JobDescription) {
  return Array.from(new Set([
    ...job.requiredSkills.slice(0, 6),
    ...(job.seniority ? [job.seniority] : []),
    ...job.technicalRequirements.slice(0, 3)
  ])).filter(Boolean);
}

function getSkillEmphasis(job: JobDescription) {
  const weights = new Map<string, number>();
  const add = (items: string[], weight: number) => {
    items.forEach((item) => {
      const key = item.trim();
      if (!key) return;
      weights.set(key, (weights.get(key) ?? 0) + weight);
    });
  };
  add(job.requiredSkills, 3);
  add(job.technicalRequirements, 2);
  add(job.leadershipRequirements, 2);
  add(job.preferredSkills, 1);
  add(job.softSkills, 1);
  return Array.from(weights.entries())
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
    .slice(0, 18);
}

function getRoleSignals(job: JobDescription) {
  const seniority = job.seniority && job.seniority !== "Not specified" ? job.seniority : "seniority not clearly specified";
  const technical = job.technicalRequirements.slice(0, 3).join(", ") || job.requiredSkills.slice(0, 3).join(", ") || "technical execution";
  const leadership = job.leadershipRequirements.slice(0, 2).join(", ") || "ownership and collaboration";
  const responsibilities = job.responsibilities.slice(0, 2).join(" and ") || "delivering the core responsibilities of the role";
  return [
    {
      title: "Role level",
      description: `The description points to ${seniority}. The CV should make scope, ownership, and level of autonomy easy to see.`
    },
    {
      title: "Core work",
      description: `The role appears centered on ${responsibilities}. These themes should show up near the top of the resume.`
    },
    {
      title: "Technical emphasis",
      description: `The strongest technical signals are ${technical}. The resume should show where these were used, not only list them.`
    },
    {
      title: "Leadership signal",
      description: `They are looking for evidence around ${leadership}. Add truthful examples of influence, mentoring, stakeholders, or ownership.`
    }
  ];
}

function RequirementPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <Panel className="shadow-none">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-4 grid gap-2">
        {(items.length ? items : ["No explicit evidence found."]).map((item) => (
          <div key={item} className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm leading-6 text-muted-foreground">
            {item}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PriorityPanel({ title, items, tone }: { title: string; items: string[]; tone: "red" | "amber" | "slate" }) {
  const classes = {
    red: "border-red-200 bg-red-50 text-red-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    slate: "border-slate-200 bg-slate-50 text-slate-800"
  };
  return (
    <Panel className="shadow-none">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {(items.length ? items : ["No explicit evidence found."]).map((item) => (
          <span key={item} className={`rounded-md border px-3 py-2 text-sm font-medium ${classes[tone]}`}>
            {item}
          </span>
        ))}
      </div>
    </Panel>
  );
}
