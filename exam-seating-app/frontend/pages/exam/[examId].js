import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import MinimalDarkView from "../../components/templates/MinimalDarkView";

function formatCountdown(ms) {
  if (ms <= 0) return "0h 0m 0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

function findRoom(rooms, roll) {
  if (!rooms) return null;
  for (const room of rooms) {
    for (const range of room.ranges) {
      if (
        roll.length === range.roll_from.length &&
        roll.length === range.roll_to.length &&
        roll >= range.roll_from &&
        roll <= range.roll_to
      ) {
        return room.room_no;
      }
    }
  }
  return null;
}

export default function ExamPage() {
  const router = useRouter();
  const { examId } = router.query;

  const [payload, setPayload] = useState(null);
  const [fetchError, setFetchError] = useState("");
  const [now, setNow] = useState(Date.now());

  const [rollNumber, setRollNumber] = useState("");
  const [roomNo, setRoomNo] = useState(null);
  const [lookupError, setLookupError] = useState("");

  async function loadStatus() {
    if (!examId) return;
    try {
      const res = await fetch(`/api/seating/${examId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error || "Exam not found.");
        return;
      }
      setPayload(data);
    } catch {
      setFetchError("Something went wrong loading seating info. Please try again.");
    }
  }

  useEffect(() => {
    if (!examId) return;
    loadStatus();
    const poll = setInterval(loadStatus, 15000);
    return () => clearInterval(poll);
  }, [examId]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  function handleLookup(e) {
    if (e) e.preventDefault();
    setLookupError("");
    setRoomNo(null);
    const cleaned = rollNumber.trim().toUpperCase();
    if (!cleaned) return;

    const found = findRoom(payload?.rooms, cleaned);
    if (!found) {
      setLookupError("Roll number not found. Double-check and try again.");
      return;
    }
    setRoomNo(found);
  }

  if (fetchError) {
    return (
      <div className="dark-variant-container">
        <div className="dark-glass-card" style={{ textAlign: "center" }}>
          <div className="dark-badge-pill" style={{ borderColor: "rgba(239,68,68,0.4)", color: "#f87171", background: "rgba(239,68,68,0.1)" }}>
            ⚠️ ACCESS NOTICE
          </div>
          <h1 className="dark-title" style={{ marginTop: "12px" }}>Exam Seating Portal</h1>
          <div className="dark-error-msg" style={{ marginTop: "20px", fontSize: "1rem" }}>
            {fetchError}
          </div>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="dark-variant-container">
        <div className="dark-glass-card" style={{ textAlign: "center", padding: "60px 40px" }}>
          <div className="dark-badge-pill">
            <span className="dark-badge-dot" style={{ animation: "pulse 1.5s infinite" }} />
            <span>CONNECTING TO PORTAL...</span>
          </div>
          <h2 style={{ color: "#94a3b8", fontWeight: "500", marginTop: "16px" }}>Loading seating data...</h2>
        </div>
      </div>
    );
  }

  return (
    <MinimalDarkView
      payload={payload}
      rollNumber={rollNumber}
      setRollNumber={setRollNumber}
      roomNo={roomNo}
      lookupError={lookupError}
      handleLookup={handleLookup}
      formatCountdown={formatCountdown}
      now={now}
    />
  );
}
