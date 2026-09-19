(function () {
  var P_PLAYER = 0, P_POS = 1, P_TEAM = 2, P_SEASON = 3, P_KIND = 4,
      P_PRICE = 5, P_STARTED = 6, P_POINTS = 7, P_PER = 8;
  var LIMIT = 40;
  var ROWS = [], best = true;
  // Column sort, when the reader has clicked a heading. null means "rank by
  // value", which is what the two buttons restore.
  var sortCol = null, sortDesc = true;
  var el = function (id) { return document.getElementById(id); };

  function matches() {
    var q = el("vq").value.trim().toLowerCase();
    var pos = el("vpos").value, team = el("vteam").value;
    var season = el("vseason").value, kind = el("vkind").value;
    var minp = parseInt(el("vminp").value, 10) || 0;
    return ROWS.filter(function (r) {
      if (q && r[P_PLAYER].toLowerCase().indexOf(q) === -1) return false;
      if (pos && r[P_POS] !== pos) return false;
      if (team && r[P_TEAM] !== team) return false;
      if (season && String(r[P_SEASON]) !== season) return false;
      if (kind && r[P_KIND] !== kind) return false;
      if (r[P_PRICE] < minp) return false;
      return true;
    });
  }

  function render() {
    var rows = matches();
    // SORT THE WHOLE FILTERED SET, then slice. Reordering the rendered rows
    // instead only ever sorted the 40 already-value-ranked rows on screen --
    // which is precisely why clicking Price appeared to do nothing useful.
    if (sortCol === null) {
      rows.sort(function (a, b) {
        return best ? b[P_PER] - a[P_PER] : a[P_PER] - b[P_PER];
      });
    } else {
      rows.sort(function (a, b) {
        var x = a[sortCol], y = b[sortCol], c;
        if (typeof x === "number" && typeof y === "number") c = x - y;
        else c = String(x).localeCompare(String(y), undefined,
                                         { numeric: true });
        return sortDesc ? -c : c;
      });
    }
    el("vsummary").textContent =
      rows.length.toLocaleString() + " draft slots" +
      (sortCol !== null ? ", sorted by column"
       : best ? ", best value first" : ", worst value first");

    var body = el("vresults").tBodies[0];
    body.textContent = "";
    rows.slice(0, LIMIT).forEach(function (r) {
      var tr = document.createElement("tr");
      [r[P_PLAYER], r[P_POS], r[P_TEAM], r[P_SEASON], r[P_KIND],
       "$" + r[P_PRICE], r[P_STARTED], r[P_POINTS],
       r[P_PER]].forEach(function (v, i) {
        var td = document.createElement("td");
        if (i >= 5) td.className = "num";
        td.textContent = v;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    el("vmore").textContent = rows.length > LIMIT
      ? "Showing " + LIMIT + " of " + rows.length + "."
      : "";
  }

  function fill(select, values) {
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = v;
      select.appendChild(o);
    });
  }

  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (v) {
      if (v !== "" && !seen[v]) { seen[v] = 1; out.push(v); }
    });
    return out;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var tag = document.getElementById("value-data");
    if (!tag) return;
    try { ROWS = JSON.parse(tag.textContent); }
    catch (e) { el("vsummary").textContent = "Could not load."; return; }

    fill(el("vpos"), uniq(ROWS.map(function (r) { return r[P_POS]; })).sort());
    fill(el("vteam"),
         uniq(ROWS.map(function (r) { return r[P_TEAM]; })).sort());
    fill(el("vseason"),
         uniq(ROWS.map(function (r) { return r[P_SEASON]; })).sort().reverse());

    ["vq", "vpos", "vteam", "vseason", "vkind", "vminp"]
      .forEach(function (id) {
      el(id).addEventListener("input", render);
      el(id).addEventListener("change", render);
    });
    // Clicking a heading sorts the FULL filtered set by that column.
    var head = el("vresults").tHead;
    if (head) {
      Array.prototype.forEach.call(head.rows[0].cells, function (th) {
        var c = th.getAttribute("data-c");
        if (c === null) return;
        th.style.cursor = "pointer";
        th.addEventListener("click", function () {
          var n = parseInt(c, 10);
          if (sortCol === n) { sortDesc = !sortDesc; }
          else { sortCol = n; sortDesc = true; }
          render();
        });
      });
    }
    el("vbest").addEventListener("click", function () {
      best = true; sortCol = null; el("vminp").value = 0; render();
    });
    el("vworst").addEventListener("click", function () {
      // Worst value needs a price floor, or the list is all $1 fliers that
      // never played -- every roster has several and they bury the real
      // mistake, which is the expensive one.
      best = false; sortCol = null; el("vminp").value = 10; render();
    });
    render();
  });
})();
