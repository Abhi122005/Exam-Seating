import { esc } from "/esc.js";
var id = new URLSearchParams(location.search).get("id"),
  content = document.getElementById("content");
var ic = function (p) {
  return (
    '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    p +
    "</svg>"
  );
};
var I = {
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  alert:
    '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
};
if (!id) {
  content.innerHTML =
    '<div class="alert a-err">' +
    ic(I.alert) +
    "<div>Missing exam id in the link. Please use the link provided by your exam cell.</div></div>";
} else {
  content.innerHTML =
    '<div class="loading"><span class="spinner"></span>Loading exam info...</div>';
  pollStatus();
}
function pollStatus() {
  fetch("/api/exam-meta/" + encodeURIComponent(id))
    .then(function (r) {
      return r.json().then(function (d) {
        return { ok: r.ok, d: d };
      });
    })
    .then(function (x) {
      if (!x.ok || x.d.error) {
        content.innerHTML =
          '<div class="alert a-err">' +
          ic(I.alert) +
          "<div>Exam not found. It may have been removed or the link is incorrect.</div></div>";
        return;
      }
      var d = x.d;
      document.title = (d.title || "Exam Seating") + " | CEC Exam Seating";
      document.getElementById("title").textContent = d.title || "Exam Seating";
      document.getElementById("session").textContent = "Session: " + (d.session || "Morning");
      if (d.status === "scheduled") {
        content.innerHTML =
          '<div class="alert a-warn">' +
          ic(I.clock) +
          "<div><h3>Seating Not Released Yet</h3>Seating allocation for this slot will be released at <b>" +
          esc(new Date(d.publishAt).toLocaleString()) +
          '</b>.<br><span class="muted">This page updates automatically when the release goes live.</span></div></div>';
        setTimeout(pollStatus, 10000);
      } else if (d.status === "expired") {
        content.innerHTML =
          '<div class="alert a-mut">' +
          ic(I.alert) +
          "<div><h3>Seating Link Expired</h3>This seating arrangement release window has closed and data has been safely cleared.</div></div>";
      } else {
        showSearch();
      }
    })
    .catch(function () {
      content.innerHTML =
        '<div class="loading"><span class="spinner"></span>Retrying connection...</div>';
      setTimeout(pollStatus, 30000);
    });
}
function showSearch() {
  content.innerHTML =
    '<form id="form" class="sbox"><label for="roll" class="sr-only">Roll / Register Number</label><input id="roll" class="sinp" type="text" placeholder="Enter Roll / Reg No (e.g. CS24C08)" required maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false"><button id="find" class="find" type="submit" disabled>' +
    ic(I.search) +
    'Find Seat</button></form><div id="result" aria-live="polite" class="mt2"></div>';
  var inp = document.getElementById("roll"),
    find = document.getElementById("find");
  inp.oninput = function () {
    find.disabled = !inp.value.trim();
    document.getElementById("result").innerHTML = "";
  };
  document.getElementById("form").onsubmit = search;
}
function search(e) {
  e.preventDefault();
  var q = document.getElementById("roll").value.trim().toUpperCase(),
    r = document.getElementById("result");
  if (!q) return;
  r.innerHTML = '<div class="loading"><span class="spinner"></span>Finding your seat...</div>';
  fetch("/api/seating/" + encodeURIComponent(id) + "?roll=" + encodeURIComponent(q))
    .then(function (res) {
      return res.json().then(function (d) {
        return { ok: res.ok, d: d };
      });
    })
    .then(function (x) {
      if (!x.ok || x.d.error) {
        r.innerHTML =
          '<div class="alert a-err">' +
          ic(I.alert) +
          "<div>" +
          esc((x.d && x.d.error) || "Lookup failed") +
          "</div></div>";
        return;
      }
      if (x.d.status !== "live") {
        r.innerHTML =
          '<div class="alert a-warn">' +
          ic(I.clock) +
          "<div>Seating is not currently available for this exam.</div></div>";
        return;
      }
      var out = x.d.seat;
      if (out) {
        r.innerHTML =
          '<div class="result"><div class="rhead"><span>Seat Allocated</span>' +
          ic(I.pin) +
          '</div><div class="center"><div class="muted rlabel">Room Number</div><div class="room">' +
          esc(out.room_no) +
          '</div></div><div class="rfoot"><span>' +
          ic(I.book) +
          " " +
          esc(out.label) +
          "</span>" +
          (out.roll_from && out.roll_to
            ? '<span class="mono">Range: ' +
              esc(out.roll_from) +
              " - " +
              esc(out.roll_to) +
              "</span>"
            : "") +
          "</div></div>";
      } else {
        r.innerHTML =
          '<div class="alert a-err">' +
          ic(I.alert) +
          "<div>No seat matching <b>" +
          esc(q) +
          "</b> found in this session.</div></div>";
      }
    })
    .catch(function () {
      r.innerHTML =
        '<div class="alert a-err">' +
        ic(I.alert) +
        "<div>Connection failed. Please try again.</div></div>";
    });
}
