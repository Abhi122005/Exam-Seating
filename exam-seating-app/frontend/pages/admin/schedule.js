import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";

export default function AdminSchedule() {
  const [exams, setExams] = useState(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [qrExamId, setQrExamId] = useState(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/exams");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load exams");
      setExams(data.exams);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(exam) {
    setEditingId(exam.examId);
    // datetime-local wants "YYYY-MM-DDTHH:mm"
    setEditValue(new Date(exam.publishAt).toISOString().slice(0, 16));
  }

  async function savePostpone(examId) {
    const res = await fetch(`/api/admin/exams/${examId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishAt: new Date(editValue).toISOString() }),
    });
    if (res.ok) {
      setEditingId(null);
      load();
    }
  }

  async function remove(examId) {
    if (!confirm("Remove this exam and clear its data early?")) return;
    const res = await fetch(`/api/admin/exams/${examId}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Published Exams</h1>
        <Link className="btn-link" href="/admin">
          + Publish new
        </Link>
      </div>

      {error && <p className="error">{error}</p>}
      {!exams && !error && <p className="hint">Loading…</p>}

      {exams && exams.length === 0 && <p className="hint">Nothing published yet.</p>}

      {exams && exams.length > 0 && (
        <div className="card">
          <table className="exams-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Session</th>
                <th>Publish at</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.examId}>
                  <td>{exam.title}</td>
                  <td>{exam.session === "FN" ? "Forenoon" : "Afternoon"}</td>
                  <td>
                    {editingId === exam.examId ? (
                      <input
                        type="datetime-local"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                      />
                    ) : (
                      new Date(exam.publishAt).toLocaleString()
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${exam.status}`}>{exam.status}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {editingId === exam.examId ? (
                        <>
                          <button className="btn-link" onClick={() => savePostpone(exam.examId)}>
                            Save
                          </button>
                          <button className="btn-link" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button className="btn-link" onClick={() => startEdit(exam)}>
                          Postpone
                        </button>
                      )}
                      <button
                        className="btn-link"
                        onClick={() =>
                          setQrExamId(qrExamId === exam.examId ? null : exam.examId)
                        }
                      >
                        QR
                      </button>
                      <button className="btn-link" onClick={() => remove(exam.examId)}>
                        Remove
                      </button>
                    </div>
                    {qrExamId === exam.examId && (
                      <div style={{ marginTop: 10 }}>
                        <QRCodeCanvas value={`${siteUrl}/exam/${exam.examId}`} size={140} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
