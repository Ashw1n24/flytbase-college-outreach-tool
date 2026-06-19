import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Briefcase, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Talent Radar · FlytBase" },
      {
        name: "description",
        content: "Internal talent sourcing engine for FlytBase.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-12 flex flex-col items-center gap-4">
        <img
          src="/flytbase-logo.png"
          alt="FlytBase"
          className="h-16 w-16 rounded-2xl object-contain"
        />
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Talent Radar
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            FlytBase · Internal Sourcing Engine
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/dashboard"
          className={cn(
            "group flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm",
            "transition-all hover:border-primary/40 hover:shadow-md hover:bg-accent/30",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Student Candidates
            </h2>
            <p className="mt-1 text-sm text-muted-foreground leading-snug">
              College students from hackathons, clubs &amp; competitions
            </p>
          </div>
        </Link>

        <Link
          to="/experienced"
          className={cn(
            "group flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm",
            "transition-all hover:border-primary/40 hover:shadow-md hover:bg-accent/30",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Experienced Candidates
            </h2>
            <p className="mt-1 text-sm text-muted-foreground leading-snug">
              Professionals with 3+ years of experience
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
