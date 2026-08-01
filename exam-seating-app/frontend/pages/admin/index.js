import { useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminUpload() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [session, setSession] = useState("FN");
  const [examDate, setExamDate] = useState("");
  const [publishAt, setPublishAt] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const ampmHint = session === "FN" ? "AM (Forenoon)" : "PM (Afternoon)";

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
    if (f && !title) {
      setTitle(f.name.replace(/\.pdf$/i, ""));
    }
  }

  async function handlePublish(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!file) {
      setError("Choose a seating PDF to upload.");
      return;
    }
    if (!title || !examDate || !publishAt) {
      setError("Fill in title, exam date, and publish date/time.");
      return;
    }

    setLoading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64,
          fileName: file.name,
          title,
          session,
          examDate,
          publishAt: new Date(publishAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Publish Seating Allocation</h1>
        <Link className="btn-link" href="/admin/schedule">
          View published exams →
        </Link>
      </div>

      <form onSubmit={handlePublish} className="card">
        <label>
          Seating PDF
          <input type="file" accept="application/pdf" onChange={handleFileChange} />
        </label>
        <p className="hint">
          Supports the "Hall Allocation Summary" layout and the older "Subject: CODE" table
          layout. The PDF is parsed automatically — no manual roll-number entry.
        </p>

        <label>
          Exam title
          <input
            type="text"
            placeholder="First Internal Examination - MARCH 2026 (S2, Afternoon)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="row">
          <label>
            Session
            <select value={session} onChange={(e) => setSession(e.target.value)}>
              <option value="FN">Forenoon</option>
              <option value="AN">Afternoon</option>
            </select>
          </label>

          <label>
            Exam date
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </label>
        </div>

        <label>
          Publish date &amp; time (when the QR unlocks) — {ampmHint}
          <input
            type="datetime-local"
            value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)}
          />
        </label>
        <p className="hint">Seating info automatically stops showing 5 hours after this time.</p>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? "Publishing..." : "Publish & Generate QR"}
        </button>
      </form>

      {result && (
        <div className="card center">
          <h2>Published!</h2>
          {result.warning && <p className="error">{result.warning}</p>}
          <p>Seating info unlocks at: {new Date(result.publishAt).toLocaleString()}</p>
          <QRCodeCanvas value={result.studentUrl} size={220} includeMargin />
          <p className="hint">{result.studentUrl}</p>
        </div>
      )}
    </div>
  );
}
