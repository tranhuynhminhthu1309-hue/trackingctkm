/* M4 · Tính CTKM Basic / Cận date theo TỪNG ĐƠN từ BC 5.1 (thuần JS, không đụng DOM). Dùng ở trình duyệt (window.M4CALC) và Node (test).
 * Quy tắc đã chốt:
 *  - Mỗi chương trình tính riêng từng đơn hàng: suất = FLOOR(SL mua đủ điều kiện / SL yêu cầu), hàng KM = suất × SL tặng. Không cộng dồn giữa các đơn.
 *  - "Đủ điều kiện" = dòng Hàng Bán mang mã CTKM đó (cột Mã Khuyến Mãi) VÀ SKU nằm trong mapping (vai trò "mua") đang bật. SKU lạ không được đoán: báo cảnh báo.
 *  - Trả hàng (KH Trả Hàng Bán, SL âm): trừ vào đơn gốc (cột Số Đơn hàng Gốc).
 *  - Tháng, thời gian chương trình, giá: theo Ngày đặt hàng của đơn gốc. Giá theo NPP + SKU + ngày hiệu lực; thiếu giá -> cảnh báo, tiền = 0, KHÔNG lấy giá khác.
 *  - Đối chiếu với số lượng hàng KM hệ thống: dòng Hàng KM + KH Trả Hàng KM có mã chương trình đó. */
