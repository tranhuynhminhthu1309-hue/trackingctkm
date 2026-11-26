/* ===== M5 · Tải file dùng chung =====
 * BC 5.1: dùng cho CTKM Basic, On top, Cận date -> chọn ở "Quản lý dữ liệu" (#f51) hoặc ở khung "Tính từ BC 5.1" (#kcf) đều được, chỉ cần một lần.
 * BC 5.4: dùng cho CTTL (#f54) và trưng bày Shop sữa (#m3f54) -> chọn ở một nơi, nơi kia tự có.
 * Bấm "Kiểm tra file" ở Quản lý dữ liệu cũng tính CTKM Basic / Cận date; bấm "Lưu lên Google Sheet" cũng lưu kết quả đó.
 * Không đọc/ghi dữ liệu của các module cũ; chỉ chuyển cùng một File sang các ô chọn file còn lại. Tải sau m5-nav.js. */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  var $ = function (id) { return document.getElementById(id); };
  var GROUPS = { "51": ["f51", "kcf"], "54": ["f54", "m3f54"] };
  var st = document.createElement("div"); st.id = "m5share"; st.className = "sub"; st.hidden = true;
  var anchor = $("m5dnote") || $("upc"); if (anchor) anchor.insertAdjacentElement($("m5dnote") ? "afterend" : "beforebegin", st);
  function say(t, bad) { st.hidden = !t; st.textContent = t || ""; st.style.color = bad ? "var(--r)" : ""; }
  function setFile(d, f) { try { var dt = new DataTransfer(); dt.items.add(f); d.files = dt.files; d.__m5 = 1; d.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {} finally { d.__m5 = 0; } }
  document.addEventListener("change", function (e) {
    var t = e.target; if (!t || t.type !== "file" || t.__m5 || !t.files || !t.files[0]) return; var f = t.files[0];
    Object.keys(GROUPS).forEach(function (k) {
      if (GROUPS[k].indexOf(t.id) < 0) return;
      GROUPS[k].forEach(function (id) { if (id === t.id || id === "kcf") return; var d = $(id); if (d) setFile(d, f); });
      if (k === "51" && t.id !== "kcf" && window.M4KM && window.M4KM.shared) window.M4KM.shared.setFile(f);
    });
  }, true);
  var go = $("go"), sv = $("save");
  if (go) go.addEventListener("click", function () {
    var K = window.M4KM && window.M4KM.shared; if (!K || !K.hasFile()) return;
    say("Đang tính CTKM Basic / Cận date từ cùng file BC 5.1...");
    K.calc().then(function (r) { say((r.ok ? "✓ " : "✗ ") + r.msg + (r.ok ? " Sẽ được lưu cùng khi bấm Lưu lên Google Sheet." : ""), !r.ok); });
  });
  if (sv) sv.addEventListener("click", function () {
    var K = window.M4KM && window.M4KM.shared; if (!K || !K.hasCalc()) return;
    say("Đang lưu CTKM Basic / Cận date...");
    K.save().then(function (r) { say((r.ok ? "✓ " : "✗ ") + r.msg, !r.ok); });
  });
})();
