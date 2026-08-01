import { setSessionCookieHeader } from "../../../lib/auth";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body || {};
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  res.setHeader("Set-Cookie", setSessionCookieHeader());
  return res.status(200).json({ ok: true });
}
