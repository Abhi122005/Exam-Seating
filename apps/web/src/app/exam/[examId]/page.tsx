import { StudentSearch } from "~/components/StudentSearch";
import { notFound } from "next/navigation";
import { getPublicExamMeta } from "~/lib/exam-release";

export const revalidate = 0; // dynamic: release gate is time-based

export default async function ExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const state = await getPublicExamMeta(examId);

  if (!state.found) {
    notFound();
  }

  return (
    <div className="py-6">
      <StudentSearch
        examId={state.meta.examId}
        title={state.meta.title || "Exam Seating"}
        session={state.meta.session || "Morning"}
        initialStatus={state.status}
        publishAt={state.meta.publishAt}
      />
    </div>
  );
}