(function (root) {
  "use strict";
  var str = function (v) { return v === null || v === undefined ? "" : String(v).replace(/_x[0-9a-fA-F]{4}_/g, " ").replace(/[\u0000-\u001f ]/g, " ").replace(/\s+/g, " ").trim(); };
  var norm = function (s) { return str(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toUpperCase(); };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  function num(v) { if (typeof v === "number") return v; var s = str(v).replace(/,/g, ""); if (s === "") return NaN; var n = Number(s); return isNaN(n) ? NaN : n; }

  /** "MM-DD-YYYY" (định dạng của BC 5.1), "DD/MM/YYYY" khi số đầu > 12, "yyyy-MM-dd", số serial Excel, Date -> "yyyy-MM-dd" ("" nếu không đọc được). */
  function isoDate(v) {
    if (v instanceof Date && !isNaN(v)) return v.getFullYear() + "-" + pad(v.getMonth() + 1) + "-" + pad(v.getDate());
    if (typeof v === "number" && v > 20000 && v < 80000) { var t = new Date(Math.round((v - 25569) * 86400000)); return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate()); }
    var s = str(v), m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + "-" + pad(+m[2]) + "-" + pad(+m[3]);
    m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
    if (m) { var a = +m[1], b = +m[2], mo = a, d = b; if (a > 12 && b <= 12) { mo = b; d = a; } if (mo < 1 || mo > 12 || d < 1 || d > 31) return ""; return m[3] + "-" + pad(mo) + "-" + pad(d); }
    return "";
  }

  /* ---------- Đọc BC 5.1 ---------- */
  var KIND = { "HANG BAN": "sale", "KH TRA HANG BAN": "ret", "HANG KM": "km", "KH TRA HANG KM": "kmret" };
  function parseBc51(aoa) {
    var hi = -1, h;
    for (var i = 0; i < Math.min(aoa.length, 30); i++) { h = (aoa[i] || []).map(norm); if (h.indexOf("SO DON HANG") >= 0 && h.indexOf("MA SAN PHAM") >= 0 && h.indexOf("LOAI HANG") >= 0) { hi = i; break; } }
    if (hi < 0) return { lines: [], errors: [{ line: 0, msg: "Không tìm thấy dòng tiêu đề BC 5.1 (cần cột Số Đơn Hàng, Mã Sản Phẩm, Loại Hàng)." }] };
    h = aoa[hi].map(norm);
    var col = function (keys) { for (var k = 0; k < keys.length; k++) { var j = h.indexOf(keys[k]); if (j >= 0) return j; } return -1; };
    var c = { no: col(["SO DON HANG"]), orig: col(["SO DON HANG GOC"]), sku: col(["MA SAN PHAM"]), name: col(["TEN SAN PHAM"]), kind: col(["LOAI HANG"]), qty: col(["TONG SO LUONG LE"]), codes: col(["MA KHUYEN MAI"]),
      date: col(["NGAY DAT HANG"]), grp: col(["NHOM HANG"]), amt: col(["DOANH SO"]), npp: col(["MA NPP"]), nppName: col(["TEN NPP"]), vung: col(["TEN VUNG"]), kh: col(["MA KH"]), khName: col(["TEN KH"]) };
    var need = { no: "Số Đơn Hàng", sku: "Mã Sản Phẩm", kind: "Loại Hàng", qty: "Tổng Số Lượng Lẻ", codes: "Mã Khuyến Mãi", date: "Ngày Đặt Hàng", npp: "Mã NPP", vung: "Tên vùng" }, errors = [];
    Object.keys(need).forEach(function (k) { if (c[k] < 0) errors.push({ line: hi + 1, msg: "Thiếu cột \"" + need[k] + "\"." }); });
    if (errors.length) return { lines: [], errors: errors };
    var lines = [], badDate = 0, badQty = 0, other = 0, ids = {};
    var salesCols = c.amt >= 0 && c.grp >= 0;
    for (var r = hi + 1; r < aoa.length; r++) {
      var x = aoa[r] || []; if (!str(x[c.no]) && !str(x[c.sku])) continue;
      var kd = KIND[norm(x[c.kind])]; if (!kd) { other++; continue; }
      var q = num(x[c.qty]); if (isNaN(q)) { badQty++; continue; }
      var dt = isoDate(x[c.date]); if (!dt) badDate++;
      var codes = str(x[c.codes]).split(",").map(str).filter(Boolean);
      var am = c.amt >= 0 ? num(x[c.amt]) : 0;
      lines.push({ line: r + 1, no: str(x[c.no]), amt: isNaN(am) ? 0 : am, grp: c.grp >= 0 ? str(x[c.grp]) : "", orig: c.orig >= 0 ? str(x[c.orig]) : "", sku: str(x[c.sku]), name: c.name >= 0 ? str(x[c.name]) : "", kind: kd, qty: q, codes: codes, date: dt,
        npp: str(x[c.npp]), nppName: c.nppName >= 0 ? str(x[c.nppName]) : "", vung: str(x[c.vung]), kh: c.kh >= 0 ? str(x[c.kh]) : "", khName: c.khName >= 0 ? str(x[c.khName]) : "" });
    }
    var w = [];
    if (!salesCols) w.push({ level: "warn", msg: "File thiếu cột \"Doanh Số\" hoặc \"Nhóm hàng\": chưa tính được doanh số tổng và tỷ trọng nhóm hàng." });
    if (badDate) w.push({ level: "warn", msg: badDate + " dòng không đọc được Ngày Đặt Hàng (các đơn đó bị loại khỏi tính)." });
    if (badQty) w.push({ level: "warn", msg: badQty + " dòng thiếu Tổng Số Lượng Lẻ, đã bỏ qua." });
    return { lines: lines, errors: [], warnings: w, ignoredKinds: other, rows: aoa.length - hi - 1 };
  }

  /* ---------- Tra giá theo NPP + SKU + ngày (cùng quy tắc m4PriceAt ở m4_core.gs) ---------- */
  function priceAt(prices, npp, sku, dateISO) {
    var best = null, conflict = false;
    for (var i = 0; i < prices.length; i++) {
      var p = prices[i]; if (p.status && p.status !== "active") continue; if (p.sku !== sku) continue;
      var pn = p.npp || "ALL"; if (pn !== "ALL" && pn !== npp) continue;
      if (p.from && dateISO < p.from) continue; if (p.to && dateISO > p.to) continue;
      var rank = (pn === npp ? 2 : 1);
      if (!best || rank > best.rank || (rank === best.rank && p.from > best.p.from)) { best = { p: p, rank: rank }; conflict = false; }
      else if (rank === best.rank && p.from === best.p.from && p.priceUnit !== best.p.priceUnit) conflict = true;
    }
    return best ? { price: best.p, conflict: conflict } : null;
  }

  /* ---------- Tính ---------- */
  /** opts: {month, mechs:[cc rows], maps:[map rows], prices:[gia rows], regions:{vung->mien} (khóa đã norm)}; lines từ parseBc51. */
  function calc(lines, opts) {
    var month = opts.month, warnings = [], mechs = {}, order = [];
    (opts.mechs || []).forEach(function (m) {
      if (m.month !== month || !Number(m.active) || (m.kind !== "basic" && m.kind !== "clear_date")) return;
      var f = Number(m.factor) || 1, req = Number(m.buy) * f, gift = Number(m.gift) * f;
      if (!(req > 0) || !(gift > 0)) { warnings.push({ level: "error", msg: m.code + ": cơ chế mua " + m.buy + " tặng " + m.gift + " không hợp lệ, bỏ qua." }); return; }
      mechs[m.code] = { code: m.code, kind: m.kind, name: m.name, group: m.group, buy: Number(m.buy), gift: Number(m.gift), unit: m.unit, factor: f, req: req, giftPer: gift, from: m.from || "", to: m.to || "", prio: Number(m.prio) || 9, mua: {}, nMua: 0 };
      order.push(m.code);
    });
    (opts.maps || []).forEach(function (r) { var m = mechs[r.code]; if (!m || !Number(r.active) || r.role !== "mua") return; (m.mua[r.sku] = m.mua[r.sku] || []).push({ priceSku: r.priceSku || r.sku, from: r.from || "", to: r.to || "" }); m.nMua++; });
    order.forEach(function (c) { if (!mechs[c].nMua) warnings.push({ level: "warn", msg: mechs[c].code + ": chưa có SKU 'mua' nào được bật trong Mapping, chương trình hiển thị 0 cho đến khi Admin xác nhận mapping." }); });

    // 1) Gom dòng theo đơn gốc. Đơn gốc = Số Đơn Hàng (dòng bán) hoặc Số Đơn hàng Gốc (dòng trả hàng).
    var meta = {}, groups = {}, sys = {}, noOrig = 0, retNet = 0, unmapped = {}, outPeriod = {}, multi = 0, skipDate = 0, outMonth = 0;
    function ordOf(l) { return (l.kind === "ret" || l.kind === "kmret") && l.orig ? l.orig : l.no; }
    lines.forEach(function (l) { if ((l.kind === "sale" || l.kind === "km") && !meta[l.no]) meta[l.no] = { date: l.date, npp: l.npp, nppName: l.nppName, vung: l.vung, kh: l.kh, khName: l.khName }; });
    lines.forEach(function (l) {
      var o = ordOf(l), mt = meta[o];
      if (l.kind === "km" || l.kind === "kmret") { l.codes.forEach(function (c) { if (mechs[c]) { var k = o + "\t" + c; sys[k] = (sys[k] || 0) + l.qty; } }); return; }
      if (!mt) { if (l.kind === "ret") noOrig++; if (l.kind === "ret") return; }
      mt = mt || meta[l.no]; if (!mt) return;
      var cs = l.codes.filter(function (c) { return mechs[c]; });
      if (!cs.length) return;
      if (cs.length > 1) { // 1 dòng thuộc nhiều chương trình Basic/Cận date: chỉ tính cho chương trình ưu tiên cao nhất (số nhỏ hơn), tránh nhân đôi quà
        var inMap = cs.filter(function (c) { return mechs[c].mua[l.sku]; }); if (inMap.length > 1) { multi++; inMap.sort(function (a, b) { return mechs[a].prio - mechs[b].prio || (a < b ? -1 : 1); }); cs = [inMap[0]].concat(cs.filter(function (c) { return inMap.indexOf(c) < 0; })); }
      }
      cs.forEach(function (c, ci) {
        var m = mechs[c], k = o + "\t" + c, rule = m.mua[l.sku];
        if (cs.length > 1 && ci > 0 && rule && cs[0] !== c && mechs[cs[0]].mua[l.sku]) return; // đã tính ở chương trình ưu tiên
        if (!rule) { if (l.kind === "sale") { var u = unmapped[c] = unmapped[c] || { qty: 0, skus: {} }; u.qty += l.qty; u.skus[l.sku] = l.name || 1; } return; }
        var g = groups[k] = groups[k] || { o: o, c: c, elig: {}, ret: false }, d = mt.date;
        var ok = rule.some(function (r) { return (!r.from || d >= r.from) && (!r.to || d <= r.to); }); if (!ok) return;
        g.elig[l.sku] = (g.elig[l.sku] || 0) + l.qty; if (l.kind === "ret") { g.ret = true; retNet++; }
      });
    });

    // 2) Tính từng (đơn, chương trình)
    var rows = [], miss = {}, regions = opts.regions || {}, unRegion = {}, noPrice = {};
    var keys = {}; Object.keys(groups).forEach(function (k) { keys[k] = 1; }); Object.keys(sys).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).sort().forEach(function (k) {
      var p = k.split("\t"), o = p[0], c = p[1], m = mechs[c], mt = meta[o]; if (!mt) return;
      if (!mt.date) { skipDate++; return; }
      if (mt.date.slice(0, 7) !== month) { outMonth++; return; } // đơn đặt ngoài tháng đang tính (BC 5.1 có thể chứa nhiều tháng)
      var g = groups[k], elig = 0, top = "", topQ = -1;
      if (g) Object.keys(g.elig).sort().forEach(function (s) { var q = g.elig[s]; elig += q; if (q > topQ) { topQ = q; top = s; } });
      var inPeriod = (!m.from || mt.date >= m.from) && (!m.to || mt.date <= m.to), suat = 0;
      if (!inPeriod && g) { outPeriod[c] = (outPeriod[c] || 0) + 1; }
      if (inPeriod && elig >= m.req) suat = Math.floor(elig / m.req);
      var giftQty = suat * m.giftPer, sq = sys[k] || 0;
      if (!suat && !sq) return;
      var price = null, unit = 0, amount = 0, flag = [];
      if (suat) {
        var rule = m.mua[top] && m.mua[top][0], psku = rule ? rule.priceSku : top, pr = priceAt(opts.prices || [], mt.npp, psku, mt.date);
        if (!pr) { flag.push("nopr"); noPrice[c + "\t" + psku] = (noPrice[c + "\t" + psku] || 0) + giftQty; }
        else { unit = Number(pr.price.priceUnit); if (!(unit > 0)) { flag.push("nopr"); noPrice[c + "\t" + psku] = (noPrice[c + "\t" + psku] || 0) + giftQty; unit = 0; } else amount = Math.round(giftQty * unit); if (pr.conflict) flag.push("pconf"); }
        price = psku;
      }
      if (giftQty !== sq) flag.push("diff"); if (g && g.ret) flag.push("ret");
      var nk = norm(mt.vung), mien = regions[nk] || ""; if (!mien) unRegion[mt.vung] = 1;
      rows.push({ month: month, code: c, kind: m.kind, order: o, date: mt.date, npp: mt.npp, nppName: mt.nppName, vung: mt.vung, mien: mien, kh: mt.kh, khName: mt.khName, elig: elig, req: m.req, suat: suat, giftQty: giftQty, sysQty: sq, priceSku: price || "", price: unit, amount: amount, flag: flag.join(",") });
    });

    // 3) Tổng hợp theo (chương trình, NPP) và (chương trình, ngày, vùng)
    var A = {}, D = {};
    function bump(t, key, base, r) { var a = t[key] = t[key] || Object.assign({ orders: 0, suat: 0, giftQty: 0, amount: 0, sysQty: 0, missQty: 0, diffOrders: 0, sales: 0, salesQty: 0 }, base); if (r.suat > 0) a.orders++; a.suat += r.suat; a.giftQty += r.giftQty; a.amount += r.amount; a.sysQty += r.sysQty; if (r.flag.indexOf("nopr") >= 0) a.missQty += r.giftQty; if (r.giftQty !== r.sysQty) a.diffOrders++; }
    rows.forEach(function (r) {
      bump(A, r.code + "\t" + r.npp, { month: month, lv: "npp", code: r.code, kind: r.kind, key: r.npp, name: r.nppName, vung: r.vung, mien: r.mien }, r);
      bump(D, r.code + "\t" + r.date + "\t" + r.vung, { month: month, lv: "day", code: r.code, kind: r.kind, key: r.date, name: "", vung: r.vung, mien: r.mien }, r);
    });
    var agg = Object.keys(A).sort().map(function (k) { return A[k]; }).concat(Object.keys(D).sort().map(function (k) { return D[k]; }));

    // 3b) Doanh số tổng theo (NPP, nhóm hàng): Hàng Bán + KH Trả Hàng Bán (cột "Doanh Số"), tháng/NPP/vùng theo đơn gốc. Hàng KM và dòng chiết khấu nhóm không tính.
    var DS = {}, dsOrd = {}, dsNoOrig = 0, dsOut = 0, dsNoDate = 0;
    lines.forEach(function (l) {
      if (l.kind !== "sale" && l.kind !== "ret") return;
      var o = ordOf(l), mt = meta[o]; if (l.kind === "ret" && !mt) dsNoOrig++;
      var d = mt ? mt.date : l.date, npp = mt ? mt.npp : l.npp, nm = mt ? mt.nppName : l.nppName, vg = mt ? mt.vung : l.vung;
      if (!d) { dsNoDate++; return; } if (d.slice(0, 7) !== month) { dsOut++; return; }
      var g = l.grp || "(Chưa có nhóm hàng)", k = npp + "\t" + g, a = DS[k];
      if (!a) { var mien = regions[norm(vg)] || ""; if (!mien) unRegion[vg] = 1; a = DS[k] = { month: month, lv: "ds", code: g, kind: "all", key: npp, name: nm, vung: vg, mien: mien, orders: 0, suat: 0, giftQty: 0, amount: 0, sysQty: 0, missQty: 0, diffOrders: 0, sales: 0, salesQty: 0 }; }
      a.sales += l.amt; a.salesQty += l.qty; if (l.kind === "sale" && !dsOrd[k + "\t" + o]) { dsOrd[k + "\t" + o] = 1; a.orders++; }
    });
    Object.keys(DS).forEach(function (k) { DS[k].sales = Math.round(DS[k].sales); DS[k].salesQty = Math.round(DS[k].salesQty); });
    var dsRows = Object.keys(DS).sort().map(function (k) { return DS[k]; }); agg = agg.concat(dsRows);

    // 4) Cảnh báo
    Object.keys(unmapped).sort().forEach(function (c) { var u = unmapped[c]; warnings.push({ level: "warn", msg: c + ": có " + u.qty + " sản phẩm bán mang mã chương trình nhưng SKU chưa có trong Mapping (" + Object.keys(u.skus).slice(0, 5).join(", ") + (Object.keys(u.skus).length > 5 ? "…" : "") + "). Số này CHƯA được tính, hãy bổ sung mapping." }); });
    Object.keys(noPrice).sort().forEach(function (k) { var p = k.split("\t"); warnings.push({ level: "warn", msg: p[0] + ": thiếu giá NPP cho SKU " + p[1] + " (" + noPrice[k] + " sản phẩm hàng KM chưa có giá trị tiền). Không dùng giá của SKU hoặc NPP khác." }); });
    Object.keys(outPeriod).sort().forEach(function (c) { warnings.push({ level: "info", msg: c + ": " + outPeriod[c] + " đơn có Ngày đặt hàng ngoài thời gian chương trình (" + mechs[c].from + " → " + mechs[c].to + "), không tính." }); });
    if (noOrig) warnings.push({ level: "info", msg: noOrig + " dòng trả hàng không tìm thấy đơn gốc trong file (đơn gốc ở kỳ khác), không trừ được." });
    if (multi) warnings.push({ level: "info", msg: multi + " dòng thuộc nhiều chương trình Basic/Cận date cùng SKU: chỉ tính cho chương trình ưu tiên cao hơn." });
    if (outMonth) warnings.push({ level: "info", msg: outMonth + " (đơn, chương trình) có Ngày đặt hàng ngoài tháng " + month + ", không tính vào tháng này." });
    if (skipDate) warnings.push({ level: "warn", msg: skipDate + " (đơn, chương trình) bị bỏ qua do không có Ngày đặt hàng." });
    var ur = Object.keys(unRegion); if (ur.length) warnings.push({ level: "warn", msg: "Vùng chưa có trong bảng Định biên nên chưa gán được Miền: " + ur.slice(0, 8).join(", ") + (ur.length > 8 ? "…" : "") + "." });
    var S = { orders: 0, suat: 0, giftQty: 0, amount: 0, sysQty: 0, diffOrders: 0, missOrders: 0, programs: order.length, sales: 0, salesQty: 0 };
    dsRows.forEach(function (r) { S.sales += r.sales; S.salesQty += r.salesQty; });
    if (dsNoOrig) warnings.push({ level: "info", msg: dsNoOrig + " dòng trả hàng không tìm thấy đơn gốc trong file: doanh số trừ theo ngày của chính dòng trả hàng." });
    rows.forEach(function (r) { if (r.suat > 0) S.orders++; S.suat += r.suat; S.giftQty += r.giftQty; S.amount += r.amount; S.sysQty += r.sysQty; if (r.giftQty !== r.sysQty) S.diffOrders++; if (r.flag.indexOf("nopr") >= 0) S.missOrders++; });
    if (S.diffOrders) warnings.push({ level: "warn", msg: S.diffOrders + " (đơn, chương trình) có số hàng KM tính được khác số hàng KM hệ thống ghi nhận (xem cột Chênh lệch)." });
    return { rows: rows, agg: agg, summary: S, warnings: warnings, mechs: mechs, retNet: retNet };
  }

  root.M4CALC = { parseBc51: parseBc51, calc: calc, priceAt: priceAt, isoDate: isoDate, norm: norm };
  if (typeof module !== "undefined" && module.exports) module.exports = root.M4CALC;
})(typeof window !== "undefined" ? window : globalThis);
