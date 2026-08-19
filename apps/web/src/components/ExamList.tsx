import { readManifest } from "~/lib/blob";
import Link from "next/link";
import Calendar from "lucide-react/dist/esm/icons/calendar.mjs";
import Clock from "lucide-react/dist/esm/icons/clock.mjs";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";

export function ExamListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading seating schedules">
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Seating schedules streaming in...
      </div>
      <div className="grid gap-4 animate-pulse">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="p-5 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between"
          >
            <div className="space-y-2">
              <div className="h-4 w-44 bg-muted rounded" />
              <div className="flex items-center gap-4">
                <div className="h-3 w-16 bg-muted/70 rounded" />
                <div className="h-3 w-20 bg-muted/70 rounded" />
              </div>
            </div>
            <div className="w-5 h-5 rounded-full bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

export async function ExamList() {
  const manifest = await readManifest();

  if (manifest.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-2">
        <Clock className="w-8 h-8 mx-auto text-muted-foreground/60" />
        <h3 className="font-semibold text-base">No Seating Schedules Released Yet</h3>
        <p className="text-xs">Staff have not published any seating arrangements for today yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {manifest.map((exam) => {
        const isLive =
          Date.now() >= new Date(exam.publishAt).getTime() &&
          Date.now() <= new Date(exam.expiresAt).getTime();

        return (
          <Link
            key={exam.examId}
            href={`/exam/${exam.examId}`}
            className="p-5 rounded-xl border border-border bg-card hover:border-primary/50 transition-all flex items-center justify-between group shadow-sm"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base group-hover:text-primary transition-colors">
                  {exam.title}
                </span>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    isLive
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  }`}
                >
                  {isLive ? "Live Now" : "Scheduled"}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {exam.examDate}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Session: {exam.session}
                </span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </Link>
        );
      })}
    </div>
  );
}
