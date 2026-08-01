import { requireSession } from "../../../../lib/auth";
import { readManifest } from "../../../../lib/blob";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!requireSession(req, res)) return;

  const manifest = await readManifest();
  const now = Date.now();
  const withStatus = manifest
    .map((e) => ({
      ...e,
      status:
        now < new Date(e.publishAt).getTime()
          ? "scheduled"
          : now <= new Date(e.expiresAt).getTime()
            ? "live"
            : "expired",
    }))
    .sort((a, b) => new Date(b.publishAt) - new Date(a.publishAt));

  return res.status(200).json({ exams: withStatus });
}
