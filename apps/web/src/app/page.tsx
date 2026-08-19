import { readManifest } from "~/lib/blob";
import Link from "next/link";
import { Calendar, Clock, ArrowRight } from "lucide-react";

export const revalidate = 30; // revalidate manifest every 30s

export default async function HomePage() {
  const manifest = await readManifest();

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Find My Exam Seat</h1>
        <p className="text-sm text-muted-foreground">
          Select your exam session below to check your allocated hall & seat instantly.
        </p>
      </div>

      {manifest.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-2">
          <Clock className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <h3 className="font-semibold text-base">No Seating Schedules Released Yet</h3>
          <p className="text-xs">
            Staff have not published any seating arrangements for today yet.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
