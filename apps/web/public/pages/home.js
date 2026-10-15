import { esc } from "/esc.js";
import { statusFor } from "/seating.js";
var list = document.getElementById("list");
var cal =
  '<svg class="ic ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
var clk =
  '<svg class="ic ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
var arw =
  '<svg class="ic earrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
list.innerHTML =
  '<div class="loading"><span class="spinner"></span>Seating schedules streaming in...</div>';
fetch("/api/manifest")
  .then(function (r) {
    return r.json();
  })
  .then(function (data) {
    if (!data.length) {
      list.innerHTML =
        '<div class="card empty"><svg class="ic ic-sm empty-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><h3>No Seating Schedules Released Yet</h3><p>Staff have not published any seating arrangements for today yet.</p></div>';
      return;
    }
    list.innerHTML = '<div class="grid"></div>';
    var g = list.firstChild,
      html = "";
    data.forEach(function (e) {
      var status = statusFor(e),
        label,
        cls;
      if (status === "live") {
        label = "Live Now";
        cls = "b-live";
      } else if (status === "expired") {
        label = "Expired";
        cls = "b-exp";
      } else {
        label = "Scheduled";
        cls = "b-sched";
      }
      html +=
        '<a class="exam-card" href="/exam?id=' +
        encodeURIComponent(e.examId) +
        '"><div><div class="etitle"><span>' +
        esc(e.title) +
        '</span><span class="badge ' +
        cls +
        '">' +
        label +
        '</span></div><div class="emeta"><span>' +
        cal +
        esc(e.examDate) +
        "</span><span>" +
        clk +
        "Session: " +
        esc(e.session) +
        "</span></div></div>" +
        arw +
        "</a>";
    });
    g.innerHTML = html;
  })
  .catch(function () {
    list.innerHTML =
      '<div class="alert a-err">Failed to load schedules. Please refresh the page.</div>';
  });
