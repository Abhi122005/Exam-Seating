"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/client";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.mjs";
import Calendar from "lucide-react/dist/esm/icons/calendar.mjs";
import Clock from "lucide-react/dist/esm/icons/clock.mjs";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.mjs";
import FileUp from "lucide-react/dist/esm/icons/file-up.mjs";

export default function AdminSchedulePage() {
  const utils = api.useUtils();
  const manifestQuery = api.seating.getManifest.useQuery();

  const deleteMutation = api.admin.deleteExam.useMutation({
    onSuccess: () => {
      utils.seating.getManifest.invalidate();
    },
  });

  const handleDelete = (examId: string) => {
    if (confirm(`Are you sure you want to delete exam ${examId}?`)) {
      deleteMutation.mutate({ examId });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Seating Schedule Manager</h1>
          <p className="text-xs text-muted-foreground">
            Manage uploaded exam seating slots and release schedules
          </p>
        </div>

        <Link
          href="/admin/upload"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors w-fit"
        >
          <Plus className="w-4 h-4" />
          Upload New Seating PDF
        </Link>
      </div>

      {manifestQuery.isLoading ? (
        <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          Loading schedules...
        </div>
      ) : manifestQuery.data?.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-3">
          <FileUp className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <h3 className="font-semibold text-sm">No Seating Schedules Created</h3>
          <p className="text-xs">
            Click &quot;Upload New Seating PDF&quot; to publish seating arrangements.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Exam Title</th>
                  <th className="p-3.5">Session</th>
                  <th className="p-3.5">Exam Date</th>
                  <th className="p-3.5">Release Time</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {manifestQuery.data?.map((exam) => (
                  <tr key={exam.examId} className="hover:bg-accent/50 transition-colors">
                    <td className="p-3.5 font-bold">{exam.title}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        {exam.session}
                      </span>
                    </td>
                    <td className="p-3.5 text-muted-foreground">{exam.examDate}</td>
                    <td className="p-3.5 font-mono text-muted-foreground">
                      {new Date(exam.publishAt).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleDelete(exam.examId)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                        title="Delete seating file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
