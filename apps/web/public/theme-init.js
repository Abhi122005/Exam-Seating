try {
  var t = localStorage.getItem("theme");
  if (!t) t = matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light";
  if (t === "dark") document.documentElement.classList.add("dark");
} catch (e) {}
