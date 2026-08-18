"use client";

import { useMemo, useState } from "react";
import { Search, MapPin, AlertCircle, Clock, BookOpen } from "lucide-react";
import type { ParsedRoom } from "~/lib/blob";
import { buildRollLookup } from "~/lib/seating-format";

interface StudentSearchProps {
  examId: string;
  title: string;
  session: string;
  status: "live" | "scheduled" | "expired" | "not_found";
  publishAt?: string;
  rooms?: ParsedRoom[];
}

export function StudentSearch({ title, session, status, publishAt, rooms = [] }: StudentSearchProps) {
  const [rollNo, setRollNo] = useState("");
  const [result, setResult] = useState<{
    found: boolean;
    room_no?: string;
    label?: string;
    roll_from?: string;
    roll_to?: string;
  } | null>(null);

  const rollLookup = useMemo(() => buildRollLookup(rooms), [rooms]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNo.trim() || status !== "live") return;

    const query = rollNo.trim().toUpperCase();

    const hit = rollLookup.get(query);
    if (hit) {
      setResult({
        found: true,
        room_no: hit.roomNo,
        label: hit.label,
      });
      return;
    }

    for (const room of rooms) {
      for (const range of room.ranges) {
        const from = range.roll_from.toUpperCase();
        const to = range.roll_to.toUpperCase();

        if (query >= from && query <= to) {
          setResult({
            found: true,
            room_no: room.room_no,
            label: range.label || "General Batch",
            roll_from: range.roll_from,
            roll_to: range.roll_to,
          });
          return;
        }
      }
    }

    setResult({ found: false });
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
          Session: {session}
        </div>
      </div>

      {status === "scheduled" && (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-sm">Seating Not Released Yet</h3>
            <p className="text-xs mt-1 opacity-90">
              Seating allocation for this slot will be released at{" "}
              <span className="font-bold">{publishAt ? new Date(publishAt).toLocaleString() : "scheduled time"}</span>.
            </p>
          </div>
        </div>
      )}

      {status === "expired" && (
        <div className="p-4 rounded-xl border border-muted bg-muted/50 text-muted-foreground flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-sm">Seating Link Expired</h3>
            <p className="text-xs mt-1">
              This seating arrangement release window has closed and data has been safely cleared.
            </p>
          </div>
        </div>
      )}

      {status === "live" && (
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={rollNo}
              onChange={(e) => {
                setRollNo(e.target.value);
                setResult(null);
              }}
              placeholder="Enter Roll / Reg No (e.g. CS24C08)"
              className="w-full px-4 py-3 text-base rounded-xl border border-border bg-card text-card-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary uppercase tracking-wider"
              required
            />
            <button
              type="submit"
              disabled={!rollNo.trim()}
              className="absolute right-2 top-2 bottom-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <Search className="w-4 h-4" />
              Find Seat
            </button>
          </div>

          {result && (
            <div className="mt-6">
              {result.found ? (
                <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 text-card-foreground shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                      Seat Allocated
                    </span>
                    <MapPin className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="text-center py-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Room Number
                    </div>
                    <div className="text-5xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
                      {result.room_no}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-emerald-500/20 text-xs text-muted-foreground flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                      {result.label}
                    </span>
                    {result.roll_from && result.roll_to && (
                      <span className="font-mono">
                        Range: {result.roll_from} - {result.roll_to}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-900 dark:text-rose-200 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  <div className="text-sm">
                    No seat matching <span className="font-bold">{rollNo.toUpperCase()}</span> found in this session.
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
