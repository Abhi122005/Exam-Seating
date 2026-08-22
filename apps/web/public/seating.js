/**
 * @param {unknown} s
 * @returns {string}
 */
export const esc = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/**
 * @param {{ rooms?: { room_no: string; ranges?: { roll_from: string; roll_to: string; label?: string | null; count?: number | null }[]; rolls?: Record<string, string> }[] }} payload
 * @param {string} roll
 * @returns {{ room_no: string; label: string; roll_from?: string; roll_to?: string } | undefined}
 */
export function findSeat(payload, roll) {
  const q = String(roll || "")
    .trim()
    .toUpperCase();
  if (!q) return undefined;
  const rooms = payload.rooms || [];
  for (const room of rooms) {
    for (const [label, list] of Object.entries(room.rolls || {})) {
      if (list.toUpperCase().split(",").includes(q)) {
        return { room_no: room.room_no, label: label || "General Batch" };
      }
    }
  }
  for (const room of rooms) {
    for (const rg of room.ranges || []) {
      const f = String(rg.roll_from).toUpperCase();
      const t = String(rg.roll_to).toUpperCase();
      if (q >= f && q <= t) {
        return {
          room_no: room.room_no,
          label: rg.label || "General Batch",
          roll_from: rg.roll_from,
          roll_to: rg.roll_to,
        };
      }
    }
  }
  return undefined;
}

/**
 * @param {{ publishAt: string; expiresAt: string }} entry
 * @param {number} [now]
 * @returns {"scheduled" | "live" | "expired"}
 */
export function statusFor(entry, now = Date.now()) {
  const publishAt = new Date(entry.publishAt).getTime();
  const expiresAt = new Date(entry.expiresAt).getTime();
  if (now < publishAt) return "scheduled";
  return now > expiresAt ? "expired" : "live";
}

/**
 * @typedef {"scheduled" | "live" | "expired"} ExamStatus
 * @typedef {"notfound" | "retry"} SeatingError
 * @param {Object} options
 * @param {string} options.examId
 * @param {(input: string) => Promise<any>} [options.fetch]
 * @param {(payload: any) => void} [options.onPayload]
 * @param {(ExamStatus) => void} [options.onStatus]
 * @param {(SeatingError) => void} [options.onError]
 * @returns {{ stop: () => void }}
 */
export function runSeatingApp({
  examId,
  fetch: fetchFn = globalThis.fetch,
  onStatus,
  onPayload,
  onError,
}) {
  let timer = null;
  let stopped = false;
  let lastPayload = null;
  let lastRooms = undefined;
  let lastStatus = null;

  const emit = (d) => {
    if (lastPayload === null || d.rooms !== lastRooms) {
      lastPayload = d;
      lastRooms = d.rooms;
      if (onPayload) onPayload(d);
    }
    if (d.status !== lastStatus) {
      lastStatus = d.status;
      if (onStatus) onStatus(d.status);
    }
  };

  const load = () => {
    if (stopped) return;
    fetchFn("/api/seating/" + encodeURIComponent(examId))
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then((x) => {
        if (stopped) return;
        if (!x.ok || x.d.error) {
          if (onError) onError("notfound");
          return;
        }
        emit(x.d);
        if (x.d.status === "scheduled") timer = setTimeout(load, 10000);
      })
      .catch(() => {
        if (stopped) return;
        if (onError) onError("retry");
        timer = setTimeout(load, 30000);
      });
  };

  load();

  return {
    stop() {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
