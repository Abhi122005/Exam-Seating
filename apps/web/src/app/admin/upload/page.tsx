"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Calendar, Clock, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function AdminUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("KTU B.Tech Internal Exam");
  const [session, setSession] = useState("Morning");
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [publishAt, setPublishAt] = useState(
    new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16),
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("session", session);
      formData.append("examDate", examDate || "");
      formData.append("publishAt", new Date(publishAt).toISOString());

      // Next.js API route that forwards to Render parser and saves to Vercel Blob
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/admin/schedule");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to publish seating PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg border border-border bg-card hover:bg-accent text-card-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Upload Exam Seating PDF</h1>
          <p className="text-xs text-muted-foreground">
            Upload KTU seating allocation PDF & set automatic release schedule
          </p>
        </div>
      </div>

      <form
        onSubmit={handleUpload}
        className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-5"
      >
        {error && (
          <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            Seating PDF published successfully! Redirecting...
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Select Seating PDF File
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Exam Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. KTU S6 B.Tech Regular Exam"
            className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Session
            </label>
            <select
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="Morning">Morning (FN)</option>
              <option value="Evening">Evening (AN)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Exam Date
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Scheduled Release Time
          </label>
          <input
            type="datetime-local"
            value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
          <p className="text-[11px] text-muted-foreground">
            Students cannot see room numbers before this scheduled release timestamp.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <FileUp className="w-4 h-4" />
          {loading ? "Parsing & Publishing PDF..." : "Publish Seating Release"}
        </button>
      </form>
    </div>
  );
}
