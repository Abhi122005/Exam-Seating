import Link from "next/link";

export default function Home() {
  return (
    <div className="page center">
      <h1>Exam Seating Allocation Portal</h1>
      <p style={{ color: "#d4d4d8", margin: "12px 0 24px" }}>
        Instant, real-time exam hall seating lookup for students and staff.
      </p>

      <div className="button-row">
        <Link className="btn primary" href="/admin" style={{ padding: "10px 20px" }}>
          Staff Portal
        </Link>
      </div>

      <p className="hint" style={{ marginTop: "32px" }}>
        Students scan the QR code published by staff — it opens their exam seating page directly.
      </p>
    </div>
  );
}
