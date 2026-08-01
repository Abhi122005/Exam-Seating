import Link from "next/link";

export default function Home() {
  return (
    <div className="page center">
      <h1>Exam Seating Allocation</h1>
      <div className="button-row">
        <Link className="btn" href="/admin">
          Staff Portal
        </Link>
      </div>
      <p className="hint">
        Students should scan the QR code published by staff — it opens their exam page directly.
      </p>
    </div>
  );
}
