import { useEffect, useState } from "react";
import { useRouter } from "next/router";

function formatCountdown(ms) {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

function findRoom(rooms, roll) {
  for (const room of rooms) {
    for (const range of room.ranges) {
      // Plain string comparison (roll_from <= roll <= roll_to) only gives
      // the correct order when every roll number being compared has the
      // same length -- e.g. "CS24C100" sorts BEFORE "CS24C25" as a string
      // (since '1' < '2'), even though 100 > 25 numerically. A
      // legitimately-formatted roll number for a given range always has
      // the same length as that range's bounds, so requiring an exact
      // length match before comparing rejects malformed/mistyped input
      // like "CS24C100" instead of silently matching it to the wrong room.
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
    try {
      const res = await fetch(`/api/seating/${examId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error || "Exam not found.");
        return;
      }
      setPayload(data);
    } catch {
      setFetchError("Something went wrong. Please try again.");
    }
  }

  useEffect(() => {
    if (!examId) return;
    loadStatus();
    // Re-check periodically so the countdown screen flips over to the
    // search screen on its own once the release time passes, without a
    // manual refresh.
    const poll = setInterval(loadStatus, 15000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  function handleLookup(e) {
    e.preventDefault();
    setLookupError("");
    setRoomNo(null);
    const cleaned = rollNumber.trim().toUpperCase();
    if (!cleaned) return;

    const found = findRoom(payload.rooms, cleaned);
    if (!found) {
      setLookupError("Roll number not found. Double-check it and try again.");
      return;
    }
    setRoomNo(found);
  }

  if (fetchError) {
    return (
      <div className="page center">
        <h1>Exam Seating</h1>
        <p className="error">{fetchError}</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="page center">
        <p>Loading...</p>
      </div>
    );
  }

  const publishTime = new Date(payload.publishAt).getTime();

  return (
    <div className="page center">
      <h1>{payload.title}</h1>
      <p className="hint">
        {payload.session === "FN" ? "Forenoon" : "Afternoon"} · {payload.examDate}
      </p>

      {payload.status === "scheduled" && (
        <div className="card center">
          <h2>Not available yet</h2>
          <p>Seating info will unlock at:</p>
          <p className="big">{new Date(payload.publishAt).toLocaleString()}</p>
          <p>Opens in: {formatCountdown(publishTime - now)}</p>
        </div>
      )}

      {payload.status === "expired" && (
        <div className="card center">
          <h2>No longer available</h2>
          <p className="hint">This seating info has expired.</p>
        </div>
      )}

      {payload.status === "live" && (
        <div className="card">
          <h2>Find your room</h2>
          <form onSubmit={handleLookup} className="row">
            <input
              type="text"
              placeholder="Enter your roll number"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
            />
            <button type="submit" className="btn primary">
              Search
            </button>
          </form>

          {lookupError && <p className="error">{lookupError}</p>}

          {roomNo && (
            <div className="result center">
              <p className="hint">Your room is</p>
              <p className="big">{roomNo}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
