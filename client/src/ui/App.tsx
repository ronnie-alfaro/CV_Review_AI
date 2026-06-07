import { CheckCircle2, FileText, Gauge, Upload } from "lucide-react";
import { useAlignmentStore } from "../store/useAlignmentStore";
import { Landing } from "./screens/Landing";
import { ResumeStep } from "./screens/ResumeStep";
import { JobStep } from "./screens/JobStep";
import { JobReviewStep } from "./screens/JobReviewStep";
import { AnalysisDashboard } from "./screens/AnalysisDashboard";
import { LlmStatusBadge } from "./components/LlmStatusBadge";

const steps = [
  { id: "resume", label: "Resume", icon: FileText },
  { id: "job", label: "Job", icon: Upload },
  { id: "analysis", label: "Analysis", icon: Gauge }
];

export function App() {
  const { step, error } = useAlignmentStore();

  return (
    <main className="min-h-screen">
      {step !== "landing" && (
        <header className="no-print border-b border-border bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-primary">Career Alignment AI</div>
              <h1 className="text-xl font-semibold tracking-normal">Truthful career fit analysis</h1>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <LlmStatusBadge />
              <nav className="grid grid-cols-3 gap-2">
                {steps.map((item, index) => {
                  const Icon = item.icon;
                  const active =
                    (step === "resume" && index === 0) ||
                    ((step === "job" || step === "jobReview") && index === 1) ||
                    (step === "analysis" && index === 2);
                  return (
                    <div key={item.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${active ? "border-primary bg-accent text-accent-foreground" : "border-border bg-white text-muted-foreground"}`}>
                      {active && step === "analysis" ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>
        </header>
      )}
      {error && (
        <div className="mx-auto mt-4 max-w-7xl px-5">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        </div>
      )}
      {step === "landing" && <Landing />}
      {step === "resume" && <ResumeStep />}
      {step === "job" && <JobStep />}
      {step === "jobReview" && <JobReviewStep />}
      {step === "analysis" && <AnalysisDashboard />}
    </main>
  );
}
