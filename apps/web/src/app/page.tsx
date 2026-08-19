import { Suspense } from "react";
import { ExamList, ExamListSkeleton } from "~/components/ExamList";

export const revalidate = 30; // revalidate manifest every 30s

export default function HomePage() {
  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Find My Exam Seat</h1>
        <p className="text-sm text-muted-foreground">
          Select your exam session below to check your allocated hall & seat instantly.
        </p>
      </div>

      <Suspense fallback={<ExamListSkeleton />}>
        <ExamList />
      </Suspense>
    </div>
  );
}
