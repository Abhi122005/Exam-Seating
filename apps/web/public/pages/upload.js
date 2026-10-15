import { esc } from "/esc.js";
fetch("/api/admin/manifest")
  .then(function (r) {
    if (r.status === 401) location.replace("/admin/login");
  })
  .catch(function () {});
var msg = document.getElementById("msg");
var now = new Date();
document.getElementById("date").value = now.toISOString().split("T")[0];
document.getElementById("publish").value = new Date(now.getTime() + 30 * 60 * 1000)
  .toISOString()
  .slice(0, 16);
document.getElementById("form").onsubmit = function (e) {
  e.preventDefault();
  var file = document.getElementById("file"),
    title = document.getElementById("title"),
    session = document.getElementById("session"),
    date = document.getElementById("date"),
    publish = document.getElementById("publish"),
    btn = document.getElementById("btn"),
    label = document.getElementById("btn-label");
  msg.innerHTML = "";
  if (!file.files[0]) {
    msg.innerHTML =
      '<div class="alert a-err"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg><div>Please select a PDF file</div></div>';
    return;
  }
  btn.disabled = true;
  label.textContent = "Parsing & Publishing PDF...";
  var fd = new FormData();
  fd.append("file", file.files[0]);
  fd.append("title", title.value);
  fd.append("session", session.value);
  fd.append("examDate", date.value);
  fd.append("publishAt", new Date(publish.value).toISOString());
  fetch("/api/admin/publish", { method: "POST", body: fd })
    .then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.error || "Upload failed");
      });
    })
    .then(function () {
      msg.innerHTML =
        '<div class="alert a-ok"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg><div>Seating PDF published successfully! Redirecting...</div></div>';
      setTimeout(function () {
        location.href = "/admin/schedule";
      }, 1500);
    })
    .catch(function (x) {
      msg.innerHTML =
        '<div class="alert a-err"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg><div>' +
        esc(x.message || "Failed to publish seating PDF") +
        "</div></div>";
      btn.disabled = false;
      label.textContent = "Publish Seating Release";
    });
};
