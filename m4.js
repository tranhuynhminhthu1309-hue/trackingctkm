/* ===== MODULE M4 · Giao diện Phase 1: Thông báo CTKM · Bảng giá NPP · Cấu hình / Mapping =====
 * Chạy độc lập (IIFE), chỉ dùng lại: $, API_URL, #pin, #mnav, readFile, showLogin, XLSX. Không đọc/ghi biến của các module cũ.
 * Tải sau cùng trong index.html: <script src="m4-lib.js"></script><script src="m4.js"></script> */
(function () {
  "use strict";
  if (typeof document === "undefined" || !window.M4LIB || !document.querySelector("#mnav")) return;
  var L = window.M4LIB, q = function (s, r) { return (r || document).querySelector(s); }, qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var E = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = L.norm, PAGE = 25;
  var S = { data: null, view: "tb", month: "", sort: {}, page: {}, sub: "cc", old: false, hist: false, imp: null, cfgMonth: "" };
  var BLOBS = {};

  /* ---------- CSS ---------- */
  var css = document.createElement("style");
  css.textContent = "#m4 .m4t th,#m4 .m4t td{text-align:left;white-space:normal;vertical-align:top}#m4 .m4t th.n,#m4 .m4t td.n{text-align:right;white-space:nowrap}#m4 .m4t th[data-sort]{cursor:pointer;text-decoration:underline dotted}" +
    "#m4 .m4a button{padding:3px 8px;font-size:12px;margin:0 2px 2px 0}#m4 .m4pg{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:8px;color:var(--mute)}" +
    "#m4dlg{width:min(720px,94vw)}#m4dlg .f{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 12px}#m4dlg label,#m4 .fl label{display:block;font-size:12.5px;color:var(--mute)}" +
    "#m4dlg input,#m4dlg select,#m4dlg textarea,#m4 .fl input,#m4 .fl select{width:100%;font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:6px;padding:6px 8px}#m4dlg .w2{grid-column:1/-1}" +
    "#m4 .fl{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px 12px;margin:10px 0}#m4 .er{color:var(--r)}#m4 .ok{color:var(--g)}#m4 .pv{max-height:260px;overflow:auto}#m4 .lv{font-weight:700}" +
    "#m4 .sp2{display:inline-block;width:12px;height:12px;border:2px solid var(--line);border-top-color:var(--acc);border-radius:50%;animation:m4sp .8s linear infinite;vertical-align:-2px;margin-right:6px}@keyframes m4sp{to{transform:rotate(360deg)}}" +
    "#m4pdf{width:min(1000px,96vw);height:90vh}#m4pdf iframe{width:100%;height:calc(90vh - 70px);border:1px solid var(--line);border-radius:6px}";
  document.head.appendChild(css);

  /* ---------- Khung giao diện + menu ---------- */
  var nav = q("#mnav");
  [["m4tb", "Thông báo CTKM"], ["m4gia", "Bảng giá NPP"], ["m4cfg", "Cấu hình / Mapping"]].forEach(function (b) { var e = document.createElement("button"); e.dataset.v = b[0]; e.textContent = b[1]; nav.appendChild(e); });
  var sec = document.createElement("section"); sec.id = "m4"; sec.hidden = true;
  sec.innerHTML = '<p class="sub" id="m4who" style="margin:0 0 8px"></p><div id="m4msg" class="warn" hidden></div><div id="m4body"></div>';
  (q("#m3") || q("main")).insertAdjacentElement("afterend", sec);
  var dlg = document.createElement("dialog"); dlg.id = "m4dlg"; document.body.appendChild(dlg);
  var pdfd = document.createElement("dialog"); pdfd.id = "m4pdf"; pdfd.innerHTML = '<div class="bar" style="margin:0 0 8px"><b id="m4pt"></b><span class="sp"></span><button id="m4pdl">⬇ Tải xuống</button><button id="m4px">Đóng</button></div><iframe id="m4if" title="Thông báo CTKM"></iframe>';
  document.body.appendChild(pdfd);

  nav.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.v.indexOf("m4") === 0) show(b.dataset.v.slice(2)); else hide();
  });
  var oldAuth = window.m3Auth;
  window.m3Auth = function () { if (oldAuth) oldAuth(); S.data = null; S.loadedPin = null; BLOBS = {}; if (!sec.hidden) load(); };

  function hide() { sec.hidden = true; qa("[data-v^=m4]", nav).forEach(function (b) { b.className = ""; }); }
  function show(v) {
    document.body.classList.add("m3on"); var m3 = q("#m3"); if (m3) m3.hidden = true; sec.hidden = false; S.view = v;
    qa("#mnav button").forEach(function (b) { b.className = b.dataset.v === "m4" + v ? "on" : ""; });
    if (!S.data || S.loadedPin !== pin()) load(); else render();
  }
  function pin() { var p = q("#pin"); return p ? p.value : ""; }
  function canEdit() { return !!(S.data && S.data.auth && S.data.auth.canEdit); }

  /* ---------- API ---------- */
  function get(act, params) {
    var u = API_URL + "?mod=m4&act=" + encodeURIComponent(act) + "&pin=" + encodeURIComponent(pin()) + (params || "") + "&t=" + Date.now();
    return fetch(u, { cache: "no-store" }).then(function (r) { return r.json(); }).then(chk);
  }
  function post(act, b) {
    return fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ pin: pin(), mod: "m4", act: act }, b)) }).then(function (r) { return r.json(); }).then(chk);
  }
  function chk(j) { if (j && j.authError && window.showLogin) { window.showLogin(j.error); } return j; }
  function msg(t, kind) { var m = q("#m4msg"); m.hidden = !t; m.className = "warn" + (kind === "err" ? " err" : ""); m.innerHTML = t || ""; }
  function flash(t, kind) { S.flash = [t, kind || ""]; }
  function busy(t) { msg('<span class="sp2"></span>' + E(t)); }
  function load() {
    busy("Đang tải dữ liệu..."); S.loadedPin = pin();
    return get("init").then(function (j) {
      if (!j.ok) { msg(E(j.error || "Không tải được dữ liệu."), "err"); return; }
      S.data = j; if (S.flash) { msg(S.flash[0], S.flash[1]); S.flash = null; } else msg(""); var a = j.auth; q("#m4who").textContent = (a.ten || "") + " · " + (a.canEdit ? "quản trị" : "chỉ xem");
      if (!S.month || j.months.indexOf(S.month) < 0) S.month = j.months[0] || ""; render();
    }).catch(function (e) { msg("Không kết nối được máy chủ: " + E(e.message), "err"); });
  }

  /* ---------- Tiện ích hiển thị ---------- */
  var nf = function (n, d) { return n === "" || n == null || isNaN(n) ? "" : Number(n).toLocaleString("vi-VN", { maximumFractionDigits: d == null ? 2 : d }); };
  var dmy = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "/" + m[2] + "/" + m[1] : s || ""; };
  var mlab = function (m) { return m ? "Tháng " + m.slice(5) + "/" + m.slice(0, 4) : ""; };
  function opts(vals, cur, all) { return (all ? '<option value="">' + E(all) + "</option>" : "") + vals.map(function (v) { return '<option value="' + E(v[0]) + '"' + (v[0] === cur ? " selected" : "") + ">" + E(v[1]) + "</option>"; }).join(""); }
  function monthOpts(months, cur, all) { return opts(months.map(function (m) { return [m, mlab(m)]; }), cur, all); }
  function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }
  function pill(s) { var m = { ok: ["s0", "Sẵn sàng"], deleted: ["s2", "Đã xóa"], no_access: ["s2", "Mất quyền/không tìm thấy"], not_pdf: ["s2", "Không phải PDF"], "": ["s1", "Chưa đính kèm"] }[s || ""] || ["s1", s]; return '<span class="pill ' + m[0] + '">' + E(m[1]) + "</span>"; }
  function sortRows(id, rows, cols) {
    var s = S.sort[id]; if (!s) return rows; var c = cols.filter(function (x) { return x.k === s.k; })[0]; if (!c) return rows;
    return rows.slice().sort(function (a, b) { var x = a[s.k], y = b[s.k]; if (c.num) return ((+x || 0) - (+y || 0)) * s.d; return String(x == null ? "" : x).localeCompare(String(y == null ? "" : y), "vi") * s.d; });
  }
  /** Bảng có sắp xếp + phân trang. cols: {k,h,num,f(row)->html}. extra: hàm trả nút thao tác */
  function grid(id, cols, rows, actions) {
    rows = sortRows(id, rows, cols); var pg = Math.min(S.page[id] || 0, Math.max(0, Math.ceil(rows.length / PAGE) - 1)); S.page[id] = pg;
    var part = rows.slice(pg * PAGE, pg * PAGE + PAGE), s = S.sort[id] || {};
    var h = '<div class="tw"><table class="m4t"><thead><tr>' + cols.map(function (c) { return '<th class="' + (c.num ? "n" : "") + '" data-sort="' + id + ":" + c.k + '">' + E(c.h) + (s.k === c.k ? (s.d > 0 ? " ▲" : " ▼") : "") + "</th>"; }).join("") + (actions ? "<th></th>" : "") + "</tr></thead><tbody>";
    if (!part.length) h += '<tr><td colspan="' + (cols.length + 1) + '" class="empty">Chưa có dữ liệu</td></tr>';
    part.forEach(function (r) { h += "<tr>" + cols.map(function (c) { return '<td class="' + (c.num ? "n" : "") + '">' + (c.f ? c.f(r) : E(r[c.k])) + "</td>"; }).join("") + (actions ? '<td class="m4a">' + actions(r) + "</td>" : "") + "</tr>"; });
    var n = Math.max(1, Math.ceil(rows.length / PAGE));
    return h + '</tbody></table></div><div class="m4pg"><span>' + rows.length + ' dòng</span><button data-pg="' + id + ':-1"' + (pg <= 0 ? " disabled" : "") + '>‹ Trước</button><span>Trang ' + (pg + 1) + "/" + n + '</span><button data-pg="' + id + ':1"' + (pg >= n - 1 ? " disabled" : "") + ">Sau ›</button></div>";
  }
  function xl(sheets, name) { var wb = XLSX.utils.book_new(); sheets.forEach(function (s) { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s[1]), s[0].slice(0, 31)); }); XLSX.writeFile(wb, name + ".xlsx"); }
  function readAoa(f) { return typeof window.readFile === "function" ? window.readFile(f) : f.arrayBuffer().then(function (b) { var wb = XLSX.read(b, { type: "array" }); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }); }); }
  function errList(a, cls) { return a.length ? '<ul class="' + (cls || "er") + '" style="margin:6px 0;padding-left:18px">' + a.slice(0, 40).map(function (x) { return "<li>" + (x.line ? "Dòng " + x.line + ": " : "") + E(x.msg) + "</li>"; }).join("") + (a.length > 40 ? "<li>… và " + (a.length - 40) + " mục khác</li>" : "") + "</ul>" : ""; }

  /* ---------- Điều hướng chính ---------- */
  function render() {
    if (!S.data) return;
    var v = S.view, b = q("#m4body");
    b.innerHTML = v === "tb" ? vTb() : v === "gia" ? vGia() : vCfg();
    if (v === "gia") bindImp(); if (v === "cfg") bindCfg();
  }

  /* ====================== THÔNG BÁO CTKM ====================== */
  function tbRows() {
    var m = S.tbm, t = S.tbt, s = norm(S.tbq || "");
    return S.data.tb.filter(function (r) { return (!m || r.month === m) && (!t || r.type === t) && (!s || norm(r.no + " " + r.name + " " + r.content).indexOf(s) >= 0); });
  }
  function vTb() {
    var d = S.data, ed = canEdit(), types = uniq(d.tb.map(function (r) { return r.type; })).sort();
    if (S.tbm === undefined) S.tbm = d.months.indexOf(S.month) >= 0 ? S.month : "";
    var h = '<p class="sub">Lưu và tra cứu thông báo chương trình khuyến mãi theo tháng. File PDF được lưu trên Google Drive, web chỉ lưu ID và đường dẫn (không nhân bản file).</p>' +
      '<div class="bar fb"><select id="tbm" aria-label="Tháng">' + monthOpts(uniq(d.tb.map(function (r) { return r.month; })).sort().reverse(), S.tbm, "Tất cả tháng") + '</select><select id="tbt" aria-label="Hình thức KM">' + opts(types.map(function (x) { return [x, x]; }), S.tbt || "", "Mọi hình thức") + '</select>' +
      '<input id="tbq" type="search" placeholder="Tìm số thông báo, tên CTKM" value="' + E(S.tbq || "") + '" aria-label="Tìm kiếm"><span class="sp"></span><button data-a="tb-xl">⬇ Xuất Excel</button>' +
      (ed ? '<button class="p" data-a="tb-new">+ Thêm thông báo</button><button data-a="tb-drive">Thư mục Drive</button><button data-a="tb-recheck">Kiểm tra lại file</button>' : "") + "</div>";
    var cols = [{ k: "month", h: "Tháng" }, { k: "no", h: "Số TB" }, { k: "name", h: "Tên CTKM", f: function (r) { return "<b>" + E(r.name) + "</b>" + (r.content ? '<div class="m">' + E(r.content) + "</div>" : ""); } }, { k: "type", h: "Hình thức" },
      { k: "from", h: "Bắt đầu", f: function (r) { return dmy(r.from); } }, { k: "to", h: "Kết thúc", f: function (r) { return dmy(r.to); } }, { k: "fstatus", h: "File", f: function (r) { return pill(r.fileId ? r.fstatus : ""); } }, { k: "updated", h: "Cập nhật", f: function (r) { return E((r.updated || "").slice(0, 10)); } }];
    return h + grid("tb", cols, tbRows(), function (r) {
      var a = r.fileId ? '<button class="p" data-a="tb-open" data-id="' + r.id + '">Mở thông báo</button><button data-a="tb-view" data-id="' + r.id + '">Xem</button><button data-a="tb-dl" data-id="' + r.id + '">Tải</button>' : "";
      return a + (ed ? '<button data-a="tb-edit" data-id="' + r.id + '">Sửa</button><button data-a="tb-del" data-id="' + r.id + '">Xóa</button>' : "");
    });
  }
  function find(tk, id) { return S.data[tk].filter(function (r) { return r.id === id; })[0]; }
  function b64Blob(b64) { var s = atob(b64), n = s.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type: "application/pdf" }); }
  function pdfUrl(r) { // lấy PDF qua máy chủ (đúng quyền PIN), lưu tạm để không tải lại
    if (BLOBS[r.fileId]) return Promise.resolve(BLOBS[r.fileId]);
    return get("pdf", "&fileId=" + encodeURIComponent(r.fileId)).then(function (j) {
      if (!j.ok) { var e = new Error(j.error || "Không mở được file."); e.status = j.status; throw e; }
      return (BLOBS[r.fileId] = { url: URL.createObjectURL(b64Blob(j.b64)), name: j.name });
    });
  }
  function pdfFail(r, e) { msg(E(e.message) + ' <a href="' + E(r.url) + '" target="_blank" rel="noopener">Mở bằng link Drive</a>', "err"); }
  function openPdf(r, mode) {
    var w = mode === "tab" ? window.open("", "_blank") : null;
    if (w) w.document.write("<p style='font:14px sans-serif'>Đang mở thông báo " + E(r.no) + "...</p>");
    busy("Đang mở thông báo " + r.no + "...");
    pdfUrl(r).then(function (f) {
      msg("");
      if (mode === "dl") { var a = document.createElement("a"); a.href = f.url; a.download = f.name || "thong-bao.pdf"; document.body.appendChild(a); a.click(); a.remove(); }
      else if (mode === "tab" && w) w.location.href = f.url;
      else { q("#m4pt").textContent = "Thông báo " + r.no + " · " + r.name; q("#m4if").src = f.url; q("#m4pdl").onclick = function () { openPdf(r, "dl"); }; if (!pdfd.open) pdfd.showModal(); }
    }).catch(function (e) { if (w) w.close(); pdfFail(r, e); });
  }
  q("#m4px").onclick = function () { pdfd.close(); q("#m4if").src = "about:blank"; };
  function tbForm(r) {
    r = r || {}; var types = uniq(S.data.tb.map(function (x) { return x.type; }).concat(["Tặng hàng", "Chiết khấu", "Hỗ trợ khác"]));
    dlg.innerHTML = '<div class="bar"><h2 style="margin:0">' + (r.id ? "Sửa thông báo" : "Thêm thông báo CTKM") + '</h2><span class="sp"></span><button data-d="x">Đóng</button></div><div class="f">' +
      '<div><label>Tháng áp dụng</label><input type="month" id="f-month" value="' + E(r.month || S.month) + '"></div><div><label>Số thông báo</label><input id="f-no" value="' + E(r.no) + '"></div>' +
      '<div class="w2"><label>Tên CTKM</label><input id="f-name" value="' + E(r.name) + '"></div><div class="w2"><label>Nội dung cơ bản</label><textarea id="f-content" rows="3">' + E(r.content) + '</textarea></div>' +
      '<div><label>Hình thức KM</label><input id="f-type" list="f-types" value="' + E(r.type) + '"><datalist id="f-types">' + types.map(function (t) { return "<option>" + E(t) + "</option>"; }).join("") + '</datalist></div><div></div>' +
      '<div><label>Bắt đầu</label><input type="date" id="f-from" value="' + E(r.from) + '"></div><div><label>Kết thúc</label><input type="date" id="f-to" value="' + E(r.to) + '"></div>' +
      '<div class="w2"><label>File PDF trên Google Drive: dán link hoặc ID</label><input id="f-file" value="' + E(r.fileId) + '" placeholder="https://drive.google.com/file/d/..."></div>' +
      '<div><label>Hoặc chọn từ thư mục Drive đã cấu hình</label><select id="f-pick"><option value="">— bấm “Tải danh sách” —</option></select><button type="button" data-d="list" style="margin-top:4px">Tải danh sách</button></div>' +
      '<div><label>Hoặc tải PDF mới lên (tối đa 8 MB)</label><input type="file" id="f-up" accept="application/pdf,.pdf"></div></div><p id="f-msg" class="sub"></p><div id="f-err"></div>' +
      '<div class="bar" style="margin-top:8px"><span class="sp"></span><button data-d="x">Hủy</button><button class="p" data-d="save">Lưu</button></div>';
    dlg.dataset.id = r.id || ""; dlg.dataset.fname = r.fname || ""; dlg.showModal();
  }
  function tbSave() {
    var row = { id: dlg.dataset.id, month: q("#f-month").value, no: q("#f-no").value, name: q("#f-name").value, content: q("#f-content").value, type: q("#f-type").value, from: q("#f-from").value, to: q("#f-to").value, fileId: q("#f-file").value, fname: dlg.dataset.fname };
    q("#f-err").innerHTML = ""; q("#f-msg").innerHTML = '<span class="sp2"></span>Đang lưu...';
    post("tb.save", { row: row }).then(function (j) {
      if (!j.ok) { q("#f-msg").textContent = ""; q("#f-err").innerHTML = errList((j.errors || [{ msg: j.error }]).map(function (x) { return typeof x === "string" ? { msg: x } : x; })); return; }
      dlg.close(); flash("Đã lưu thông báo " + E(j.row.no) + (j.row.fstatus && j.row.fstatus !== "ok" && j.row.fileId ? ". Lưu ý: " + E(statusText(j.row.fstatus)) : "") + "."); load();
    }).catch(function (e) { q("#f-msg").textContent = ""; q("#f-err").innerHTML = errList([{ msg: e.message }]); });
  }
  function statusText(s) { return { ok: "File sẵn sàng", deleted: "File đã bị xóa.", no_access: "File không còn khả dụng hoặc đã đổi quyền truy cập.", not_pdf: "File không phải PDF." }[s] || s; }
  function tbUpload(file) {
    var m = q("#f-msg"); if (!file) return; if (file.size > 8 * 1048576) { m.textContent = "File quá lớn (tối đa 8 MB). Hãy tải lên Drive rồi dán link."; return; }
    m.innerHTML = '<span class="sp2"></span>Đang tải lên Drive...';
    var fr = new FileReader(); fr.onload = function () {
      post("tb.upload", { name: file.name, b64: String(fr.result).split(",")[1] }).then(function (j) {
        if (!j.ok) { m.innerHTML = '<span class="er">' + E(j.error) + "</span>"; return; }
        q("#f-file").value = j.fileId; dlg.dataset.fname = j.name; m.innerHTML = j.duplicate ? "File đã có sẵn trong thư mục, dùng lại (không lưu trùng)." : "Đã tải lên Drive.";
      }).catch(function (e) { m.innerHTML = '<span class="er">' + E(e.message) + "</span>"; });
    }; fr.readAsDataURL(file);
  }
  function tbDrive() {
    dlg.innerHTML = '<div class="bar"><h2 style="margin:0">Thư mục Google Drive chứa thông báo</h2><span class="sp"></span><button data-d="x">Đóng</button></div>' +
      '<p class="sub">' + (S.data.drive.canUse ? "" : '<b class="er">Hãy bật phân quyền (thêm PIN admin vào sheet PhanQuyen) trước khi dùng Drive.</b> ') + 'Dán link hoặc ID thư mục. Thư mục phải thuộc tài khoản Google đang chạy Apps Script (hoặc được chia sẻ cho tài khoản đó).</p>' +
      '<input id="f-folder" placeholder="https://drive.google.com/drive/folders/..." style="width:100%"><p id="f-msg" class="sub">' + (S.data.drive.folderSet ? "Đã cấu hình thư mục." : "Chưa cấu hình thư mục.") + '</p><div class="bar"><span class="sp"></span><button class="p" data-d="folder">Lưu thư mục</button></div>';
    dlg.dataset.id = ""; dlg.showModal();
  }
  dlg.addEventListener("click", function (e) {
    var b = e.target.closest("[data-d]"); if (!b) return; var d = b.dataset.d;
    if (d === "x") dlg.close(); else if (d === "save") tbSave(); else if (d === "gsave") giaSave(); else if (d === "csave") cfgSave();
    else if (d === "folder") { var v = q("#f-folder").value, id = (/folders\/([\w-]+)/.exec(v) || [])[1] || v; post("drive.config", { folderId: id }).then(function (j) { q("#f-msg").innerHTML = j.ok ? '<span class="ok">Đã lưu thư mục: ' + E(j.folder) + "</span>" : '<span class="er">' + E(j.error) + "</span>"; if (j.ok) S.data.drive.folderSet = true; }); }
    else if (d === "list") { q("#f-msg").innerHTML = '<span class="sp2"></span>Đang đọc thư mục...'; get("drivelist").then(function (j) { if (!j.ok) { q("#f-msg").innerHTML = '<span class="er">' + E(j.error) + "</span>"; return; } q("#f-pick").innerHTML = '<option value="">— chọn file —</option>' + j.files.map(function (f) { return '<option value="' + E(f.id) + '" data-n="' + E(f.name) + '">' + E(f.name) + " (" + E(f.updated) + ")</option>"; }).join(""); q("#f-msg").textContent = j.files.length + " file PDF trong “" + j.folder + "”."; }); }
  });
  dlg.addEventListener("change", function (e) {
    if (e.target.id === "f-pick" && e.target.value) { q("#f-file").value = e.target.value; dlg.dataset.fname = e.target.selectedOptions[0].dataset.n || ""; }
    if (e.target.id === "f-up") tbUpload(e.target.files[0]);
  });

  /* ====================== BẢNG GIÁ NPP ====================== */
  function giaRows() {
    var m = S.month, s = norm(S.gq || ""); return S.data.gia.filter(function (r) { return r.month === m && (S.old || r.status === "active") && (!s || norm(r.sku + " " + r.name + " " + r.group + " " + r.use).indexOf(s) >= 0); });
  }
  function vGia() {
    var d = S.data, ed = canEdit(), ms = uniq(d.gia.map(function (r) { return r.month; })).sort().reverse();
    var h = '<p class="sub">Một bảng giá chung cho mọi NPP (NPP = ALL). Mỗi lần import là một phiên bản; bản cũ được giữ lại để đối chiếu. Khi tính ngân sách, giá lấy theo SKU và ngày đặt hàng của đơn.</p>' +
      '<div class="bar fb"><select id="gm" aria-label="Tháng">' + monthOpts(ms, S.month) + '</select><input id="gq" type="search" placeholder="Tìm SKU, tên sản phẩm" value="' + E(S.gq || "") + '" aria-label="Tìm kiếm"><label class="m" style="display:flex;gap:4px;align-items:center"><input type="checkbox" id="gold"' + (S.old ? " checked" : "") + '> Hiện cả phiên bản cũ</label><span class="sp"></span><button data-a="g-xl">⬇ Xuất Excel</button>' + (ed ? '<button class="p" data-a="g-imp">⬆ Import bảng giá</button>' : "") + "</div>";
    if (ed) h += '<div class="card" id="gimp" ' + (S.impOpen ? "" : "hidden") + '><b>Import bảng giá từ Excel</b><div class="fl"><div><label>File bảng giá</label><input type="file" id="gf" accept=".xlsx,.xls,.xlsb"></div><div><label>Tháng áp dụng</label><input type="month" id="gmo" value="' + E(S.month || "") + '"></div><div><label>Hiệu lực từ ngày</label><input type="date" id="gfrom"></div></div><div id="gprev"></div></div>';
    var cols = [{ k: "sku", h: "SKU" }, { k: "name", h: "Tên sản phẩm" }, { k: "group", h: "Nhóm" }, { k: "unit", h: "ĐVT" }, { k: "spec", h: "Quy cách" }, { k: "priceCase", h: "Giá thùng", num: 1, f: function (r) { return nf(r.priceCase); } }, { k: "priceUnit", h: "Giá lẻ", num: 1, f: function (r) { return nf(r.priceUnit, 2); } },
      { k: "from", h: "Hiệu lực từ", f: function (r) { return dmy(r.from); } }, { k: "to", h: "Đến", f: function (r) { return dmy(r.to); } }, { k: "npp", h: "NPP" }, { k: "use", h: "Dùng cho CTTB" }, { k: "ver", h: "PB", num: 1, f: function (r) { return r.ver + (r.status === "active" ? "" : ' <span class="pill s1">cũ</span>'); } }];
    h += grid("gia", cols, giaRows(), ed ? function (r) { return r.status === "active" ? '<button data-a="g-edit" data-id="' + r.id + '">Sửa</button>' : ""; } : null);
    var bt = {}; d.gia.forEach(function (r) { var k = r.month + "|" + r.batch; var x = bt[k] || (bt[k] = { month: r.month, batch: r.batch, ver: r.ver, n: 0, by: r.by, at: r.created, st: {} }); x.n++; x.st[r.status] = 1; });
    var hist = Object.keys(bt).map(function (k) { return bt[k]; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    h += '<details class="card" style="margin-top:12px"><summary><b>Lịch sử phiên bản bảng giá</b> (' + hist.length + ')</summary><div class="tw"><table class="m4t"><thead><tr><th>Tháng</th><th>Batch</th><th>PB</th><th class="n">Số dòng</th><th>Người import</th><th>Thời điểm</th><th>Trạng thái</th></tr></thead><tbody>' +
      hist.map(function (x) { return "<tr><td>" + E(x.month) + "</td><td>" + E(x.batch) + "</td><td>" + E(x.ver) + '</td><td class="n">' + x.n + "</td><td>" + E(x.by) + "</td><td>" + E(x.at) + '</td><td><span class="pill ' + (x.st.active ? "s0" : "s1") + '">' + (x.st.active ? "đang dùng" : "đã thay thế") + "</span></td></tr>"; }).join("") + "</tbody></table></div></details>";
    return h;
  }
  function bindImp() {
    var f = q("#gf"); if (!f) return;
    f.onchange = function () {
      var file = f.files[0]; if (!file) return; q("#gprev").innerHTML = '<span class="sp2"></span>Đang đọc file...';
      readAoa(file).then(function (aoa) {
        var p = L.parsePriceAoa(aoa); S.imp = { file: file.name, rows: p.rows.map(function (r) { r.from = L.excelDate(r.from); r.to = L.excelDate(r.to); return r; }) };
        if (p.errors.length) { q("#gprev").innerHTML = errList(p.errors); return; }
        S.imp.note = p.rows.length + " dòng giá, " + p.sections.length + " dòng tiêu đề nhóm bỏ qua" + (p.hasUseColumn ? ", có cột quy đổi CTTB" : ", chưa có cột quy đổi CTTB (có thể bổ sung sau)");
        impCheck();
      }).catch(function (e) { q("#gprev").innerHTML = errList([{ msg: "Không đọc được file: " + e.message }]); });
    };
    q("#gmo").onchange = q("#gfrom").onchange = function () { if (S.imp) impCheck(); };
  }
  function impCheck() {
    var mo = q("#gmo").value, fr = q("#gfrom").value; if (!mo) { q("#gprev").innerHTML = errList([{ msg: "Hãy chọn tháng áp dụng." }]); return; }
    q("#gprev").innerHTML = '<span class="sp2"></span>Đang kiểm tra...';
    post("gia.import", { month: mo, defaultFrom: fr, records: S.imp.rows, dry: true, fileName: S.imp.file }).then(function (j) {
      var h = '<p class="pv"><b>' + E(S.imp.file) + "</b>: " + E(S.imp.note) + ".</p>";
      if (!j.ok) h += '<p class="er lv">Có ' + (j.errors || []).length + " lỗi, chưa thể lưu. Sửa file rồi chọn lại.</p>" + errList(j.errors || [{ msg: j.error }]);
      else {
        h += '<p class="ok lv">Hợp lệ: ' + j.info.rows + " dòng." + (j.info.replacing ? " Tháng " + E(mo) + " đã có bảng giá: bản mới sẽ là phiên bản " + j.info.nextVer + ", bản cũ được giữ lại." : "") + "</p>";
        if ((j.warnings || []).length) h += '<p class="lv">Cảnh báo (' + j.warnings.length + "):</p>" + errList(j.warnings, "");
        h += '<div class="pv"><table class="m4t"><thead><tr><th>SKU</th><th>Tên</th><th>Nhóm</th><th class="n">Giá thùng</th><th class="n">Giá lẻ</th></tr></thead><tbody>' + S.imp.rows.slice(0, 12).map(function (r) { return "<tr><td>" + E(r.sku) + "</td><td>" + E(r.name) + "</td><td>" + E(r.group) + '</td><td class="n">' + nf(L.str(r.priceCase) === "" ? "" : r.priceCase) + '</td><td class="n">' + nf(r.priceUnit) + "</td></tr>"; }).join("") + "</tbody></table></div>" +
          '<div class="bar" style="margin-top:8px"><button class="p" id="gsv">' + (j.info.replacing ? "Lưu phiên bản mới (thay thế)" : "Lưu bảng giá") + "</button></div>";
      }
      q("#gprev").innerHTML = h; var sv = q("#gsv");
      if (sv) sv.onclick = function () {
        if (j.info.replacing && !confirm("Tháng " + mo + " đã có bảng giá. Lưu sẽ tạo phiên bản " + j.info.nextVer + " và giữ lại bản cũ để đối chiếu. Tiếp tục?")) return;
        busy("Đang lưu bảng giá..."); post("gia.import", { month: mo, defaultFrom: fr, records: S.imp.rows, replace: !!j.info.replacing, fileName: S.imp.file }).then(function (r) {
          if (!r.ok) { msg(E(r.error || "Không lưu được.") + errList(r.errors || []), "err"); return; }
          S.imp = null; S.impOpen = false; S.month = mo; flash("Đã lưu " + r.inserted + " dòng giá tháng " + E(mo) + ", phiên bản " + r.ver + "."); load();
        }).catch(function (e) { msg(E(e.message), "err"); });
      };
    }).catch(function (e) { q("#gprev").innerHTML = errList([{ msg: e.message }]); });
  }
  function giaForm(r) {
    dlg.innerHTML = '<div class="bar"><h2 style="margin:0">Sửa giá · ' + E(r.sku) + '</h2><span class="sp"></span><button data-d="x">Đóng</button></div><p class="sub">' + E(r.name) + " · " + mlab(r.month) + ' · phiên bản ' + E(r.ver) + '</p><div class="f">' +
      '<div><label>Giá thùng</label><input id="f-pc" value="' + E(r.priceCase) + '"></div><div><label>Giá lẻ (gói/cây/hộp/túi)</label><input id="f-pu" value="' + E(r.priceUnit) + '"></div>' +
      '<div><label>Hiệu lực từ</label><input type="date" id="f-from" value="' + E(r.from) + '"></div><div><label>Hiệu lực đến (bỏ trống = không giới hạn)</label><input type="date" id="f-to" value="' + E(r.to) + '"></div>' +
      '<div class="w2"><label>Dùng cho CTTB (ghi chú quy đổi giá, vd: CTTB Frozen thường / Tủ đông Want Want / Sữa mức 1)</label><input id="f-use" value="' + E(r.use) + '"></div></div><div id="f-err"></div><p id="f-msg" class="sub"></p><div class="bar"><span class="sp"></span><button data-d="x">Hủy</button><button class="p" data-d="gsave">Lưu</button></div>';
    dlg.dataset.id = r.id; dlg.showModal();
  }
  function giaSave() {
    var row = { id: dlg.dataset.id, priceCase: q("#f-pc").value, priceUnit: q("#f-pu").value, from: q("#f-from").value, to: q("#f-to").value, use: q("#f-use").value };
    post("gia.save", { row: row }).then(function (j) { if (!j.ok) { q("#f-err").innerHTML = errList(j.errors || [{ msg: j.error }]); return; } dlg.close(); flash("Đã cập nhật giá SKU " + E(j.row.sku) + "."); load(); }).catch(function (e) { q("#f-err").innerHTML = errList([{ msg: e.message }]); });
  }

  /* ====================== CẤU HÌNH / MAPPING ====================== */
  function vCfg() {
    var d = S.data, ed = canEdit();
    var h = '<p class="sub">Cơ chế “mua X tặng Y” và danh sách SKU của từng chương trình. Danh sách SKU lấy từ file CTKM tháng / cấu hình của Admin, không suy đoán từ tên nhóm hàng.</p><div class="seg" id="csub" style="margin-bottom:10px"><button data-v="cc"' + (S.sub === "cc" ? ' class="on"' : "") + '>Cơ chế KM</button><button data-v="map"' + (S.sub === "map" ? ' class="on"' : "") + '>Mapping SKU</button><button data-v="chk"' + (S.sub === "chk" ? ' class="on"' : "") + ">Kiểm tra cấu hình</button></div>";
    return h + (S.sub === "cc" ? vCc(ed) : S.sub === "map" ? vMap(ed) : vChk());
  }
  function ccRows() { var m = S.cm == null ? S.month : S.cm, k = S.ck || "", s = norm(S.cq || ""); return S.data.cc.filter(function (r) { return (!m || r.month === m) && (!k || r.kind === k) && (!s || norm(r.code + " " + r.name + " " + r.group).indexOf(s) >= 0); }); }
  function vCc(ed) {
    var d = S.data, m = S.cm == null ? S.month : S.cm;
    var h = '<div class="bar fb"><select id="cm" aria-label="Tháng">' + monthOpts(uniq(d.cc.map(function (r) { return r.month; })).sort().reverse(), m, "Tất cả tháng") + '</select><select id="ck" aria-label="Loại">' + opts([["basic", "Basic"], ["clear_date", "Cận date (clear date)"], ["other", "Khác (tắt)"]], S.ck || "", "Mọi loại") + '</select><input id="cq" type="search" placeholder="Tìm mã, tên, nhóm" value="' + E(S.cq || "") + '" aria-label="Tìm kiếm"><span class="sp"></span><button data-a="c-xl">⬇ Xuất Excel</button>' + (ed ? '<button class="p" data-a="c-fromct">Nhập từ file CTKM tháng</button><button data-a="c-imp">Import Excel</button><button data-a="c-new">+ Thêm</button>' : "") + "</div>";
    if (ed) h += '<div class="card" id="cimp" ' + (S.cimp ? "" : "hidden") + "></div>";
    var cols = [{ k: "code", h: "Mã CTKM" }, { k: "kind", h: "Loại" }, { k: "name", h: "Tên chương trình" }, { k: "buy", h: "Mua", num: 1 }, { k: "gift", h: "Tặng", num: 1 }, { k: "unit", h: "ĐVT" }, { k: "factor", h: "Quy đổi lẻ/ĐVT", num: 1 }, { k: "from", h: "Từ", f: function (r) { return dmy(r.from); } }, { k: "to", h: "Đến", f: function (r) { return dmy(r.to); } }, { k: "prio", h: "Ưu tiên", num: 1 }, { k: "active", h: "Trạng thái", f: function (r) { return '<span class="pill ' + (r.active ? "s0" : "s1") + '">' + (r.active ? "Bật" : "Tắt") + "</span>"; } }];
    return h + grid("cc", cols, ccRows(), ed ? function (r) { return '<button data-a="c-tog" data-id="' + r.id + '">' + (r.active ? "Tắt" : "Bật") + '</button><button data-a="c-edit" data-id="' + r.id + '">Sửa</button><button data-a="c-del" data-id="' + r.id + '">Xóa</button>'; } : null);
  }
  function mapRows() { var c = S.mc || "", s = norm(S.mq || ""); return S.data.map.filter(function (r) { return (!c || r.code === c) && (!s || norm(r.code + " " + r.sku + " " + r.name).indexOf(s) >= 0); }); }
  function vMap(ed) {
    var d = S.data, h = '<div class="bar fb"><select id="mc" aria-label="Mã CTKM">' + opts(uniq(d.map.map(function (r) { return r.code; })).sort().map(function (x) { return [x, x]; }), S.mc || "", "Mọi mã CTKM") + '</select><input id="mq" type="search" placeholder="Tìm mã, SKU, tên" value="' + E(S.mq || "") + '" aria-label="Tìm kiếm"><span class="sp"></span><button data-a="m-xl">⬇ Xuất Excel</button>' + (ed ? '<button class="p" data-a="m-imp">Import Excel</button><button data-a="m-new">+ Thêm</button>' : "") + "</div>";
    if (ed) h += '<div class="card" id="cimp" ' + (S.cimp ? "" : "hidden") + "></div>";
    var cols = [{ k: "code", h: "Mã CTKM" }, { k: "sku", h: "SKU" }, { k: "name", h: "Tên SP" }, { k: "role", h: "Vai trò" }, { k: "priceSku", h: "SKU tính giá" }, { k: "from", h: "Từ", f: function (r) { return dmy(r.from); } }, { k: "to", h: "Đến", f: function (r) { return dmy(r.to); } }, { k: "active", h: "Trạng thái", f: function (r) { return '<span class="pill ' + (r.active ? "s0" : "s1") + '">' + (r.active ? "Bật" : "Tắt") + "</span>"; } }, { k: "src", h: "Nguồn" }];
    return h + grid("map", cols, mapRows(), ed ? function (r) { return '<button data-a="m-tog" data-id="' + r.id + '">' + (r.active ? "Tắt" : "Bật") + '</button><button data-a="m-edit" data-id="' + r.id + '">Sửa</button><button data-a="m-del" data-id="' + r.id + '">Xóa</button>'; } : null);
  }
  function vChk() {
    var m = S.cfgMonth || S.month;
    return '<div class="bar"><select id="chm" aria-label="Tháng">' + monthOpts(uniq(S.data.cc.map(function (r) { return r.month; })).sort().reverse(), m) + '</select><button class="p" data-a="chk-run">Kiểm tra</button></div><div id="chkout" class="card"><span class="sub">Kiểm tra: chương trình chưa có SKU, SKU thiếu giá NPP, SKU thuộc nhiều chương trình, mapping trỏ sai mã.</span></div>';
  }
  function runCheck() {
    var m = q("#chm").value; S.cfgMonth = m; q("#chkout").innerHTML = '<span class="sp2"></span>Đang kiểm tra...';
    get("cfgcheck", "&thang=" + encodeURIComponent(m)).then(function (j) {
      if (!j.ok) { q("#chkout").innerHTML = '<span class="er">' + E(j.error) + "</span>"; return; }
      var w = j.warnings, lv = { error: ["s2", "Lỗi"], warn: ["s1", "Cảnh báo"], info: ["s0", "Ghi chú"] };
      q("#chkout").innerHTML = (w.length ? "" : '<p class="ok lv">Cấu hình tháng ' + E(m) + " hợp lệ, không có cảnh báo.</p>") + '<ul style="padding-left:18px;margin:0">' + w.map(function (x) { return '<li style="margin:4px 0"><span class="pill ' + lv[x.level][0] + '">' + lv[x.level][1] + "</span> " + E(x.msg) + "</li>"; }).join("") + "</ul>";
    });
  }
  function bindCfg() { /* các nút dùng ủy quyền sự kiện ở dưới */ }
  function cImp(kind) { // import cấu hình từ Excel (mẫu = đúng các cột đang xuất)
    S.cimp = kind; var box = q("#cimp"); box.hidden = false;
    box.innerHTML = '<b>' + (kind === "cc" ? "Import cơ chế KM" : "Import mapping SKU") + ' từ Excel</b><p class="sub">Dùng đúng các cột của file xuất ra từ màn hình này (bấm “Xuất Excel” để lấy mẫu). Dòng trùng khóa sẽ được cập nhật, không nhân đôi.</p><input type="file" id="cf" accept=".xlsx,.xls"><div id="cprev"></div>';
    q("#cf").onchange = function () { var f = this.files[0]; if (!f) return; readAoa(f).then(function (a) { var p = L.parseTemplateAoa(a, kind); p.rows.forEach(function (r) { r.from = L.excelDate(r.from); r.to = L.excelDate(r.to); }); cSend(kind, p.rows, p.errors, f.name); }); };
  }
  function cFromCt() {
    S.cimp = "ct"; var box = q("#cimp"); box.hidden = false;
    box.innerHTML = '<b>Nhập cơ chế KM từ file CTKM tháng</b><p class="sub">Đọc cột Mã Khuyến Mãi, Tên CTKM, Nhóm CTKM. Nhóm “Basic …” và “Cận date …” được bật; các chương trình mua-X-tặng-Y khác được nhập ở trạng thái tắt.</p><div class="fl"><div><label>Tháng áp dụng</label><input type="month" id="ctm" value="' + E(S.month || "") + '"></div><div><label>File CTKM tháng</label><input type="file" id="cf" accept=".xlsx,.xls,.xlsb"></div></div><div id="cprev"></div>';
    q("#cf").onchange = function () { var f = this.files[0], mo = q("#ctm").value; if (!f) return; if (!mo) { q("#cprev").innerHTML = errList([{ msg: "Hãy chọn tháng áp dụng trước." }]); return; }
      readAoa(f).then(function (a) { var c = L.parseCtkmAoa(a); if (c.errors.length) { q("#cprev").innerHTML = errList(c.errors); return; } var p = L.proposeMechanics(c.items, mo);
        cSend("cc", p.rows, p.errors, f.name, p.skipped.length + " mã On top / Shop sữa / không có “mua X tặng Y” được bỏ qua"); }); };
  }
  function cSend(kind, rows, errs, fname, note) {
    var pv = q("#cprev"); if (errs.length) { pv.innerHTML = '<p class="er lv">Có lỗi khi đọc file:</p>' + errList(errs); if (!rows.length) return; }
    pv.innerHTML = '<span class="sp2"></span>Đang kiểm tra...';
    post(kind + ".import", { records: rows, dry: true, fileName: fname }).then(function (j) {
      if (!j.ok) { pv.innerHTML = '<p class="er lv">Chưa thể lưu: ' + (j.errors || []).length + " lỗi.</p>" + errList(j.errors || [{ msg: j.error }]); return; }
      var on = rows.filter(function (r) { return r.active !== 0 && r.active !== "0"; }).length;
      pv.innerHTML = (note ? '<p class="sub">' + E(note) + ".</p>" : "") + '<p class="ok lv">Hợp lệ: ' + rows.length + " dòng (" + j.inserted + " mới, " + j.updated + " cập nhật)" + (kind === "cc" ? ", " + on + " đang bật" : "") + '.</p><div class="bar"><button class="p" id="csv">Lưu</button></div>';
      q("#csv").onclick = function () { busy("Đang lưu..."); post(kind + ".import", { records: rows, fileName: fname }).then(function (r) { if (!r.ok) { msg(E(r.error || "Không lưu được.") + errList(r.errors || []), "err"); return; } S.cimp = null; flash("Đã lưu: " + r.inserted + " mới, " + r.updated + " cập nhật."); load(); }); };
    });
  }
  function cfgForm(kind, r) {
    r = r || {}; var cc = kind === "cc";
    dlg.innerHTML = '<div class="bar"><h2 style="margin:0">' + (cc ? "Cơ chế KM" : "Mapping SKU") + '</h2><span class="sp"></span><button data-d="x">Đóng</button></div><div class="f">' + (cc ?
      '<div><label>Tháng</label><input type="month" id="f-month" value="' + E(r.month || S.month) + '"></div><div><label>Mã CTKM</label><input id="f-code" value="' + E(r.code) + '"></div><div class="w2"><label>Tên chương trình</label><input id="f-name" value="' + E(r.name) + '"></div>' +
      '<div><label>Loại</label><select id="f-kind">' + opts([["basic", "basic"], ["clear_date", "clear_date"], ["other", "other"]], r.kind || "basic") + '</select></div><div><label>Nhóm CTKM</label><input id="f-group" value="' + E(r.group) + '"></div>' +
      '<div><label>SL mua</label><input id="f-buy" value="' + E(r.buy) + '"></div><div><label>SL tặng</label><input id="f-gift" value="' + E(r.gift) + '"></div><div><label>ĐVT</label><input id="f-unit" value="' + E(r.unit) + '"></div><div><label>Quy đổi (lẻ/ĐVT), vd 1 lốc = 4 hộp</label><input id="f-factor" value="' + E(r.factor === "" || r.factor == null ? 1 : r.factor) + '"></div>' +
      '<div><label>Từ ngày</label><input type="date" id="f-from" value="' + E(r.from) + '"></div><div><label>Đến ngày</label><input type="date" id="f-to" value="' + E(r.to) + '"></div><div><label>Ưu tiên (số nhỏ trước)</label><input id="f-prio" value="' + E(r.prio) + '"></div><div><label>Trạng thái</label><select id="f-active">' + opts([["1", "Bật"], ["0", "Tắt"]], String(r.active == null ? 1 : r.active)) + "</select></div>"
      : '<div><label>Mã CTKM</label><input id="f-code" value="' + E(r.code) + '"></div><div><label>SKU</label><input id="f-sku" value="' + E(r.sku) + '"></div><div class="w2"><label>Tên SP</label><input id="f-name" value="' + E(r.name) + '"></div>' +
      '<div><label>Vai trò</label><select id="f-role">' + opts([["mua", "mua"], ["tặng", "tặng"]], r.role || "mua") + '</select></div><div><label>SKU tính giá (nếu SKU này không có giá riêng)</label><input id="f-psku" value="' + E(r.priceSku) + '"></div>' +
      '<div><label>Từ ngày</label><input type="date" id="f-from" value="' + E(r.from) + '"></div><div><label>Đến ngày</label><input type="date" id="f-to" value="' + E(r.to) + '"></div><div><label>Trạng thái</label><select id="f-active">' + opts([["1", "Bật"], ["0", "Tắt"]], String(r.active == null ? 1 : r.active)) + '</select></div><div class="w2"><label>Ghi chú</label><input id="f-note" value="' + E(r.note) + '"></div>') +
      '</div><div id="f-err"></div><div class="bar" style="margin-top:8px"><span class="sp"></span><button data-d="x">Hủy</button><button class="p" data-d="csave">Lưu</button></div>';
    dlg.dataset.id = r.id || ""; dlg.dataset.kind = kind; dlg.showModal();
  }
  function cfgSave() {
    var kind = dlg.dataset.kind, v = function (i) { var e = q("#f-" + i); return e ? e.value : ""; }, row = kind === "cc" ?
      { id: dlg.dataset.id, month: v("month"), code: v("code"), name: v("name"), kind: v("kind"), group: v("group"), buy: v("buy"), gift: v("gift"), unit: v("unit"), factor: v("factor"), from: v("from"), to: v("to"), prio: v("prio"), active: v("active") } :
      { id: dlg.dataset.id, code: v("code"), sku: v("sku"), name: v("name"), role: v("role"), priceSku: v("psku"), from: v("from"), to: v("to"), active: v("active"), note: v("note") };
    post(kind + ".save", { row: row }).then(function (j) { if (!j.ok) { q("#f-err").innerHTML = errList(j.errors || [{ msg: j.error }]); return; } dlg.close(); flash("Đã lưu."); load(); }).catch(function (e) { q("#f-err").innerHTML = errList([{ msg: e.message }]); });
  }

  /* ---------- Sự kiện chung ---------- */
  sec.addEventListener("input", function (e) { var t = e.target; if (t.id === "tbq") { S.tbq = t.value; S.page.tb = 0; rer("tbq"); } else if (t.id === "gq") { S.gq = t.value; S.page.gia = 0; rer("gq"); } else if (t.id === "cq") { S.cq = t.value; S.page.cc = 0; rer("cq"); } else if (t.id === "mq") { S.mq = t.value; S.page.map = 0; rer("mq"); } });
  function rer(keep) { var el = q("#" + keep), pos = el.selectionStart; render(); var n = q("#" + keep); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }
  sec.addEventListener("change", function (e) {
    var t = e.target, id = t.id;
    if (id === "tbm") { S.tbm = t.value; S.page.tb = 0; render(); } else if (id === "tbt") { S.tbt = t.value; S.page.tb = 0; render(); }
    else if (id === "gm") { S.month = t.value; S.page.gia = 0; render(); } else if (id === "gold") { S.old = t.checked; render(); }
    else if (id === "cm") { S.cm = t.value; S.page.cc = 0; render(); } else if (id === "ck") { S.ck = t.value; S.page.cc = 0; render(); } else if (id === "mc") { S.mc = t.value; S.page.map = 0; render(); }
  });
  sec.addEventListener("click", function (e) {
    var th = e.target.closest("th[data-sort]"); if (th) { var p = th.dataset.sort.split(":"), s = S.sort[p[0]]; S.sort[p[0]] = s && s.k === p[1] ? { k: p[1], d: -s.d } : { k: p[1], d: 1 }; render(); return; }
    var pg = e.target.closest("[data-pg]"); if (pg) { var a = pg.dataset.pg.split(":"); S.page[a[0]] = (S.page[a[0]] || 0) + (+a[1]); render(); return; }
    var sb = e.target.closest("#csub button"); if (sb) { S.sub = sb.dataset.v; S.cimp = null; render(); return; }
    var b = e.target.closest("[data-a]"); if (!b) return; var act = b.dataset.a, id = b.dataset.id;
    if (act === "tb-new") tbForm(); else if (act === "tb-edit") tbForm(find("tb", id)); else if (act === "tb-drive") tbDrive();
    else if (act === "tb-open") openPdf(find("tb", id), "tab"); else if (act === "tb-view") openPdf(find("tb", id), "view"); else if (act === "tb-dl") openPdf(find("tb", id), "dl");
    else if (act === "tb-del") { var r = find("tb", id); if (confirm("Xóa thông báo " + r.no + " - " + r.name + "?\nChỉ xóa thông tin trên web, file PDF trên Drive được giữ nguyên.")) post("tb.delete", { id: id }).then(function (j) { flash(j.ok ? "Đã xóa thông báo." : E(j.error), j.ok ? "" : "err"); load(); }); }
    else if (act === "tb-recheck") { busy("Đang kiểm tra các file trên Drive..."); post("tb.recheck", {}).then(function (j) { flash(j.ok ? "Đã kiểm tra " + j.total + " thông báo, " + j.changed + " thay đổi trạng thái file." : E(j.error), j.ok ? "" : "err"); load(); }); }
    else if (act === "tb-xl") xl([["Thong bao CTKM", [["Tháng", "Số thông báo", "Tên CTKM", "Nội dung", "Hình thức", "Bắt đầu", "Kết thúc", "Link Drive", "Trạng thái file", "Cập nhật"]].concat(tbRows().map(function (r) { return [r.month, r.no, r.name, r.content, r.type, r.from, r.to, r.url, r.fstatus, r.updated]; }))]], "thong-bao-ctkm");
    else if (act === "g-imp") { S.impOpen = !S.impOpen; var gi = q("#gimp"); if (gi) gi.hidden = !S.impOpen; }
    else if (act === "g-edit") giaForm(find("gia", id));
    else if (act === "g-xl") xl([["Bang gia NPP", [["Tháng", "NPP", "SKU", "Tên sản phẩm", "Nhóm", "ĐVT", "Quy cách", "Giá thùng", "Giá lẻ", "Hiệu lực từ", "Hiệu lực đến", "Dùng cho CTTB", "Phiên bản", "Trạng thái"]].concat(giaRows().map(function (r) { return [r.month, r.npp, r.sku, r.name, r.group, r.unit, r.spec, r.priceCase, r.priceUnit, r.from, r.to, r.use, r.ver, r.status]; }))]], "bang-gia-npp-" + S.month);
    else if (act === "c-fromct") cFromCt(); else if (act === "c-imp") cImp("cc"); else if (act === "m-imp") cImp("map");
    else if (act === "c-new") cfgForm("cc"); else if (act === "c-edit") cfgForm("cc", find("cc", id)); else if (act === "m-new") cfgForm("map"); else if (act === "m-edit") cfgForm("map", find("map", id));
    else if (act === "c-tog" || act === "m-tog") { var tk = act === "c-tog" ? "cc" : "map", row = Object.assign({}, find(tk, id)); row.active = row.active ? 0 : 1; post(tk + ".save", { row: row }).then(function (j) { flash(j.ok ? "Đã cập nhật trạng thái." : "Lỗi: " + E((j.errors || [{ msg: j.error }])[0].msg), j.ok ? "" : "err"); load(); }); }
    else if (act === "c-del" || act === "m-del") { var tk2 = act === "c-del" ? "cc" : "map"; if (confirm("Xóa dòng này?")) post(tk2 + ".delete", { id: id }).then(function (j) { flash(j.ok ? "Đã xóa." : E(j.error), j.ok ? "" : "err"); load(); }); }
    else if (act === "c-xl") xl([["Co che KM", [["Tháng", "Mã CTKM", "Loại", "Tên chương trình", "Nhóm CTKM", "SL mua", "SL tặng", "ĐVT", "Quy đổi (lẻ/ĐVT)", "Từ ngày", "Đến ngày", "Ưu tiên", "Active", "Ghi chú"]].concat(ccRows().map(function (r) { return [r.month, r.code, r.kind, r.name, r.group, r.buy, r.gift, r.unit, r.factor, r.from, r.to, r.prio, r.active, r.note]; }))]], "co-che-km");
    else if (act === "m-xl") xl([["Mapping SKU", [["Mã CTKM", "SKU", "Tên SP", "Vai trò", "SKU tính giá", "Từ ngày", "Đến ngày", "Active", "Nguồn", "Ghi chú"]].concat(mapRows().map(function (r) { return [r.code, r.sku, r.name, r.role, r.priceSku, r.from, r.to, r.active, r.src, r.note]; }))]], "mapping-sku");
    else if (act === "chk-run") runCheck();
  });
  window.M4UI = { show: show, state: S };
})();
