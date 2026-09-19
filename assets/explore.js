(function () {
  var C_PLAYER = 0, C_TEAM = 1, C_SEASON = 2, C_DESIG = 3, C_SALARY = 4,
      C_STATUS = 5, C_FINAL = 6, C_ACQ = 7, C_TRANSIENT = 8,
      C_POINTS = 9, C_GAMES = 10, C_STARTED = 11;
  var D_PLAYER = 0, D_TEAM = 1, D_SEASON = 2, D_PRICE = 3, D_KIND = 4,
      D_POINTS = 5, D_GAMES = 6, D_STARTED = 7;
  var LIMIT = 300;
  var DATA = null, ROWS = [], sortKey = "season", sortAsc = false;

  var el = function (id) { return document.getElementById(id); };

  // A drafted player exists in BOTH tables: a contract year saying what he
  // cost and is designated, and a draft pick saying he occupied a slot.
  // MEASURED: 1,422 of 1,900 contract rows have a matching draft row, so
  // emitting both showed 75% of the ledger twice -- "Aaron Rodgers 2018
  // contract C1 $30" immediately above "Aaron Rodgers 2018 keeper $30".
  // They are MERGED on (franchise, player, season). The contract wins on
  // designation and salary because it carries the term; the draft row
  // contributes only how the slot was filled.
  function flatten(d) {
    var byKey = {}, out = [];
    function key(team, pid, season) { return team + "|" + pid + "|" + season; }

    d.contracts.forEach(function (r) {
      var row = {
        player: d.players[r[C_PLAYER]] || r[C_PLAYER],
        pid: r[C_PLAYER],
        pos: d.pos[r[C_PLAYER]] || "",
        team: d.teams[r[C_TEAM]] || r[C_TEAM],
        tid: r[C_TEAM],
        season: r[C_SEASON],
        kind: r[C_STATUS] === "active" ? "contract" : r[C_STATUS],
        acq: r[C_ACQ] || "—",
        // "C2F", the league's own shorthand, matching render.contract_term
        // on the roster and trade pages. Three spellings of one fact
        // existed until 2026-09-18: "C2 (final)" here and on rosters,
        // and a bare "C2" on the trades table, which lost the F
        // entirely and said a finished contract had years to run.
        desig: r[C_DESIG] + (r[C_FINAL] ? "F" : ""),
        amount: r[C_SALARY],
        points: r[C_GAMES] ? r[C_POINTS] : "",
        started: r[C_GAMES] ? r[C_STARTED] : "",
        games: r[C_GAMES] || "",
        ppg: r[C_GAMES] ? Math.round(r[C_POINTS] / r[C_GAMES] * 10) / 10 : "",
        group: "contract",
        transient: !!r[C_TRANSIENT]
      };
      byKey[key(r[C_TEAM], r[C_PLAYER], r[C_SEASON])] = row;
      out.push(row);
    });

    d.drafts.forEach(function (r) {
      var hit = byKey[key(r[D_TEAM], r[D_PLAYER], r[D_SEASON])];
      if (hit) {
        // Same fact, already represented. Record HOW the slot was filled and
        // do not emit a second row.
        //
        // The contract's salary is NOT backfilled from the draft price when
        // it is blank. An earlier version did, and it resurrected a figure
        // the project has already ruled wrong: Clyde Edwards-Helaire, F02,
        // 2021 has a DECLINED contract with no salary and a board row at
        // $51, and R80 settled that the option really was declined and the
        // board's $51 is the wrong side of that contradiction. A blank
        // salary means nothing was paid, which is the honest cell.
        hit.slot = r[D_KIND];
        return;
      }
      out.push({
        player: d.players[r[D_PLAYER]] || "(unidentified pick)",
        pid: r[D_PLAYER],
        pos: d.pos[r[D_PLAYER]] || "",
        team: d.teams[r[D_TEAM]] || r[D_TEAM],
        tid: r[D_TEAM],
        season: r[D_SEASON],
        kind: r[D_KIND],
        acq: r[D_KIND] === "keeper" ? "—" : "Draft",
        desig: "",
        amount: r[D_PRICE],
        points: r[D_GAMES] ? r[D_POINTS] : "",
        started: r[D_GAMES] ? r[D_STARTED] : "",
        games: r[D_GAMES] || "",
        ppg: r[D_GAMES] ? Math.round(r[D_POINTS] / r[D_GAMES] * 10) / 10 : "",
        group: "draft",
        transient: false
      });
    });
    return out;
  }

  function fill(select, values, label) {
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = label ? label(v) : v;
      select.appendChild(o);
    });
  }

  // Checkbox groups instead of single-select dropdowns: an owner comparing
  // two seasons, or looking at RB and WR together, cannot do it with a
  // <select> that holds one value.
  function checkboxes(box, values, onchange) {
    values.forEach(function (v) {
      var label = document.createElement("label");
      var input = document.createElement("input");
      input.type = "checkbox";
      input.value = v;
      input.addEventListener("change", onchange);
      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + v));
      box.appendChild(label);
    });
  }

  function checked(box) {
    var out = {};
    var any = false;
    Array.prototype.forEach.call(
      box.querySelectorAll("input:checked"), function (i) {
        out[i.value] = 1; any = true;
      });
    return any ? out : null;   // null means "no filter", i.e. everything
  }

  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (v) {
      if (v !== "" && v !== undefined && !seen[v]) { seen[v] = 1; out.push(v); }
    });
    return out;
  }

  function matches() {
    var q = el("q").value.trim().toLowerCase();
    var team = el("team").value, kind = el("kind").value;
    var acq = el("acq").value;
    var churn = el("churn").checked, cut = el("cut").checked;
    var ming = parseInt(el("ming").value, 10) || 0;
    var seasons = checked(el("seasonbox")), poss = checked(el("posbox"));
    var minp = parseInt(el("minp").value, 10) || 0;
    return ROWS.filter(function (r) {
      if (q && r.player.toLowerCase().indexOf(q) === -1) return false;
      if (team && r.tid !== team) return false;
      if (seasons && !seasons[r.season]) return false;
      if (poss && !poss[r.pos]) return false;
      // A cut row carries no salary, no term and no scoring -- it records
      // that a contract ended. Useful when you want it, noise when you do
      // not, so it is off by default.
      if (r.kind === "cut" && !cut) return false;
      if (kind === "contract" && r.group !== "contract") return false;
      if (kind === "draft" && r.group !== "draft") return false;
      // After the merge a keeper is a CONTRACT row carrying slot:"keeper",
      // so the slot must be consulted as well as the row's own kind.
      if (kind === "auction" && r.kind !== "auction" && r.slot !== "auction")
        return false;
      if (kind === "keeper" && r.kind !== "keeper" && r.slot !== "keeper")
        return false;
      if (acq && r.acq !== acq) return false;
      if (r.amount < minp) return false;
      // One-and-done FA pickups are roster churn, not league history, and
      // there are 155 of them. Hidden unless asked for.
      if (r.transient && !churn) return false;
      // Minimum games. A one-week wonder at 38.2 points per game is not a
      // better season than sixteen weeks at 25, and without a floor the top
      // of any per-game sort is single appearances.
      if (ming && (r.games || 0) < ming) return false;
      return true;
    });
  }

  function render() {
    var rows = matches();
    // Rows with nothing in the sorted column go LAST in either direction.
    // Sorting by PPG used to put every cut and unscored row at the top,
    // because "" compares below any number -- the highest scorer was buried
    // under blanks, which is the opposite of what the click asked for.
    function blank(v) {
      return v === "" || v === null || v === undefined;
    }
    rows.sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      var bx = blank(x), by = blank(y);
      if (bx && by) return 0;
      if (bx) return 1;
      if (by) return -1;
      var r;
      if (typeof x === "number" && typeof y === "number") r = x - y;
      else r = String(x).toLowerCase() < String(y).toLowerCase() ? -1 : 1;
      return sortAsc ? r : -r;
    });

    // Totals are reported SEPARATELY by kind of dollar. Auction dollars are
    // bid against the $225 draft budget, FAAB dollars against the separate
    // $275 one, and cap salary is a third thing again -- adding them gives a
    // number that denominates nothing.
    var players = {}, salary = 0, picks = 0, faab = 0, nPick = 0, nFa = 0;
    rows.forEach(function (r) {
      players[r.pid] = 1;
      if (r.group === "draft") { picks += r.amount; nPick++; }
      else if (r.acq === "FA") { faab += r.amount; nFa++; }
      else { salary += r.amount; }
    });
    var bits = [rows.length.toLocaleString() + " rows",
                Object.keys(players).length.toLocaleString() + " players"];
    if (salary) bits.push("$" + salary.toLocaleString() + " cap salary");
    if (nFa) bits.push("$" + faab.toLocaleString() + " FAAB (" + nFa + ")");
    if (nPick) bits.push("$" + picks.toLocaleString() + " drafted (" +
                         nPick + ")");
    el("summary").innerHTML = bits.join(" \u00b7 ");

    var body = el("results").tBodies[0];
    body.textContent = "";
    rows.slice(0, LIMIT).forEach(function (r) {
      var tr = document.createElement("tr");
      [["player", r.player], ["pos", r.pos], ["team", r.team],
       ["season", r.season], ["acq", r.acq], ["kind", r.kind],
       ["desig", r.desig],
       ["amount", r.amount ? "$" + r.amount : ""],
       ["started", r.started],
       ["points", r.points],
       ["games", r.games],
       ["ppg", r.ppg]].forEach(function (pair, i) {
        var td = document.createElement("td");
        if (i === 0) {
          var a = document.createElement("a");
          a.href = "#"; a.textContent = pair[1];
          a.title = "Show this player's whole IFV record";
          a.addEventListener("click", function (e) {
            e.preventDefault();
            el("q").value = r.player;
            el("team").value = ""; el("kind").value = ""; el("acq").value = "";
            el("minp").value = 0;
            el("ming").value = 0;
            Array.prototype.forEach.call(
              document.querySelectorAll(".chk input:checked"), function (i) {
                i.checked = false;
              });
            // A player's own page shows everything he did.
            el("churn").checked = true;
            el("cut").checked = true;
            render();
          });
          td.appendChild(a);
        } else {
          if (i >= 7) td.className = "num";
          td.textContent = pair[1];
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    el("more").textContent = rows.length > LIMIT
      ? "Showing the first " + LIMIT + " of " + rows.length +
        " \u2014 narrow the filters to see the rest."
      : "";
  }

  function wireSorting() {
    Array.prototype.forEach.call(
      document.querySelectorAll("#results thead th"), function (th) {
        th.classList.add("sortable");
        th.tabIndex = 0;
        function go() {
          var k = th.getAttribute("data-k");
          sortAsc = (k === sortKey) ? !sortAsc : false;
          sortKey = k;
          Array.prototype.forEach.call(
            document.querySelectorAll("#results thead th"), function (o) {
              o.removeAttribute("data-dir");
            });
          th.setAttribute("data-dir", sortAsc ? "up" : "down");
          render();
        }
        th.addEventListener("click", go);
        th.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
        });
      });
  }

  function start(d) {
    DATA = d;
    ROWS = flatten(d);
    var teams = Object.keys(d.teams).sort();
    fill(el("team"), teams, function (t) { return d.teams[t]; });
    checkboxes(el("seasonbox"),
               uniq(ROWS.map(function (r) { return r.season; }))
                 .sort().reverse(), render);
    checkboxes(el("posbox"),
               uniq(ROWS.map(function (r) { return r.pos; })).sort(), render);

    ["q", "team", "kind", "acq", "churn", "cut", "minp", "ming"]
      .forEach(function (id) {
        el(id).addEventListener("input", render);
        el(id).addEventListener("change", render);
      });
    el("reset").addEventListener("click", function () {
      ["q", "team", "kind", "acq"].forEach(function (id) {
        el(id).value = "";
      });
      Array.prototype.forEach.call(
        document.querySelectorAll(".chk input:checked"), function (i) {
          i.checked = false;
        });
      el("churn").checked = false;
      el("cut").checked = false;
      el("minp").value = 0;
      el("ming").value = 0;
      render();
    });
    wireSorting();
    render();
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Inline block FIRST: fetch() is blocked by CORS on file:// URLs, so a
    // fetch-only explorer works when published and fails silently when the
    // folder is opened locally.
    var inline = document.getElementById("league-data");
    if (inline && inline.textContent.trim()) {
      // ONLY the parse is guarded. An earlier version wrapped start() too,
      // so any rendering error was swallowed and fell through to a fetch
      // that cannot work on file:// -- turning a real bug into a blank page
      // with a misleading "could not load" message.
      var parsed = null;
      try { parsed = JSON.parse(inline.textContent); }
      catch (e) { parsed = null; }
      if (parsed) { start(parsed); return; }
    }
    var tag = document.querySelector("script[data-src]");
    var src = tag ? tag.getAttribute("data-src") : "assets/league.json";
    fetch(src).then(function (r) { return r.json(); }).then(start)
      .catch(function (e) {
        el("summary").textContent =
          "Could not load the league data (" + e + ").";
      });
  });
})();
