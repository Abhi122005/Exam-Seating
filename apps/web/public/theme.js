// Shared dark mode toggle. Load in <head> to prevent flash.
// Reads localStorage, checks system preference, toggles .dark class.
try {
  var t = localStorage.getItem("theme");
  if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  if (t === "dark") document.documentElement.classList.add("dark");
} catch (e) {}
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("tbtn");
  if (btn)
    btn.onclick = function () {
      var d = document.documentElement.classList.toggle("dark");
      localStorage.setItem("theme", d ? "dark" : "light");
    };
});
