import { esc } from "/esc.js";
fetch("/api/admin/manifest")
  .then(function (r) {
    if (r.ok) location.replace("/admin/schedule");
  })
  .catch(function () {});
document.getElementById("form").onsubmit = function (e) {
  e.preventDefault();
  var pw = document.getElementById("pw"),
    btn = document.getElementById("btn"),
    err = document.getElementById("err");
  btn.disabled = true;
  btn.textContent = "Authenticating...";
  err.innerHTML = "";
  fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: pw.value }),
  })
    .then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.message || "Invalid password");
      });
    })
    .then(function () {
      location.href = "/admin/schedule";
    })
    .catch(function (x) {
      err.innerHTML =
        '<div class="alert a-err"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg><div>' +
        esc(x.message || "An error occurred") +
        "</div></div>";
      btn.disabled = false;
      btn.textContent = "Login to Staff Dashboard";
    });
};
