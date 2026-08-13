import React, { useState } from "react";

export default function MinimalDarkView({
  payload,
  rollNumber,
  setRollNumber,
  roomNo,
  lookupError,
  handleLookup,
  formatCountdown,
  now,
}) {
  const [copied, setCopied] = useState(false);
  const publishTime = payload ? new Date(payload.publishAt).getTime() : 0;
  const isScheduled = payload?.status === "scheduled";
  const isExpired = payload?.status === "expired";
  const isLive = payload?.status === "live";

  function copyRoom() {
    if (!roomNo) return;
    navigator.clipboard?.writeText(roomNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="dark-variant-container">
      <div className="dark-glass-card">
        <header className="dark-header">
          <div className="dark-badge-pill">
            <span className="dark-badge-dot" />
            <span>{payload?.session === "FN" ? "FORENOON SESSION" : "AFTERNOON SESSION"} • {payload?.examDate || "2026"}</span>
          </div>
          <h1 className="dark-title">{payload?.title || "Exam Seating Allocation"}</h1>
          <p className="dark-subtitle">
            Enter your student registration roll number to query your designated examination room.
          </p>
        </header>

        {isScheduled && (
          <div className="dark-timer-box">
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              SEATING UNLOCKS IN
            </div>
            <div className="dark-timer-value">{formatCountdown(publishTime - now)}</div>
            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
              Publishing at {payload?.publishAt ? new Date(payload.publishAt).toLocaleTimeString() : "N/A"}
            </div>
          </div>
        )}

        {isExpired && (
          <div className="dark-timer-box" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
            <div style={{ fontSize: "0.8rem", color: "#f87171", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              EXPIRED
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: "700", color: "#94a3b8", margin: "8px 0" }}>
              Exam Session Completed
            </div>
            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
              This seating access token has passed its expiry window.
            </div>
          </div>
        )}

        {isLive && (
          <div>
            <form onSubmit={handleLookup} className="dark-search-form">
              <div className="dark-input-wrapper">
                <input
                  type="text"
                  className="dark-input"
                  placeholder="Enter Roll Number (e.g. CS24C015)"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                />
                <button type="submit" className="dark-submit-btn">
                  Search Seat
                </button>
              </div>
            </form>

            {lookupError && <div className="dark-error-msg">⚠️ {lookupError}</div>}

            {roomNo && (
              <div className="dark-result-card">
                <div className="dark-result-label">YOUR ASSIGNED EXAM ROOM</div>
                <div className="dark-result-room">{roomNo}</div>
                <button type="button" onClick={copyRoom} className="dark-copy-btn">
                  {copied ? "✓ Copied to Clipboard" : "Copy Room Number"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
