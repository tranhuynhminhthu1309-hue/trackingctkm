/* ===== M5 · Menu chính 2 cấp (thiết kế lại giao diện) =====
 * Chỉ điều hướng: dùng lại các màn hình đã có bằng cách bấm đúng các nút/bộ lọc cũ (#mnav, #tabs, #chips, #m3fp).
 * Không sửa dữ liệu, công thức hay code của module cũ. Tải sau m4.js:
 *   <script src="m4-lib.js"></script><script src="m4.js"></script><script src="m5-nav.js"></script> */
(function () {
  "use strict";
  if (typeof document === "undefined" || !document.querySelector("#mnav")) return;
  var q = function (s, r) { return (r || document).querySelector(s); }, qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var E = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var legacy = q("#mnav");

  /* Cây menu. kind: old = màn hình số suất cũ; m3 = Tính suất CTTB; m4 = module M4; ph = trang tạm (chưa làm); data = quản lý dữ liệu */
  var MENU = [
    { k: "dash", t: "Dashboard tổng quan", kind: "ph" },
    { k: "tb", t: "Thông báo CTKM", kind: "m4", v: "m4tb" },
    { k: "gia", t: "Bảng giá NPP", kind: "m4", v: "m4gia" },
    { k: "ctkm", t: "CTKM", sub: [
      { k: "basic", t: "CTKM Basic", kind: "ph" },
      { k: "ontop", t: "CTKM On top", kind: "old", tab: "CTKM" },
      { k: "candate", t: "CTKM Cận date", kind: "ph" }] },
    { k: "cttl", t: "CTTL", sub: [
      { k: "si", t: "Shop sỉ", kind: "old", tab: "CTTL", chip: "si" },
      { k: "sua", t: "Shop sữa", kind: "old", tab: "CTTL", chip: "sua" }] },
    { k: "cttb", t: "CTTB", sub: [
      { k: "fz", t: "Frozen", kind: "m3", prog: "fz" },
      { k: "ww", t: "Tủ đông Want Want", kind: "m3", prog: "ww" },
      { k: "sua", t: "Sữa", kind: "m3", prog: "sua" },
      { k: "shop", t: "Shop sữa", kind: "m3", prog: "shop" }] },
    { k: "data", t: "Quản lý dữ liệu", kind: "data" },
    { k: "cfg", t: "Cấu hình / Mapping", kind: "m4", v: "m4cfg" }
  ];
  var PH = {
    dash: { t: "Dashboard tổng quan ngân sách", p: "Phase 4", d: "Tổng hợp ngân sách 6 nhóm (KM bằng hàng, KM chiết khấu, Clear date, Shop sỉ, Shop sữa, Trưng bày) theo tháng: ngân sách được duyệt, thực chi, chênh lệch, cảnh báo và xem chi tiết từng dòng." },
    basic: { t: "CTKM Basic", p: "Phase 2", d: "Số suất và giá trị hàng KM của 8 chương trình Basic, tính theo từng đơn hàng: FLOOR(SL mua đủ điều kiện ÷ SL yêu cầu) × SL tặng, đếm số đơn khác nhau, đơn trả hàng trừ vào đơn gốc, giá theo ngày đặt hàng." },
    candate: { t: "CTKM Cận date", p: "Phase 2", d: "Cận date HTS (2 tặng 1 lốc, 1 lốc = 4 hộp) và Thạch Jelly (2 tặng 1 túi), tính theo từng đơn như Basic. Mã chưa phát sinh đơn hàng hiển thị bằng 0." }
  };
  var CUR = null, SUB = {}; // SUB: nhóm -> mục con đang chọn

  /* ---------- CSS ---------- */
  var css = document.createElement("style");
  css.textContent = "#mnav{display:none!important}#m5{margin:0 0 14px}#m5 .seg{max-width:100%}#m5 .m5s{margin-top:8px}#m5 .m5s button{font-size:13px;padding:5px 11px}#m5 button[aria-current=page]{background:var(--acc);color:var(--card);font-weight:500}" +
    "body.m5v #upc,body.m5v #intro,body.m5v #tabs{display:none!important}body.m5data #out{display:none!important}#m5ph .card,#m5ph{max-width:880px}#m5ph .tag{display:inline-block;padding:1px 8px;border-radius:99px;font-size:11.5px;background:var(--yb);color:var(--y);margin-left:8px;font-weight:500}" +
    "#m5ph .go{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:12px}#m5ph .go button{text-align:left;padding:10px 12px;border-radius:10px}#m5ph .go b{display:block}#m5ph .go span{display:block;color:var(--mute);font-size:12.5px;margin-top:2px;white-space:normal}" +
    "@media(max-width:640px){#m5 .seg button{padding:6px 9px;font-size:13px}}";
  document.head.appendChild(css);

  /* ---------- Khung ---------- */
  var nav = document.createElement("nav"); nav.id = "m5"; nav.setAttribute("aria-label", "Menu chính");
  legacy.insertAdjacentElement("beforebegin", nav);
  var ph = document.createElement("section"); ph.id = "m5ph"; ph.hidden = true;
  (q("#m3") || q("main")).insertAdjacentElement("beforebegin", ph);
  var note = document.createElement("div"); note.id = "m5dnote"; note.className = "sub"; note.hidden = true;
  note.innerHTML = "Tải và kiểm tra file dữ liệu hằng tháng (BC 5.1, 5.8, 5.4, định biên, file CTKM) tại đây. File của CTTB (BC 7.2, doanh số, tủ đông Want Want) tải trong mục <b>CTTB</b>. Bảng giá NPP và cơ chế KM nhập ở mục riêng của chúng.";
  var upc = q("#upc"); if (upc) upc.insertAdjacentElement("beforebegin", note);

  function canData() { return !upc || !upc.hidden; } // tài khoản chỉ xem không có mục Quản lý dữ liệu
  function visible() { return MENU.filter(function (m) { return m.kind !== "data" || canData(); }); }
  function find(k, s) { var m = MENU.filter(function (x) { return x.k === k; })[0]; if (!m) return null; if (!s) return m; return (m.sub || []).filter(function (x) { return x.k === s; })[0] || null; }

  function draw() {
    var cm = CUR ? CUR.k : "", h = '<div class="seg" role="tablist">' + visible().map(function (m) {
      return '<button data-k="' + m.k + '"' + (m.k === cm ? ' aria-current="page"' : "") + ">" + E(m.t) + (m.sub ? " ▾" : "") + "</button>"; }).join("") + "</div>";
    var cur = cm ? find(cm) : null;
    if (cur && cur.sub) h += '<div class="seg m5s" role="tablist" aria-label="' + E(cur.t) + '">' + cur.sub.map(function (s) {
      return '<button data-k="' + cur.k + '" data-s="' + s.k + '"' + (CUR.s === s.k ? ' aria-current="page"' : "") + ">" + E(s.t) + "</button>"; }).join("") + "</div>";
    nav.innerHTML = h;
  }

  /* ---------- Điều hướng ---------- */
  function legacyClick(v) { var b = q('#mnav [data-v="' + v + '"]'); if (b) b.click(); }
  function body(c) { ["m5v", "m5data"].forEach(function (x) { document.body.classList.toggle(x, x === c); }); }
  function phPage(key) {
    var p = PH[key]; ph.hidden = false;
    var links = [["tb", "Thông báo CTKM", "Tra cứu thông báo theo tháng, mở PDF trên Drive"], ["gia", "Bảng giá NPP", "Import và theo dõi các phiên bản bảng giá"], ["ctkm|ontop", "CTKM On top", "Số suất Frozen 78ml, STC, Opao, ADCA, Yogurt so với định biên"], ["cttl|si", "CTTL", "Shop sỉ và Shop sữa"], ["cttb|fz", "CTTB", "Frozen, tủ đông Want Want, Sữa, Shop sữa"], ["data", "Quản lý dữ liệu", "Tải file dữ liệu hằng tháng"], ["cfg", "Cấu hình / Mapping", "Cơ chế KM, mapping SKU, kiểm tra cấu hình"]].filter(function (x) { return x[0] !== "data" || canData(); });
    ph.innerHTML = '<div class="card"><h2 style="margin-top:0">' + (p ? E(p.t) + '<span class="tag">Sẽ có ở ' + p.p + "</span>" : "") + "</h2><p class=\"sub\" style=\"margin:0\">" + E(p ? p.d : "") + "</p>" +
      (key === "dash" ? '<p class="sub">Trong lúc chờ, mở nhanh các màn hình đã có:</p><div class="go">' + links.map(function (x) { return '<button data-go="' + x[0] + '"><b>' + E(x[1]) + "</b><span>" + E(x[2]) + "</span></button>"; }).join("") + "</div>" : "") + "</div>";
  }
  function go(k, s, quiet) {
    var m = find(k); if (!m) { k = "dash"; m = find(k); }
    if (m.sub && !s) s = SUB[k] || m.sub[0].k;
    var it = s ? find(k, s) : m; if (!it) return;
    if (m.sub) SUB[k] = s;
    if (it.kind === "data" && !canData()) { k = "dash"; s = ""; m = find(k); it = m; }
    CUR = { k: k, s: s || "" };
    ph.hidden = true; note.hidden = true; body("");
    legacyClick("old"); // luôn về trạng thái sạch trước: ẩn M3/M4, hiện màn cũ
    if (it.kind === "ph") { document.body.classList.add("m3on"); phPage(it.k === "dash" ? "dash" : it.k); }
    else if (it.kind === "m4") legacyClick(it.v);
    else if (it.kind === "m3") { legacyClick("m3"); var f = q("#m3fp"); if (f) { f.value = it.prog; f.dispatchEvent(new Event("change", { bubbles: true })); } }
    else if (it.kind === "data") { body("m5data"); note.hidden = false; }
    else if (it.kind === "old") {
      body("m5v"); var t = q('#tabs [data-v="' + it.tab + '"]'); if (t) t.click();
      var c = it.chip ? q('#chips [data-v="' + it.chip + '"]') : null; if (c) c.click();
    }
    draw();
    if (!quiet) { try { history.replaceState(null, "", "#" + k + (s ? "/" + s : "")); } catch (e) {} }
    window.scrollTo(0, 0);
  }

  nav.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b && b.dataset.k) go(b.dataset.k, b.dataset.s || ""); });
  ph.addEventListener("click", function (e) { var b = e.target.closest("[data-go]"); if (!b) return; var p = b.dataset.go.split("|"); go(p[0], p[1] || ""); });
  window.addEventListener("hashchange", function () { var p = location.hash.replace(/^#/, "").split("/"); if (find(p[0]) && (!CUR || CUR.k !== p[0] || (p[1] && CUR.s !== p[1]))) go(p[0], p[1] || "", true); });
  /* Tài khoản chỉ xem: ẩn/hiện mục Quản lý dữ liệu khi quyền thay đổi (sau khi nhập PIN) */
  if (upc && window.MutationObserver) new MutationObserver(function () { if (CUR && CUR.k === "data" && !canData()) go("dash"); else draw(); }).observe(upc, { attributes: true, attributeFilter: ["hidden"] });
  /* Dữ liệu số suất tải xong sau khi menu đã chọn (màn hình hiện muộn): áp lại tab/bộ lọc đã chọn */
  var out = q("#out"); if (out && window.MutationObserver) new MutationObserver(function () { if (!out.hidden && CUR) { var it = CUR.s ? find(CUR.k, CUR.s) : find(CUR.k); if (it && it.kind === "old") { var t = q('#tabs [data-v="' + it.tab + '"]'), c = it.chip ? q('#chips [data-v="' + it.chip + '"]') : null; if (t && !t.classList.contains("on")) t.click(); if (c && !c.classList.contains("on")) c.click(); } } }).observe(out, { attributes: true, attributeFilter: ["hidden"] });
  var oldAuth = window.m3Auth; window.m3Auth = function () { if (oldAuth) oldAuth(); draw(); };

  var h0 = location.hash.replace(/^#/, "").split("/");
  go(find(h0[0]) ? h0[0] : "dash", h0[1] || "", true);
})();
