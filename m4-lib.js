/* M4 · Thư viện đọc file Excel (thuần JS, không đụng DOM). Dùng ở trình duyệt (window.M4LIB) và Node (test). */
(function (root) {
  "use strict";
  var str = function (v) { return v === null || v === undefined ? "" : String(v).replace(/_x[0-9a-fA-F]{4}_/g, " ").replace(/[\u0000-\u001f ]/g, " ").replace(/\s+/g, " ").trim(); };
  var norm = function (s) { return str(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toUpperCase(); };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var lastDay = function (y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

  function findHeader(aoa, needs, maxRows) {
    for (var i = 0; i < Math.min(aoa.length, maxRows || 30); i++) {
      var h = (aoa[i] || []).map(norm);
      if (needs.every(function (k) { return h.some(function (c) { return c.indexOf(k) >= 0; }); })) return i;
    }
    return -1;
  }
  function colOf(h, keys, from) { for (var i = from || 0; i < h.length; i++) for (var j = 0; j < keys.length; j++) if (h[i].indexOf(keys[j]) >= 0) return i; return -1; }

  /** Bảng giá NPP (mẫu của Trade: tiêu đề 2 tầng, dòng tiêu đề nhóm, 1 ô có thể chứa 2 mã "A / B"). */
  function parsePriceAoa(aoa) {
    var hi = findHeader(aoa, ["MA HANG", "TEN SAN PHAM"]);
    if (hi < 0) return { rows: [], errors: [{ line: 0, msg: "Không tìm thấy cột MÃ HÀNG / TÊN SẢN PHẨM." }], sections: [] };
    var h = aoa[hi].map(norm), sub = (aoa[hi + 1] || []).map(norm);
    var c = { code: colOf(h, ["MA HANG"]), group: colOf(h, ["LOAI HANG"]), name: colOf(h, ["TEN SAN PHAM"]), unit: colOf(h, ["DVT"]), spec: colOf(h, ["QUY CACH"]),
      npp: colOf(h, ["MA NPP"]), nppName: colOf(h, ["TEN NPP"]), from: colOf(h, ["HIEU LUC TU", "NGAY HIEU LUC"]), to: colOf(h, ["HIEU LUC DEN", "HET HIEU LUC"]),
      use: colOf(h, ["CTTB", "TRUNG BAY", "QUY DOI", "DUNG CHO"]) };
    var pc = colOf(h, ["GIA THUNG"]), pu = colOf(h, ["GIA LE"]), p0 = colOf(h, ["GIA NPP", "GIA BAN"]);
    var hasSub = sub.some(function (x) { return x.indexOf("THUNG") >= 0; });
    if (pc < 0 && p0 >= 0) { // tiêu đề giá nằm ở ô gộp, 2 cột con "Thùng" và "Gói/cây/hộp/túi"
      for (var j = Math.max(p0 - 1, 0); j < sub.length; j++) { if (pc < 0 && sub[j].indexOf("THUNG") >= 0) pc = j; if (pu < 0 && /GOI|CAY|HOP|TUI|LE/.test(sub[j]) && sub[j].indexOf("THUNG") < 0) pu = j; }
    }
    var errors = [], rows = [], sections = [];
    if (c.code < 0 || c.name < 0) errors.push({ line: 0, msg: "Thiếu cột MÃ HÀNG hoặc TÊN SẢN PHẨM." });
    if (pc < 0 && pu < 0) errors.push({ line: 0, msg: "Không tìm thấy cột giá (Thùng / Gói-cây-hộp-túi)." });
    if (errors.length) return { rows: [], errors: errors, sections: [] };
    for (var i = hi + (hasSub ? 2 : 1); i < aoa.length; i++) {
      var r = aoa[i] || [], code = str(r[c.code]), name = str(r[c.name]);
      if (!code && !name) continue;
      if (!name && !str(c.group >= 0 ? r[c.group] : "")) { sections.push(code); continue; } // dòng tiêu đề nhóm, vd "THỨC UỐNG DINH DƯỠNG (VAT 8% - 10%)"
      var codes = code.split("/").map(str).filter(Boolean);
      if (!codes.length) { errors.push({ line: i + 1, msg: "Thiếu mã hàng (" + name + ")." }); continue; }
      codes.forEach(function (sku) {
        rows.push({ line: i + 1, sku: sku, name: name, group: c.group >= 0 ? str(r[c.group]) : "", unit: c.unit >= 0 ? str(r[c.unit]) : "", spec: c.spec >= 0 ? str(r[c.spec]) : "",
          priceCase: pc >= 0 ? r[pc] : "", priceUnit: pu >= 0 ? r[pu] : "", npp: c.npp >= 0 ? str(r[c.npp]) : "", nppName: c.nppName >= 0 ? str(r[c.nppName]) : "",
          from: c.from >= 0 ? r[c.from] : "", to: c.to >= 0 ? r[c.to] : "", use: c.use >= 0 ? str(r[c.use]) : "" });
      });
    }
    return { rows: rows, errors: errors, sections: sections, hasUseColumn: c.use >= 0 };
  }

  /** File CTKM tháng: Mã Khuyến Mãi | Tên CTKM | Nhóm CTKM. */
  function parseCtkmAoa(aoa) {
    var hi = findHeader(aoa, ["MA KHUYEN MAI", "TEN CTKM"]);
    if (hi < 0) return { items: [], errors: [{ line: 0, msg: "Không tìm thấy cột Mã Khuyến Mãi / Tên CTKM." }] };
    var h = aoa[hi].map(norm), a = colOf(h, ["MA KHUYEN MAI"]), b = colOf(h, ["TEN CTKM"]), g = colOf(h, ["NHOM CTKM"]), items = [];
    for (var i = hi + 1; i < aoa.length; i++) { var r = aoa[i] || [], code = str(r[a]); if (code) items.push({ line: i + 1, code: code, name: str(r[b]), group: g >= 0 ? str(r[g]) : "" }); }
    return { items: items, errors: [] };
  }

  /** "MUA 17 CÂY ... TẶNG 3 CÂY" -> {buy, gift, unit} hoặc null. */
  var UNITS = "CÂY|TÚI|HỘP|LỐC|GÓI|THÙNG|TH|KHAY|HQT";
  function parseMechanic(name) {
    var s = str(name).toUpperCase();
    var m = s.match(new RegExp("MUA\\s+0*(\\d+)\\s*(" + UNITS + ")?\\b.*?T[ẶA]NG\\s+(?:TH[ÊE]M\\s+)?0*(\\d+)\\s*(" + UNITS + ")?\\b"));
    if (!m) return null;
    return { buy: +m[1], gift: +m[3], unit: m[2] || m[4] || "" };
  }
  /** "(áp dụng date T11,12/2026)" -> {from,to}; không có -> cả tháng. */
  function parseDateRange(name, month) {
    var m = str(name).toUpperCase().match(/T(\d{1,2})(?:\s*[,\-–.]\s*(\d{1,2}))?\s*\/\s*(\d{4})/);
    if (m) { var y = +m[3], a = +m[1], b = m[2] ? +m[2] : a; return { from: y + "-" + pad(a) + "-01", to: y + "-" + pad(b) + "-" + pad(lastDay(y, b)) }; }
    var y2 = +month.slice(0, 4), mm = +month.slice(5, 7); return { from: month + "-01", to: month + "-" + pad(lastDay(y2, mm)) };
  }
  var KIND_BY_GROUP = [[/^BASIC\b/, "basic"], [/^CAN DATE\b/, "clear_date"]];
  /** Đề xuất bảng cơ chế KM từ file CTKM tháng: Basic / Cận date bật sẵn, mua-X-tặng-Y của ngành khác nhập ở trạng thái TẮT. */
  function proposeMechanics(items, month) {
    var rows = [], skipped = [], errors = [];
    items.forEach(function (it) {
      var g = norm(it.group), kind = "", k;
      for (k = 0; k < KIND_BY_GROUP.length; k++) if (KIND_BY_GROUP[k][0].test(g)) kind = KIND_BY_GROUP[k][1];
      if (!kind) { if (/^(ON TOP|SHOP SUA)/.test(g)) { skipped.push(it); return; } kind = "other"; }
      var mech = parseMechanic(it.name);
      if (!mech) { if (kind === "other") { skipped.push(it); return; } errors.push({ line: it.line, msg: it.code + ": không đọc được 'mua X tặng Y' từ tên chương trình." }); return; }
      var d = parseDateRange(it.name, month), unit = mech.unit ? mech.unit.toLowerCase() : "";
      rows.push({ line: it.line, month: month, code: it.code, kind: kind, name: it.name, group: it.group, buy: mech.buy, gift: mech.gift, unit: unit,
        factor: unit === "lốc" ? 4 : 1, from: d.from, to: d.to, prio: kind === "clear_date" ? 1 : 2, active: kind === "other" ? 0 : 1,
        note: unit === "lốc" ? "1 lốc = 4 hộp" : "" });
    });
    return { rows: rows, skipped: skipped, errors: errors };
  }

  /** Import bảng cấu hình (Cơ chế KM / Mapping SKU) từ Excel: tiêu đề cột = tên cột của sheet. */
  var TPL = {
    cc: { month: ["THANG"], code: ["MA CTKM"], kind: ["LOAI"], name: ["TEN CHUONG TRINH"], group: ["NHOM CTKM"], buy: ["SL MUA"], gift: ["SL TANG"], unit: ["DVT"], factor: ["QUY DOI"], from: ["TU NGAY"], to: ["DEN NGAY"], prio: ["UU TIEN"], active: ["ACTIVE"], note: ["GHI CHU"] },
    map: { code: ["MA CTKM"], sku: ["SKU"], name: ["TEN SP"], role: ["VAI TRO"], priceSku: ["SKU TINH GIA"], from: ["TU NGAY"], to: ["DEN NGAY"], active: ["ACTIVE"], src: ["NGUON"], note: ["GHI CHU"] }
  };
  function parseTemplateAoa(aoa, kind) {
    var spec = TPL[kind], need = kind === "cc" ? ["MA CTKM", "SL MUA"] : ["MA CTKM", "SKU"], hi = findHeader(aoa, need);
    if (hi < 0) return { rows: [], errors: [{ line: 0, msg: "Không tìm thấy dòng tiêu đề (cần cột: " + need.join(", ") + ")." }] };
    var h = aoa[hi].map(norm), idx = {};
    Object.keys(spec).forEach(function (k) { idx[k] = colOf(h, spec[k]); });
    var rows = [];
    for (var i = hi + 1; i < aoa.length; i++) {
      var r = aoa[i] || [], o = { line: i + 1 }, any = false;
      Object.keys(idx).forEach(function (k) { var v = idx[k] >= 0 ? r[idx[k]] : ""; o[k] = typeof v === "number" ? v : str(v); if (str(v) !== "") any = true; });
      if (any) rows.push(o);
    }
    return { rows: rows, errors: [] };
  }

  /** Excel serial / Date / chuỗi -> "yyyy-MM-dd" (dùng khi SheetJS trả về số hoặc Date). */
  function excelDate(v) {
    if (v instanceof Date) return v.getFullYear() + "-" + pad(v.getMonth() + 1) + "-" + pad(v.getDate());
    if (typeof v === "number" && v > 20000 && v < 80000) { var t = new Date(Math.round((v - 25569) * 86400000)); return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate()); }
    return str(v);
  }

  root.M4LIB = { parsePriceAoa: parsePriceAoa, parseCtkmAoa: parseCtkmAoa, parseMechanic: parseMechanic, parseDateRange: parseDateRange, proposeMechanics: proposeMechanics, parseTemplateAoa: parseTemplateAoa, excelDate: excelDate, norm: norm, str: str };
  if (typeof module !== "undefined" && module.exports) module.exports = root.M4LIB;
})(typeof window !== "undefined" ? window : globalThis);
