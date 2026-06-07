import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "../components/Button";
import { useAlignmentStore } from "../../store/useAlignmentStore";

export function Landing() {
  const setStep = useAlignmentStore((state) => state.setStep);
  return (
    <section className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f7f5ef_100%)]">
      <div className="mx-auto grid min-h-screen max-w-7xl content-center gap-10 px-5 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-teal-700" />
            Local-first analysis. No fabricated experience.
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-normal text-foreground md:text-6xl">
            Understand how your experience aligns with the jobs you want.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Compare your resume with a target role, see clear evidence behind every score, and produce a stronger truthful version of your CV.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button className="h-12 px-5 text-base" onClick={() => setStep("resume")}>
              Upload Resume
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid gap-3 rounded-lg border border-border bg-white p-5 shadow-panel">
          {["ATS readability", "Role alignment", "Skills coverage", "Leadership signals", "Technical signals", "Communication signals"].map((label, index) => (
            <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border py-3 last:border-b-0">
              <span className="text-sm font-medium">{label}</span>
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{index + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
