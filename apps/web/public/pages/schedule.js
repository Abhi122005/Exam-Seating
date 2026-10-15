import { esc, escAttr } from "/esc.js";
var rows = document.getElementById("rows"),
  err = document.getElementById("err");
var trash =
  '<svg class="ic ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';
var up =
  '<svg class="ic ic-lg empty-ic-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg>';
load();
function load() {
  rows.innerHTML = '<div class="loading"><span class="spinner"></span>Loading schedules...</div>';
  fetch("/api/admin/manifest")
    .then(function (r) {
      if (r.status === 401) {
        location.replace("/admin/login");
        throw new Error("redirect");
      }
      if (!r.ok) throw new Error("load");
      return r.json();
    })
    .then(function (m) {
      err.innerHTML = "";
      if (!m.length) {
        rows.innerHTML =
          '<div class="empty">' +
          up +
          "<h3>No Seating Schedules Created</h3><p>Click &quot;Upload New Seating PDF&quot; to publish seating arrangements.</p></div>";
        return;
      }
      rows.innerHTML =
        '<div class="tw ovh"><table><thead><tr><th>Exam Title</th><th>Session</th><th>Exam Date</th><th>Release Time</th><th class="right">Actions</th></tr></thead><tbody>' +
        m
          .map(function (e) {
            return (
              '<tr><td class="bold">' +
              esc(e.title) +
              '</td><td><span class="badge b-sched">' +
              esc(e.session) +
              '</span></td><td class="muted">' +
              esc(e.examDate) +
              '</td><td class="muted mono">' +
              esc(new Date(e.publishAt).toLocaleString()) +
              '</td><td class="right"><button class="danger" data-id="' +
              escAttr(e.examId) +
              '" title="Delete seating file">' +
              trash +
              "</button></td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>";
    })
    .catch(function (x) {
      if (x.message === "redirect") return;
      err.innerHTML =
        '<div class="alert a-err"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg><div>Failed to load schedules</div></div>';
      rows.innerHTML = "";
    });
}
rows.addEventListener("click", function (ev) {
  var b = ev.target.closest(".danger");
  if (!b) return;
  var id;
  try {
    id = decodeURIComponent(b.dataset.id);
  } catch (e) {
    id = b.dataset.id;
  }
  if (!confirm("Are you sure you want to delete exam " + id + "?")) return;
  b.disabled = true;
  fetch("/api/admin/exams/" + encodeURIComponent(id) + "/delete", { method: "POST" })
    .then(function (r) {
      if (!r.ok) throw new Error("delete");
      load();
    })
    .catch(function () {
      err.innerHTML =
        '<div class="alert a-err"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg><div>Delete failed</div></div>';
      b.disabled = false;
    });
});
