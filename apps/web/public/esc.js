/**
 * Escape HTML special characters to prevent XSS.
 * @param {unknown} s
 * @returns {string}
 */
export const esc = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/**
 * Attribute-safe encoding for values interpolated into HTML attributes
 * (e.g. data-id="..."). encodeURIComponent leaves `'` unescaped, so pair it
 * with esc() — or better, avoid interpolation entirely via dataset/textContent.
 * @param {unknown} s
 * @returns {string}
 */
export const escAttr = (s) => esc(encodeURIComponent(String(s ?? "")));
