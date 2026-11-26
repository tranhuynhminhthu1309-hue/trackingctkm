/* ===== M4 · CTKM Basic / CTKM Cận date: tính từ BC 5.1 theo từng đơn + dashboard phân tích =====
 * Cần: m4-calc.js (M4CALC), m4-lib.js. Backend: m4.gs (act km.*). Tải sau m4.js, trước m5-nav.js. */
(function () {
  "use strict";
  if (typeof document === "undefined" || typeof API_URL === "undefined" || !window.M4CALC) return;
  var K = window.M4CALC;
  var q = function (s, r) { return (r || document).querySelector(s); }, qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var E = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var nf = function (n) { return Number(n || 0).toLocaleString("vi-VN"); }, pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var norm = K.norm, pin = function () { var p = q("#pin"); return p ? p.value : ""; };
  var KINDS = {
    basic: { t: "CTKM Basic", d: "Mua đủ số lượng cùng loại trong 1 đơn hàng thì được tặng thêm. Tính riêng từng đơn: FLOOR(SL mua đủ điều kiện ÷ SL yêu cầu) × SL tặng, không cộng dồn giữa các đơn." },
    clear_date: { t: "CTKM Cận date", d: "Chương trình xả hàng cận date của NPP (Jelly, HTS). Tính riêng từng đơn như Basic; chương trình chưa phát sinh đơn hiển thị 0." }
  };
  var S = { kind: "basic", month: "", data: null, cfg: null, loadedPin: null, view: "prog", metric: "amount", f: { mien: "", vung: "", q: "" }, sort: {}, page: 0, calc: null, file: null, busy: "", flash: null, err: "" };

  /* ---------- CSS + khung ---------- */
  var css = document.createElement("style");
  css.textContent = "#m4km .fl{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin-bottom:12px}#m4km .fl label{display:block;font-size:12.5px;color:var(--mute)}#m4km .fl select,#m4km .fl input{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:6px;padding:6px 8px}" +
    "#m4km table.kt th,#m4km table.kt td{white-space:normal;vertical-align:top}#m4km table.kt th.n,#m4km table.kt td.n{text-align:right;white-space:nowrap}#m4km table.kt th[data-sort]{cursor:pointer;text-decoration:underline dotted}#m4km tr[data-drill]{cursor:pointer}#m4km tr[data-drill]:hover td{background:var(--bg)}" +
    "#m4km .ib{position:relative;min-width:110px;text-align:right}#m4km .ib:before{content:'';position:absolute;left:0;top:1px;bottom:1px;width:var(--w);background:var(--acc);opacity:.16;border-radius:3px}#m4km .ib span{position:relative}" +
    "#m4km .zero td{color:var(--mute)}#m4km table.kt td.l,#m4km table.kt th.l{text-align:left}#m4km table.kt td.t{min-width:210px}#m4km .tw table.kt{min-width:640px}#m4km .chart{width:100%;height:auto;display:block}#m4km .chart text{fill:var(--mute);font-size:10px}#m4km .chart .g{stroke:var(--line);stroke-width:1}#m4km .chart rect{fill:var(--acc)}#m4km .chart rect:hover{opacity:.7}" +
    "#m4km .sp2{display:inline-block;width:12px;height:12px;border:2px solid var(--line);border-top-color:var(--acc);border-radius:50%;animation:m4s 1s linear infinite;vertical-align:-2px;margin-right:6px}@keyframes m4s{to{transform:rotate(360deg)}}" +
    "#m4kd{width:min(1100px,95vw)}#m4kd table{min-width:860px}#m4kd th,#m4kd td{white-space:nowrap}#m4kd td.t{white-space:normal}#m4km .calc ul{margin:6px 0;padding-left:18px}#m4km .calc li.error{color:var(--r)}#m4km .two{display:grid;grid-template-columns:1fr;gap:12px}@media(min-width:900px){#m4km .two.c2{grid-template-columns:minmax(0,3fr) minmax(0,2fr)}}";
  document.head.appendChild(css);
  var sec = document.createElement("section"); sec.id = "m4km"; sec.hidden = true;
  var anchor = q("#m4") || q("#m3") || q("main"); anchor.insertAdjacentElement("beforebegin", sec);
  var dlg = document.createElement("dialog"); dlg.id = "m4kd"; document.body.appendChild(dlg);

  /* ---------- API ---------- */
  function chk(j) { if (j && j.authError && window.showLogin) window.showLogin(j.error); return j; }
  function get(act, params) { return fetch(API_URL + "?mod=m4&act=" + encodeURIComponent(act) + "&pin=" + encodeURIComponent(pin()) + (params || "") + "&t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(chk); }
  function post(act, b) { return fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ pin: pin(), mod: "m4", act: act }, b)) }).then(function (r) { return r.json(); }).then(chk); }
  function readAoa(f) { return typeof window.readFile === "function" ? window.readFile(f) : f.arrayBuffer().then(function (b) { var wb = XLSX.read(b, { type: "array" }); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }); }); }
  function xl(sheets, name) { var wb = XLSX.utils.book_new(); sheets.forEach(function (s) { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s[1]), s[0].slice(0, 31)); }); XLSX.writeFile(wb, name + ".xlsx"); }
  function canEdit() { return !!(S.data && S.data.auth && S.data.auth.canEdit); }

  /* ---------- Hiện / ẩn / tải ---------- */
  function show(kind) { var k = kind === "clear_date" ? "clear_date" : "basic"; if (k !== S.kind) { S.view = "prog"; S.f.q = ""; } S.kind = k; S.page = 0; S.sort = {}; sec.hidden = false; if (!S.data || S.loadedPin !== pin()) load(); else render(); }
  function hide() { sec.hidden = true; if (dlg.open) dlg.close(); }
  function load(month) {
    S.busy = "Đang tải dữ liệu..."; S.err = ""; S.loadedPin = pin(); render();
    return Promise.all([get("km.init", "&thang=" + encodeURIComponent(month || S.month || "")), get("init")]).then(function (r) {
      var j = r[0], c = r[1]; S.busy = "";
      if (!j.ok) { S.err = j.error || "Không tải được dữ liệu."; render(); return; }
      S.data = j; S.cfg = c && c.ok ? c.cc : []; S.month = j.month || month || S.month; render();
    }).catch(function (e) { S.busy = ""; S.err = "Không kết nối được máy chủ: " + e.message; render(); });
  }

  /* ---------- Tổng hợp ---------- */
  var ZERO = function () { return { orders: 0, suat: 0, giftQty: 0, amount: 0, sysQty: 0, missQty: 0, diffOrders: 0 }; };
  function add(a, r) { a.orders += r.orders; a.suat += r.suat; a.giftQty += r.giftQty; a.amount += r.amount; a.sysQty += r.sysQty; a.missQty += r.missQty; a.diffOrders += r.diffOrders; return a; }
  function pass(r) { var f = S.f; return r.kind === S.kind && (!f.mien || r.mien === f.mien) && (!f.vung || r.vung === f.vung); }
  function qOk(r) { return !S.f.q || norm(r.code + " " + r.key + " " + r.name + " " + r.vung + " " + progName(r.code)).indexOf(norm(S.f.q)) >= 0; }
  function rowsOf(lv, withQ) { return (S.data ? S.data.agg : []).filter(function (r) { return r.lv === lv && pass(r) && (!withQ || qOk(r)); }); }
  function group(rows, keyFn, init) { var m = {}, order = []; rows.forEach(function (r) { var k = keyFn(r); if (!m[k]) { m[k] = Object.assign(ZERO(), init ? init(r) : {}, { key: k }); order.push(k); } add(m[k], r); }); return order.map(function (k) { return m[k]; }); }
  function mechs() { return (S.cfg || []).filter(function (c) { return c.month === S.month && c.kind === S.kind && Number(c.active); }); }
  function progName(code) { var c = (S.cfg || []).filter(function (x) { return x.code === code && x.month === S.month; })[0]; return c ? c.name : ""; }
  function rule(c) { return c ? "Mua " + c.buy + " tặng " + c.gift + (c.unit ? " " + c.unit : "") + (Number(c.factor) > 1 ? " (1 " + c.unit + " = " + c.factor + " lẻ)" : "") : ""; }
  function dsKind() { return S.kind === "clear_date" ? "clear_date" : "all"; }
  function dsScope() { return S.kind === "clear_date" ? "Frozen, Sữa, Jelly của các đơn có mã Cận date" : "Frozen, Sữa, Jelly"; }
  function isCd(r) { return String(r.code).indexOf("CD|") === 0; }
  function dsAll() { return (S.data ? S.data.agg : []).filter(function (r) { return r.lv === "ds" && (S.kind === "clear_date" ? isCd(r) : !isCd(r)); }); }
  function dsPrev(R) { var o = { sales: 0, qty: 0 }, m = {}; R.agg.forEach(function (r) { if (r.lv === "ds" && !isCd(r)) { o.sales += r.sales; o.qty += r.salesQty; m[r.code] = 1; } }); o.ng = Object.keys(m).length; return o; }
  function hasDs() { return dsAll().length > 0; }
  function dsRows() { return dsAll().filter(function (r) { return (!S.f.mien || r.mien === S.f.mien) && (!S.f.vung || r.vung === S.f.vung); }); }
  function dsGroups() { var m = {}; dsRows().forEach(function (r) { var kc = String(r.code).replace(/^CD\|/, ""), a = m[kc] = m[kc] || { key: kc, sales: 0, salesQty: 0 }; a.sales += r.sales; a.salesQty += r.salesQty; }); return Object.keys(m).map(function (k) { return m[k]; }); }
  var pct = function (a, b) { return b > 0 ? (a / b * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + "%" : "–"; };
  function filtering() { return !!(S.f.mien || S.f.vung || S.f.q); }
  function totals(rows) { var t = ZERO(); rows.forEach(function (r) { add(t, r); }); t.npp = group(rows.filter(function (r) { return r.giftQty > 0; }), function (r) { return r.key; }).length; return t; }
  var METRICS = { amount: ["Giá trị (đ)", "Giá trị hàng KM (đ)"], giftQty: ["SL hàng KM", "SL hàng KM (sản phẩm lẻ)"], orders: ["Số đơn", "Số đơn có hàng KM"] };

  /* ---------- Hiển thị ---------- */
  function render() {
    var K0 = KINDS[S.kind], h = '<h2 style="margin:0 0 4px;font-size:20px">' + E(K0.t) + '</h2><p class="sub" style="margin-bottom:12px">' + E(K0.d) + "</p>";
    if (S.busy) h += '<div class="warn"><span class="sp2"></span>' + E(S.busy) + "</div>";
    if (S.err) h += '<div class="warn err">' + E(S.err) + "</div>";
    if (S.flash) h += '<div class="warn" style="background:var(--gb)">' + E(S.flash) + "</div>"; // giữ thông báo đến khi người dùng thao tác tiếp
    if (!S.data) { sec.innerHTML = h; return; }
    var d = S.data, run = d.run;
    h += filterBar();
    if (canEdit()) h += calcPanel();
    if (!run) h += '<div class="card empty">Chưa có kết quả tính cho ' + (S.month ? "tháng " + E(S.month) : "tháng nào") + "." + (canEdit() ? " Tải file BC 5.1 ở khung “Tính từ BC 5.1” phía trên." : " Vui lòng liên hệ Trade để cập nhật.") + "</div>";
    else h += dash(run);
    sec.innerHTML = h;
  }
  function filterBar() {
    var d = S.data, ag = d.agg.filter(function (r) { return r.kind === S.kind; }), mi = {}, vu = {};
    ag.forEach(function (r) { if (r.mien) mi[r.mien] = 1; if (!S.f.mien || r.mien === S.f.mien) if (r.vung) vu[r.vung] = 1; });
    var opt = function (list, cur, all) { return '<option value="">' + all + "</option>" + list.sort().map(function (x) { return '<option' + (x === cur ? " selected" : "") + ' value="' + E(x) + '">' + E(x) + "</option>"; }).join(""); };
    return '<div class="fl"><div><label for="kmm">Tháng</label><select id="kmm">' + (d.months.length ? d.months : [S.month]).map(function (m) { return '<option' + (m === S.month ? " selected" : "") + ">" + E(m) + "</option>"; }).join("") + "</select></div>" +
      '<div><label for="kmi">Miền</label><select id="kmi">' + opt(Object.keys(mi), S.f.mien, "Tất cả miền") + "</select></div>" +
      '<div><label for="kmv">Vùng</label><select id="kmv">' + opt(Object.keys(vu), S.f.vung, "Tất cả vùng") + "</select></div>" +
      '<div><label for="kmq">Tìm</label><input id="kmq" type="search" placeholder="Mã CT, tên NPP, vùng…" value="' + E(S.f.q) + '"></div>' +
      '<div class="sp" style="flex:1"></div><button id="kmx">⬇ Xuất Excel</button></div>';
  }
  function runLine(run) { return "[giao diện 26/11-f · tính " + (K.ver || "cũ") + "] Kết quả phiên bản " + run.ver + " · tính lúc " + E(run.at) + " bởi " + E(run.by) + " · file " + E(run.file || "(không rõ)") + (S.data.scoped ? " · chỉ hiển thị phạm vi của bạn" : ""); }
  function dash(run) {
    var npp = rowsOf("npp", true), T = totals(npp), pgm = group(rowsOf("npp", true), function (r) { return r.code; }), h = '<p class="sub" style="margin:0 0 10px">' + runLine(run) + "</p>";
    var diff = T.giftQty - T.sysQty;
    var dsr = dsRows(), sales = dsr.reduce(function (a, r) { return a + r.sales; }, 0), sqty = dsr.reduce(function (a, r) { return a + r.salesQty; }, 0), okDs = hasDs();
    h += '<div class="kpis">' +
      kpi(S.kind === "clear_date" ? "Doanh số đơn Cận date (đ)" : "Doanh số tổng (đ)", okDs ? nf(sales) : "–", "SL bán (sản phẩm lẻ)", okDs ? nf(sqty) : "–", "Hàng KM / doanh số", okDs && !S.f.q ? pct(T.amount, sales) : "–") +
      kpi("Giá trị hàng KM (đ)", nf(T.amount), "SL hàng KM", nf(T.giftQty), "Số NPP", nf(T.npp)) +
      kpi("Số đơn có hàng KM", nf(T.orders), "Số suất", nf(T.suat), "Số chương trình có đơn", nf(pgm.filter(function (p) { return p.giftQty > 0; }).length) + "/" + nf(mechs().length || pgm.length)) +
      '<div class="k"><h3>Đối chiếu số hàng KM hệ thống</h3><div class="big">' + (diff === 0 && T.diffOrders === 0 ? '<span class="pill s0">Khớp 100%</span>' : '<span class="pill s1">Lệch ' + nf(Math.abs(diff)) + " SP</span>") + '</div><div class="row"><span>Hệ thống</span><b>' + nf(T.sysQty) + '</b></div><div class="row"><span>Đơn lệch</span><b>' + nf(T.diffOrders) + "</b></div></div></div>";
    var warn = relevantWarn(run);
    if (T.missQty > 0) h += '<div class="warn err"><b>Thiếu giá NPP:</b> ' + nf(T.missQty) + ' sản phẩm hàng KM chưa có giá trị tiền (không lấy giá khác thay thế). <button class="lk" data-drill="" data-flag="nopr">Xem các đơn</button></div>';
    if (warn.length) h += '<details class="card" style="padding:8px 12px"><summary><b>Cảnh báo khi tính (' + warn.length + ')</b></summary><ul style="margin:6px 0;padding-left:18px">' + warn.map(function (w) { return '<li style="' + (w.level === "error" ? "color:var(--r)" : "") + '">' + E(w.msg) + "</li>"; }).join("") + "</ul></details>";
    h += '<div class="two c2"><div class="card"><div class="bar" style="margin-bottom:6px"><b>' + E(METRICS[S.metric][1]) + " theo ngày</b><span class=\"sp\"></span>" + metricSeg() + "</div>" + dayChart() + "</div>" + shareCard() + "</div>";
    h += '<div class="card"><div class="bar"><div class="seg" role="tablist">' + [["prog", "Theo chương trình"], ["ngh", "Theo nhóm hàng"], ["vung", "Theo vùng"], ["npp", "Theo NPP"], ["day", "Theo ngày"]].map(function (v) { return '<button data-view="' + v[0] + '"' + (S.view === v[0] ? ' class="on"' : "") + ">" + v[1] + "</button>"; }).join("") + '</div><span class="sp"></span><span class="m">' + (S.view === "ngh" ? "Doanh số " + dsScope() + " (trừ hàng trả), theo bộ lọc miền/vùng" : "Bấm vào dòng để xem chi tiết từng đơn") + '</span></div><div class="tw">' + table() + "</div></div>";
    return h + recon(npp) + history();
  }
  function kpi(t, big, l1, v1, l2, v2) { return '<div class="k"><h3>' + E(t) + '</h3><div class="big">' + big + '</div><div class="row"><span>' + E(l1) + "</span><b>" + v1 + '</b></div><div class="row"><span>' + E(l2) + "</span><b>" + v2 + "</b></div></div>"; }
  function metricSeg() { return '<div class="seg">' + Object.keys(METRICS).map(function (k) { return '<button data-metric="' + k + '"' + (S.metric === k ? ' class="on"' : "") + ">" + METRICS[k][0] + "</button>"; }).join("") + "</div>"; }
  function relevantWarn(run) { var codes = {}; mechs().forEach(function (c) { codes[c.code] = 1; }); return (run.warnings || []).filter(function (w) { var m = String(w.msg).match(/^([0-9A-Za-z_]+):/); return !m || codes[m[1]]; }); }
  function dayChart() {
    var rows = rowsOf("day"), by = {}; rows.forEach(function (r) { var d = by[r.key] = by[r.key] || ZERO(); add(d, r); });
    var p = S.month.split("-"), n = new Date(+p[0], +p[1], 0).getDate(), vals = [], mx = 0, i;
    for (i = 1; i <= n; i++) { var v = (by[S.month + "-" + pad(i)] || ZERO())[S.metric]; vals.push(v); if (v > mx) mx = v; }
    if (!mx) return '<div class="empty" style="padding:18px">Chưa có đơn phát sinh theo bộ lọc này.</div>';
    var W = 700, H = 150, L = 52, B = 20, T = 8, bw = (W - L - 6) / n, ch = H - B - T, s = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + E(METRICS[S.metric][1]) + ' theo ngày"><line class="g" x1="' + L + '" x2="' + W + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/><line class="g" x1="' + L + '" x2="' + W + '" y1="' + T + '" y2="' + T + '" stroke-dasharray="3 3"/>' +
      '<text x="' + (L - 6) + '" y="' + (T + 3) + '" text-anchor="end">' + nf(mx) + '</text><text x="' + (L - 6) + '" y="' + (H - B + 3) + '" text-anchor="end">0</text>';
    vals.forEach(function (v, j) { var hh = Math.max(v ? 2 : 0, v / mx * ch), x = L + j * bw + bw * 0.19; s += '<rect x="' + x.toFixed(1) + '" y="' + (H - B - hh).toFixed(1) + '" width="' + (bw * 0.62).toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="2"><title>' + pad(j + 1) + "/" + p[1] + ": " + nf(v) + "</title></rect>"; if ((j + 1) % 5 === 0 || j === 0) s += '<text x="' + (L + j * bw + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + (j + 1) + "</text>"; });
    return s + "</svg>";
  }
  function shareCard() {
    var list = dsGroups().filter(function (x) { return x.sales > 0; }).sort(function (x, y) { return y.sales - x.sales; }), tot = list.reduce(function (a, x) { return a + x.sales; }, 0), mx = list.length ? list[0].sales : 0;
    var h = '<div class="card"><b>Tỷ trọng doanh số nhóm hàng</b><p class="m" style="margin:2px 0 8px">Doanh số (đ) · ' + dsScope() + (S.f.mien || S.f.vung ? " · " + E(S.f.vung || S.f.mien) : "") + "</p>";
    if (!hasDs()) return h + '<div class="empty" style="padding:14px">Phiên bản này chưa có doanh số.' + (canEdit() ? " Hãy tính lại từ BC 5.1 và lưu." : " Vui lòng liên hệ Trade để cập nhật.") + "</div></div>";
    if (!list.length) return h + '<div class="empty" style="padding:14px">Chưa có dữ liệu.</div></div>';
    list.slice(0, 8).forEach(function (x) { var w = Math.round(x.sales / mx * 100); h += '<div style="display:grid;grid-template-columns:minmax(0,1fr) 62px;gap:8px;align-items:center;margin:5px 0"><div><div style="display:flex;justify-content:space-between;gap:8px"><span>' + E(x.key) + '</span><span class="m">' + nf(x.sales) + '</span></div><div class="meter" style="margin:3px 0 0"><i style="width:' + w + '%;background:var(--acc)"></i></div></div><span class="m" style="text-align:right">' + pct(x.sales, tot) + "</span></div>"; });
    if (list.length > 8) h += '<p class="m" style="margin:6px 0 0">… và ' + (list.length - 8) + " nhóm hàng khác (xem tab “Theo nhóm hàng” bên dưới)</p>";
    return h + "</div>";
  }
  function sorted(rows, def) { var s = S.sort[S.view] || def; return rows.slice().sort(function (a, b) { var x = a[s.k], y = b[s.k]; if (typeof x === "string") return s.d * String(x).localeCompare(String(y), "vi"); return s.d * ((x || 0) - (y || 0)) || String(a.key).localeCompare(String(b.key)); }); }
  function th(k, t, num, cur) { return '<th class="' + (num ? "n" : "") + '" data-sort="' + k + '" title="Sắp xếp">' + E(t) + (cur && cur.k === k ? (cur.d < 0 ? " ▼" : " ▲") : "") + "</th>"; }
  function bar(v, mx, key) { return '<div class="ib' + '" style="--w:' + (mx > 0 ? Math.max(0, Math.round(v / mx * 100)) : 0) + '%"><span>' + nf(v) + "</span></div>"; }
  function cell(r, k, mx) { return '<td class="n">' + (S.metric === k ? bar(r[k], mx) : nf(r[k])) + "</td>"; }
  function dcell(r) { var d = r.giftQty - r.sysQty; return '<td class="n">' + (d === 0 && !r.diffOrders ? '<span class="pill s0">Khớp</span>' : '<span class="pill s1">' + (d > 0 ? "+" : "") + nf(d) + "</span>") + "</td>"; }
  function table() {
    var v = S.view, cur = S.sort[v], rows, head, body, mx;
    if (v === "prog") {
      var g = {}; group(rowsOf("npp", true), function (r) { return r.code; }).forEach(function (x) { g[x.key] = x; });
      var cfg = mechs(), list = cfg.map(function (c) { return Object.assign(ZERO(), g[c.code] || {}, { key: c.code, c: c, name: c.name }); });
      Object.keys(g).forEach(function (k) { if (!cfg.some(function (c) { return c.code === k; })) list.push(Object.assign({}, g[k], { c: null, name: "(không còn trong cấu hình)" })); });
      rows = filtering() ? list.filter(function (x) { return x.giftQty || x.orders; }) : list;
      rows = sorted(rows, { k: "key", d: 1 }); mx = Math.max.apply(null, rows.map(function (r) { return r[S.metric]; }).concat(0));
      head = th("key", "Mã CTKM", false, cur) + '<th>Chương trình / cơ chế</th>' + th("orders", "Số đơn", true, cur) + th("suat", "Số suất", true, cur) + th("giftQty", "SL hàng KM", true, cur) + th("amount", "Giá trị (đ)", true, cur) + th("sysQty", "Hệ thống", true, cur) + "<th class=\"n\">Chênh lệch</th>";
      body = rows.map(function (r) { return '<tr data-drill="' + E(r.key) + '" data-by="code"' + (r.giftQty || r.orders ? "" : ' class="zero"') + "><td><b>" + E(r.key) + '</b></td><td class="t">' + E(r.name) + '<div class="m" style="margin:0">' + E(rule(r.c)) + (r.giftQty || r.orders ? "" : " · chưa phát sinh đơn") + "</div></td><td class=\"n\">" + nf(r.orders) + '</td><td class="n">' + nf(r.suat) + "</td>" + cell(r, "giftQty", mx) + cell(r, "amount", mx) + '<td class="n">' + nf(r.sysQty) + "</td>" + dcell(r) + "</tr>"; }).join("");
    } else if (v === "ngh") {
      if (!hasDs()) return '<div class="empty">Phiên bản này chưa có doanh số. Hãy tính lại từ BC 5.1 và lưu.</div>';
      rows = sorted(dsGroups(), { k: "sales", d: -1 }); mx = Math.max.apply(null, rows.map(function (r) { return r.sales; }).concat(0)); var tt = rows.reduce(function (a, r) { return a + r.sales; }, 0);
      head = th("key", "Nhóm hàng", false, cur) + th("salesQty", "SL bán (lẻ)", true, cur) + th("sales", "Doanh số (đ)", true, cur) + '<th class="n">% tỷ trọng</th>';
      body = rows.map(function (r) { return "<tr><td><b>" + E(r.key) + '</b></td><td class="n">' + nf(r.salesQty) + '</td><td class="n">' + bar(r.sales, mx) + '</td><td class="n">' + pct(r.sales, tt) + "</td></tr>"; }).join("");
    } else {
      var lv = v === "day" ? "day" : "npp", keyFn = v === "vung" ? function (r) { return r.vung || "(chưa có vùng)"; } : v === "npp" ? function (r) { return r.key; } : function (r) { return r.key; };
      var init = v === "vung" ? function (r) { return { sub: r.mien }; } : v === "npp" ? function (r) { return { sub: r.vung, name: r.name }; } : null;
      rows = group(rowsOf(lv, v !== "day"), keyFn, init); rows = sorted(rows, v === "day" ? { k: "key", d: 1 } : { k: S.metric, d: -1 }); mx = Math.max.apply(null, rows.map(function (r) { return r[S.metric]; }).concat(0));
      var tot = rows.reduce(function (s, r) { return s + r.amount; }, 0), per = 25, pages = Math.max(1, Math.ceil(rows.length / per)); if (v !== "npp") per = rows.length || 1; if (S.page >= pages) S.page = 0;
      var view = v === "npp" ? rows.slice(S.page * per, S.page * per + per) : rows, lab = { vung: "Vùng", npp: "NPP", day: "Ngày" }[v];
      head = th("key", lab, false, cur) + (v === "vung" ? '<th class="l">Miền</th>' : v === "npp" ? '<th class="l">Vùng</th>' : "") + th("orders", "Số đơn", true, cur) + th("suat", "Số suất", true, cur) + th("giftQty", "SL hàng KM", true, cur) + th("amount", "Giá trị (đ)", true, cur) + '<th class="n">% giá trị</th><th class="n">Chênh lệch</th>';
      body = view.map(function (r) { var dt = v === "day" ? r.key.slice(8) + "/" + r.key.slice(5, 7) : r.key; return '<tr data-drill="' + E(r.key) + '" data-by="' + v + '"><td>' + (v === "npp" ? "<b>" + E(r.name || r.key) + '</b><div class="m" style="margin:0">' + E(r.key) + "</div>" : "<b>" + E(dt) + "</b>") + "</td>" + (v === "vung" || v === "npp" ? '<td class="l">' + E(r.sub) + "</td>" : "") + '<td class="n">' + nf(r.orders) + '</td><td class="n">' + nf(r.suat) + "</td>" + cell(r, "giftQty", mx) + cell(r, "amount", mx) + '<td class="n">' + (tot ? (r.amount / tot * 100).toFixed(1) + "%" : "–") + "</td>" + dcell(r) + "</tr>"; }).join("");
      if (v === "npp" && pages > 1) body += '<tr><td colspan="9" style="text-align:center"><button data-page="-1"' + (S.page ? "" : " disabled") + '>‹ Trước</button> Trang ' + (S.page + 1) + "/" + pages + " · " + rows.length + ' NPP <button data-page="1"' + (S.page + 1 < pages ? "" : " disabled") + ">Sau ›</button></td></tr>";
    }
    if (!body) return '<div class="empty">Không có dữ liệu theo bộ lọc này.</div>';
    return '<table class="kt"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table>";
  }
  function recon(npp) {
    var g = group(npp, function (r) { return r.code; }).filter(function (x) { return x.giftQty !== x.sysQty || x.diffOrders; });
    var h = '<details class="card" style="padding:8px 12px"' + (g.length ? " open" : "") + "><summary><b>Đối chiếu với số liệu hệ thống (BC 5.1)</b> " + (g.length ? '<span class="pill s1">' + g.length + " chương trình lệch</span>" : '<span class="pill s0">Khớp 100%</span>') + "</summary>";
    h += '<p class="m" style="margin:6px 0">Số hàng KM tính theo từng đơn so với số hàng KM hệ thống đã tặng (Hàng KM trừ Hàng KM bị trả lại) cho cùng mã chương trình.</p>';
    if (!g.length) return h + "</details>";
    return h + '<div class="tw"><table class="kt"><thead><tr><th>Mã CTKM</th><th class="n">SL tính được</th><th class="n">SL hệ thống</th><th class="n">Chênh lệch</th><th class="n">Đơn lệch</th></tr></thead><tbody>' + g.map(function (x) { return '<tr data-drill="' + E(x.key) + '" data-by="code" data-flag="diff"><td><b>' + E(x.key) + '</b></td><td class="n">' + nf(x.giftQty) + '</td><td class="n">' + nf(x.sysQty) + '</td><td class="n">' + nf(x.giftQty - x.sysQty) + '</td><td class="n">' + nf(x.diffOrders) + "</td></tr>"; }).join("") + "</tbody></table></div></details>";
  }
  function history() {
    var hs = S.data.history || []; if (hs.length < 1) return "";
    return '<details class="card" style="padding:8px 12px"><summary><b>Lịch sử tính toán (' + hs.length + ' phiên bản)</b></summary><div class="tw"><table class="kt"><thead><tr><th>Phiên bản</th><th>Thời điểm</th><th>Người tính</th><th>File</th><th class="n">Đơn</th><th class="n">SL hàng KM</th><th class="n">Giá trị (đ)</th><th class="n">Doanh số tổng (đ)</th><th>Trạng thái</th></tr></thead><tbody>' +
      hs.map(function (x) { return "<tr><td>" + x.ver + "</td><td>" + E(x.at) + "</td><td>" + E(x.by) + "</td><td>" + E(x.file) + '</td><td class="n">' + nf(x.orders) + '</td><td class="n">' + nf(x.giftQty) + '</td><td class="n">' + nf(x.amount) + '</td><td class="n">' + (x.sales ? nf(x.sales) : "–") + '</td><td><span class="pill ' + (x.status === "active" ? "s0" : "s1") + '">' + (x.status === "active" ? "Đang dùng" : "Đã thay thế") + "</span></td></tr>"; }).join("") + "</tbody></table></div></details>";
  }

  /* ---------- Tính từ BC 5.1 (admin) ---------- */
  function calcPanel() {
    var c = S.calc, h = '<details class="card calc" id="kc"' + (c || S.file ? " open" : "") + '><summary><b>Tính từ BC 5.1</b> <span class="m">(tính cả Basic và Cận date, rồi lưu lên Google Sheet)</span></summary>';
    h += '<p class="m" style="margin:6px 0">Dùng cấu hình hiện có ở “Cấu hình / Mapping” và Bảng giá NPP. Kết quả tháng cũ được thay bằng phiên bản mới (lịch sử tổng số vẫn giữ). Chỉ cần tải BC 5.1 một lần: file chọn ở đây hoặc ở “Quản lý dữ liệu” đều dùng chung cho CTKM Basic, On top và Cận date.</p>';
    h += '<div class="fl"><div><label for="kcf">File BC 5.1 (.xlsx / .xlsb)</label><input id="kcf" type="file" accept=".xlsx,.xlsb,.xls,.csv"></div>' +
      '<div><label for="kcm">Tháng tính</label><input id="kcm" type="month" value="' + E(c ? c.month : S.file && S.file.month || S.month || "") + '"></div>' +
      '<button class="p" id="kcgo"' + (S.file && !S.busy ? "" : " disabled") + ">Tính</button></div>";
    if (S.file) h += '<p class="m" style="margin:0 0 6px">File: <b>' + E(S.file.name) + "</b> · " + nf(S.file.lines.length) + " dòng dữ liệu" + (S.file.months ? " · " + E(S.file.months) : "") + "</p>";
    if (c) {
      var s = c.R.summary, dp = dsPrev(c.R), old = S.data.run && S.data.run.month === c.month ? S.data.run : null;
      h += '<div class="kpis" style="margin-top:8px">' + kpi("Kết quả vừa tính — " + c.month, nf(s.amount) + " đ", "SL hàng KM", nf(s.giftQty), "Số đơn", nf(s.orders)) +
        '<div class="k"><h3>Đối chiếu hệ thống</h3><div class="big">' + (s.diffOrders === 0 && s.giftQty === s.sysQty ? '<span class="pill s0">Khớp 100%</span>' : '<span class="pill s1">Lệch ' + nf(s.diffOrders) + " đơn</span>") + '</div><div class="row"><span>SL hệ thống</span><b>' + nf(s.sysQty) + '</b></div><div class="row"><span>Đơn thiếu giá</span><b>' + nf(s.missOrders) + "</b></div></div>" +
        kpi("Doanh số tổng — " + c.month, nf(dp.sales) + " đ", "SL bán", nf(dp.qty), "Nhóm hàng", nf(dp.ng)) +
        (old ? kpi("So với phiên bản " + old.ver + " đang dùng", (s.amount - old.amount >= 0 ? "+" : "") + nf(s.amount - old.amount) + " đ", "SL hàng KM", (s.giftQty - old.giftQty >= 0 ? "+" : "") + nf(s.giftQty - old.giftQty), "Đơn", (s.orders - old.orders >= 0 ? "+" : "") + nf(s.orders - old.orders)) : "") + "</div>";
      if (c.R.warnings.length) h += "<b>Cảnh báo (" + c.R.warnings.length + ")</b><ul>" + c.R.warnings.map(function (w) { return '<li class="' + w.level + '">' + E(w.msg) + "</li>"; }).join("") + "</ul>";
      h += '<div class="bar"><button class="p" id="kcsave"' + (S.busy ? " disabled" : "") + '>Lưu kết quả</button><button id="kccancel"' + (S.busy ? " disabled" : "") + '>Bỏ kết quả này</button><span class="m">' + nf(c.R.rows.length) + " dòng đơn · " + nf(c.R.agg.length) + " dòng tổng hợp</span></div>";
    }
    return h + "</details>";
  }
  function pickFile(f) {
    if (!f) return Promise.resolve(); S.calc = null; S.busy = "Đang đọc file BC 5.1 (có thể mất vài giây)..."; render();
    S.fp = readAoa(f).then(function (aoa) {
      var r = K.parseBc51(aoa); if (r.errors.length) throw new Error(r.errors.map(function (e) { return e.msg; }).join(" "));
      var cnt = {}; r.lines.forEach(function (l) { if (l.kind === "sale" && l.date) { var m = l.date.slice(0, 7); cnt[m] = (cnt[m] || 0) + 1; } });
      var ms = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
      S.file = { name: f.name, lines: r.lines, month: ms[0] || S.month, months: ms.length > 1 ? "có nhiều tháng: " + ms.map(function (m) { return m + " (" + nf(cnt[m]) + " dòng)"; }).join(", ") : (ms[0] ? "tháng " + ms[0] : ""), warnings: r.warnings || [] };
      S.busy = ""; render();
    }).catch(function (e) { S.file = null; S.busy = ""; S.err = "Không đọc được file: " + e.message; render(); });
    return S.fp;
  }
  function runCalc(moArg) {
    var mo = moArg || (q("#kcm") || {}).value; if (!S.file || !/^\d{4}-\d{2}$/.test(mo || "")) { S.err = "Hãy chọn file và tháng tính."; render(); return Promise.resolve(); }
    S.busy = "Đang tính theo từng đơn..."; S.err = ""; render();
    return Promise.all([get("init"), get("km.regions")]).then(function (r) {
      var c = r[0], g = r[1]; if (!c.ok) throw new Error(c.error || "Không đọc được cấu hình."); if (!g.ok) throw new Error(g.error || "Không đọc được bảng vùng.");
      var R = K.calc(S.file.lines, { month: mo, mechs: c.cc, maps: c.map, prices: c.gia.filter(function (p) { return !p.status || p.status === "active"; }), regions: g.regions });
      if (!R.summary.programs) R.warnings.unshift({ level: "error", msg: "Chưa có chương trình Basic / Cận date nào đang bật cho tháng " + mo + ". Hãy nhập ở “Cấu hình / Mapping” trước." });
      S.calc = { month: mo, R: R, file: S.file.name }; S.busy = ""; render();
    }).catch(function (e) { S.busy = ""; S.err = "Không tính được: " + e.message; render(); });
  }
  function save() {
    var c = S.calc; if (!c || S.busy) return Promise.resolve(); var R = c.R;
    if (!R.summary.programs) { S.err = "Chưa có chương trình nào để lưu."; render(); return Promise.resolve(); }
    S.err = ""; var step = function (t) { S.busy = t; render(); }; step("Đang bắt đầu lưu...");
    return post("km.begin", { month: c.month, file: c.file, summary: R.summary, warnings: R.warnings, nAgg: R.agg.length, nOrd: R.rows.length }).then(function (b) {
      if (!b.ok) throw new Error(b.error || "Không bắt đầu lưu được."); var jobs = [], N = 2500;
      for (var i = 0; i < R.agg.length; i += N) jobs.push(["kma", R.agg.slice(i, i + N)]); for (i = 0; i < R.rows.length; i += N) jobs.push(["kmo", R.rows.slice(i, i + N)]);
      var p = Promise.resolve(); jobs.forEach(function (j, ix) { p = p.then(function () { step("Đang lưu " + (ix + 1) + "/" + jobs.length + "..."); return post("km.put", { runId: b.runId, table: j[0], rows: j[1] }).then(function (r) { if (!r.ok) throw new Error(r.error || "Lưu dở dang."); }); }); });
      return p.then(function () { step("Đang kiểm tra tổng và áp dụng..."); return post("km.commit", { runId: b.runId }); }).then(function (r) {
        if (!r.ok) { post("km.discard", { runId: b.runId }); throw new Error(r.error || "Không áp dụng được."); } return r;
      }, function (e) { post("km.discard", { runId: b.runId }); throw e; });
    }).then(function (r) { S.flash = "Đã lưu kết quả tháng " + r.month + " (phiên bản " + r.ver + ")."; S.calc = null; S.file = null; S.month = c.month; load(c.month); }).catch(function (e) { S.busy = ""; S.err = "Chưa lưu được, dữ liệu cũ vẫn giữ nguyên: " + e.message; render(); });
  }

  /* ---------- Chi tiết từng đơn ---------- */
  var DR = null;
  function drill(by, key, flag) {
    var p = "&thang=" + encodeURIComponent(S.month) + "&kind=" + S.kind + (by === "code" ? "&code=" + encodeURIComponent(key) : by === "vung" ? "&vung=" + encodeURIComponent(key === "(chưa có vùng)" ? "" : key) : by === "npp" ? "&npp=" + encodeURIComponent(key) : by === "day" ? "&date=" + encodeURIComponent(key) : "") + (flag ? "&flag=" + flag : "");
    if (S.f.vung && by !== "vung") p += "&vung=" + encodeURIComponent(S.f.vung);
    dlg.innerHTML = '<div class="bar"><b>Chi tiết từng đơn</b><span class="sp"></span><button data-close>Đóng</button></div><div class="empty"><span class="sp2"></span>Đang tải...</div>'; if (!dlg.open) dlg.showModal();
    get("km.orders", p).then(function (j) { if (!j.ok) throw new Error(j.error || "Lỗi"); if (S.f.mien) j.rows = j.rows.filter(function (r) { return r.mien === S.f.mien; }); DR = { rows: j.rows, total: j.total, truncated: j.truncated, title: by === "code" ? key + " · " + progName(key) : by === "day" ? "Ngày " + key : key, flag: flag, q: "" }; drawDrill(); })
      .catch(function (e) { dlg.innerHTML = '<div class="bar"><b>Chi tiết từng đơn</b><span class="sp"></span><button data-close>Đóng</button></div><div class="warn err">' + E(e.message) + "</div>"; });
  }
  function flagPills(f) { var s = ""; if (/nopr/.test(f)) s += '<span class="pill s2">Thiếu giá</span> '; if (/pconf/.test(f)) s += '<span class="pill s1">Giá xung đột</span> '; if (/diff/.test(f)) s += '<span class="pill s1">Lệch hệ thống</span> '; if (/ret/.test(f)) s += '<span class="pill s0">Có trả hàng</span>'; return s; }
  function drawDrill() {
    var rows = DR.rows.filter(function (r) { return !DR.q || norm(r.order + " " + r.nppName + " " + r.khName + " " + r.kh + " " + r.npp).indexOf(norm(DR.q)) >= 0; }), t = rows.reduce(function (a, r) { a.q += r.giftQty; a.a += r.amount; a.s += r.suat; return a; }, { q: 0, a: 0, s: 0 });
    dlg.innerHTML = '<div class="bar"><b>' + E(DR.title) + '</b><span class="m">' + nf(rows.length) + " đơn · " + nf(t.s) + " suất · " + nf(t.q) + " SL hàng KM · " + nf(t.a) + ' đ</span><span class="sp"></span><input type="search" id="kdq" placeholder="Tìm số đơn, NPP, khách hàng…" value="' + E(DR.q) + '"><button id="kdx">⬇ Excel</button><button data-close>Đóng</button></div>' +
      (DR.truncated ? '<div class="warn">Chỉ hiển thị 3.000 đơn đầu trong tổng ' + nf(DR.total) + " đơn. Hãy lọc thêm theo vùng/NPP/ngày để xem hết.</div>" : "") +
      '<div class="tw" style="max-height:60vh;overflow:auto"><table class="kt"><thead><tr><th>Số đơn hàng</th><th>CT</th><th>Ngày đặt</th><th>NPP</th><th>Vùng</th><th>Khách hàng</th><th class="n">SL mua đủ ĐK</th><th class="n">SL y/c</th><th class="n">Suất</th><th class="n">SL hàng KM</th><th class="n">Hệ thống</th><th class="n">Giá lẻ</th><th class="n">Giá trị (đ)</th><th>Ghi chú</th></tr></thead><tbody>' +
      (rows.length ? rows.slice(0, 500).map(function (r) { return "<tr><td>" + E(r.order) + "</td><td>" + E(r.code) + "</td><td>" + E(r.date.slice(8) + "/" + r.date.slice(5, 7)) + '</td><td class="t">' + E(r.nppName || r.npp) + "</td><td>" + E(r.vung) + '</td><td class="t">' + E(r.khName) + '<div class="m" style="margin:0">' + E(r.kh) + '</div></td><td class="n">' + nf(r.elig) + '</td><td class="n">' + nf(r.req) + '</td><td class="n">' + nf(r.suat) + '</td><td class="n">' + nf(r.giftQty) + '</td><td class="n">' + nf(r.sysQty) + '</td><td class="n">' + (r.price ? nf(Math.round(r.price * 100) / 100) : "–") + '</td><td class="n">' + nf(r.amount) + "</td><td>" + flagPills(r.flag) + "</td></tr>"; }).join("") : '<tr><td colspan="14" class="empty">Không có đơn nào.</td></tr>') + "</tbody></table></div>" + (rows.length > 500 ? '<p class="m">Đang hiển thị 500 đơn đầu; dùng ô tìm kiếm hoặc xuất Excel để xem đầy đủ.</p>' : "");
    var i = q("#kdq", dlg); if (i && document.activeElement !== i && DR.q) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }

  /* ---------- Xuất Excel ---------- */
  function exportView() {
    var T = KINDS[S.kind].t + " " + S.month, sheets = [], rows = group(rowsOf("npp", true), function (r) { return r.code; }), A = [["Mã CTKM", "Chương trình", "Cơ chế", "Số đơn", "Số suất", "SL hàng KM", "Giá trị (đ)", "SL hệ thống", "Chênh lệch"]];
    var by = {}; rows.forEach(function (x) { by[x.key] = x; }); mechs().forEach(function (c) { var x = by[c.code] || ZERO(); A.push([c.code, c.name, rule(c), x.orders, x.suat, x.giftQty, x.amount, x.sysQty, x.giftQty - x.sysQty]); });
    sheets.push(["Theo chương trình", A]);
    var V = [["Vùng", "Miền", "Số đơn", "Số suất", "SL hàng KM", "Giá trị (đ)"]]; group(rowsOf("npp", true), function (r) { return r.vung; }, function (r) { return { mien: r.mien }; }).forEach(function (x) { V.push([x.key, x.mien, x.orders, x.suat, x.giftQty, x.amount]); }); sheets.push(["Theo vùng", V]);
    var N = [["Mã NPP", "Tên NPP", "Vùng", "Số đơn", "Số suất", "SL hàng KM", "Giá trị (đ)", "Chênh lệch"]]; group(rowsOf("npp", true), function (r) { return r.key; }, function (r) { return { name: r.name, vung: r.vung }; }).forEach(function (x) { N.push([x.key, x.name, x.vung, x.orders, x.suat, x.giftQty, x.amount, x.giftQty - x.sysQty]); }); sheets.push(["Theo NPP", N]);
    var D = [["Ngày", "Số đơn", "Số suất", "SL hàng KM", "Giá trị (đ)"]]; group(rowsOf("day"), function (r) { return r.key; }).sort(function (a, b) { return a.key < b.key ? -1 : 1; }).forEach(function (x) { D.push([x.key, x.orders, x.suat, x.giftQty, x.amount]); }); sheets.push(["Theo ngày", D]);
    var G = [["Nhóm hàng", "SL bán (lẻ)", "Doanh số (đ)", "% tỷ trọng"]], gs = dsGroups().sort(function (a, b) { return b.sales - a.sales; }), gt = gs.reduce(function (a, x) { return a + x.sales; }, 0);
    gs.forEach(function (x) { G.push([x.key, x.salesQty, x.sales, gt > 0 ? Math.round(x.sales / gt * 10000) / 10000 : 0]); }); if (gs.length) { G.push(["Tổng", gs.reduce(function (a, x) { return a + x.salesQty; }, 0), gt, ""]); sheets.push(["Theo nhóm hàng", G]); }
    xl(sheets, T.replace(/\s+/g, "_"));
  }
  function exportDrill() {
    var A = [["Số đơn hàng", "Mã CTKM", "Ngày đặt", "Mã NPP", "Tên NPP", "Vùng", "Miền", "Mã KH", "Tên KH", "SL mua đủ ĐK", "SL yêu cầu", "Số suất", "SL hàng KM", "SL hệ thống", "SKU tính giá", "Giá lẻ", "Giá trị (đ)", "Cờ"]];
    DR.rows.forEach(function (r) { A.push([r.order, r.code, r.date, r.npp, r.nppName, r.vung, r.mien, r.kh, r.khName, r.elig, r.req, r.suat, r.giftQty, r.sysQty, r.priceSku, r.price, r.amount, r.flag]); }); xl([["Chi tiết đơn", A]], "Chi_tiet_don_" + S.month);
  }

  /* ---------- Sự kiện ---------- */
  sec.addEventListener("change", function (e) {
    var t = e.target; S.flash = null;
    if (t.id === "kmm") { S.month = t.value; S.f = { mien: "", vung: "", q: "" }; S.page = 0; load(t.value); }
    else if (t.id === "kmi") { S.f.mien = t.value; S.f.vung = ""; S.page = 0; render(); }
    else if (t.id === "kmv") { S.f.vung = t.value; S.page = 0; render(); }
    else if (t.id === "kcf") pickFile(t.files[0]);
  });
  var tmr; sec.addEventListener("input", function (e) { if (e.target.id !== "kmq") return; var v = e.target.value; clearTimeout(tmr); tmr = setTimeout(function () { S.f.q = v; S.page = 0; render(); var i = q("#kmq", sec); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 250); });
  sec.addEventListener("click", function (e) {
    var t = e.target, b; if (t.closest("[data-view],[data-metric],th[data-sort],[data-page],[data-drill],#kmx,#kcgo,#kcsave,#kccancel")) S.flash = null;
    if ((b = t.closest("[data-view]"))) { S.view = b.dataset.view; S.page = 0; render(); return; }
    if ((b = t.closest("[data-metric]"))) { S.metric = b.dataset.metric; render(); return; }
    if ((b = t.closest("th[data-sort]"))) { var k = b.dataset.sort, c = S.sort[S.view]; S.sort[S.view] = { k: k, d: c && c.k === k ? -c.d : (k === "key" ? 1 : -1) }; render(); return; }
    if ((b = t.closest("[data-page]"))) { S.page += Number(b.dataset.page); render(); return; }
    if ((b = t.closest("[data-drill]"))) { drill(b.dataset.by || "", b.dataset.drill, b.dataset.flag || ""); return; }
    if (t.id === "kmx") exportView(); else if (t.id === "kcgo") runCalc(); else if (t.id === "kcsave") save(); else if (t.id === "kccancel") { S.calc = null; render(); }
  });
  dlg.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) dlg.close(); else if (e.target.id === "kdx") exportDrill(); });
  var dt; dlg.addEventListener("input", function (e) { if (e.target.id !== "kdq" || !DR) return; var v = e.target.value; clearTimeout(dt); dt = setTimeout(function () { DR.q = v; drawDrill(); }, 250); });
  var f51 = q("#f51"); if (f51) f51.addEventListener("change", function () { if (f51.files[0] && canEdit()) { S.pendingNote = f51.files[0].name; } });
  var oldAuth = window.m3Auth; window.m3Auth = function () { if (oldAuth) oldAuth(); S.data = null; S.loadedPin = null; if (!sec.hidden) load(); };
  window.M4KM = { show: show, hide: hide, shared: {
    hasFile: function () { return !!(S.file || S.fp); }, hasCalc: function () { return !!S.calc && !S.busy; },
    setFile: function (f) { return pickFile(f); },
    calc: function () { return Promise.resolve(S.fp).then(function () { if (!S.file) return { ok: false, msg: "Chưa đọc được file BC 5.1 cho CTKM Basic / Cận date." }; return Promise.resolve(runCalc(S.file.month)).then(function () { return S.err ? { ok: false, msg: S.err } : { ok: true, msg: "Đã tính CTKM Basic / Cận date tháng " + S.calc.month + ": " + nf(S.calc.R.summary.amount) + " đ, " + nf(S.calc.R.summary.giftQty) + " SL hàng KM." }; }); }); },
    save: function () { return Promise.resolve(save()).then(function () { return S.err ? { ok: false, msg: S.err } : { ok: true, msg: S.flash || "Đã lưu CTKM Basic / Cận date." }; }); } } };
})();
