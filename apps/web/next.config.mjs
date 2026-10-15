/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Vary", value: "Accept-Encoding" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // No 'unsafe-inline': all page JS/CSS is external (/theme-init.js,
      // /theme.js, /pages/*.js, /site.css, /pages/*.css). No 'unsafe-eval'.
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

// HSTS only in production (won't break localhost)
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  });
}

const nextConfig = {
  compress: true,
  poweredByHeader: false,
  headers: () =>
    securityHeaders.map((h) => ({
      source: "/(.*)",
      headers: [h],
    })),
};

export default nextConfig;
