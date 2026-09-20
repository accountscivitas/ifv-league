(function () {
  var PAD_T = 26, PAD_B = 30, ROW_H = 20, WIDTH = 720;

  var el = function (id) { return document.getElementById(id); };
  var svg = null, axis = null, rows = [], total = 0;

  function num(v) { return Math.round(v * 100) / 100; }

  function readRows() {
    svg = document.querySelector("svg.ribbonall");
    if (!svg) return false;
    axis = svg.querySelector("#rb-axis");
    rows = Array.prototype.slice.call(svg.querySelectorAll("g.rb"));
    total = rows.length;
    rows.forEach(function (g) {
      g.__d = {
        team: g.getAttribute("data-t") || "",
        name: (g.getAttribute("data-n") || "").toLowerCase(),
        // PIPE-DELIMITED AND PIPE-WRAPPED. "|C5|" cannot match "|C5F|",
        // which a bare indexOf("C5") would -- the same substring trap
        // that made a chart test pass against a renamed CSS rule.
        terms: g.getAttribute("data-y") || "",
        first: +(g.getAttribute("data-first") || 0),
        last: +(g.getAttribute("data-last") || 0),
        len: +(g.getAttribute("data-len") || 0),
        cut: g.getAttribute("data-cut") === "1",
        peak: +(g.getAttribute("data-peak") || 0)
      };
    });
    return true;
  }

  function wantsTerm(d, term) {
    if (!term) return true;
    // "Final years only" and "Cut" are not contract years; they are
    // properties of the contract, and the select carries all three
    // because to a reader they are one question: which kind of row.
    if (term === "CUT") return d.cut;
    if (term === "F") return d.terms.indexOf("F|") >= 0;
    // A C2 contract that ran to its end is written "C2F", so asking for
    // C2 must match both. Anchored on the left so C1 never matches C2.
    return d.terms.indexOf("|" + term) >= 0;
  }

  function matches(d, q, team, term, from, to, minlen) {
    if (q && d.name.indexOf(q) < 0) return false;
    if (team && d.team !== team) return false;
    if (!wantsTerm(d, term)) return false;
    // OVERLAP, not containment. "Live between 2020 and 2024" means the
    // contract was running at some point in that window -- a 2018-2022
    // deal was. Requiring containment would hide every long contract,
    // which is the thing the page exists to show.
    if (from && d.last < from) return false;
    if (to && d.first > to) return false;
    if (minlen > 1 && d.len < minlen) return false;
    return true;
  }

  var SORTS = {
    first: function (a, b) { return a.__d.first - b.__d.first; },
    recent: function (a, b) { return b.__d.last - a.__d.last; },
    len: function (a, b) { return b.__d.len - a.__d.len; },
    peak: function (a, b) { return b.__d.peak - a.__d.peak; },
    team: function (a, b) {
      return a.__d.team < b.__d.team ? -1 : (a.__d.team > b.__d.team ? 1 : 0);
    },
    name: function (a, b) {
      return a.__d.name < b.__d.name ? -1 : (a.__d.name > b.__d.name ? 1 : 0);
    }
  };

  function apply() {
    var q = (el("rbq").value || "").trim().toLowerCase();
    var team = el("rbteam").value;
    var term = el("rbterm").value;
    var from = +el("rbfrom").value || 0;
    var to = +el("rbto").value || 0;
    var minlen = +el("rblen").value || 1;
    var how = el("rbsort").value || "first";

    var shown = rows.filter(function (g) {
      var ok = matches(g.__d, q, team, term, from, to, minlen);
      g.style.display = ok ? "" : "none";
      return ok;
    });
    // A STABLE TIE-BREAK, always. Without one, two contracts equal on the
    // sort key swap places between renders and the chart appears to
    // shuffle itself when an unrelated filter changes.
    shown.sort(function (a, b) {
      return (SORTS[how] || SORTS.first)(a, b)
        || (a.__d.first - b.__d.first)
        || (a.__d.name < b.__d.name ? -1 : 1);
    });
    shown.forEach(function (g, i) {
      g.setAttribute("transform",
                     "translate(0," + num(PAD_T + i * ROW_H) + ")");
      // The DOM order has to follow the visual order or a keyboard tab
      // through the links crosses the page at random.
      svg.appendChild(g);
    });

    var height = PAD_T + Math.max(shown.length, 1) * ROW_H + PAD_B;
    svg.setAttribute("viewBox", "0 0 " + WIDTH + " " + num(height));
    if (axis) {
      Array.prototype.forEach.call(axis.querySelectorAll("line"),
        function (ln) { ln.setAttribute("y2", num(height - PAD_B)); });
    }
    say(shown.length);
  }

  function say(n) {
    var out = el("rbsummary");
    if (!out) return;
    if (n === total) {
      out.textContent = "All " + total + " contracts.";
    } else if (n === 0) {
      // NAMES THE EMPTY RESULT rather than leaving a blank frame. An
      // empty chart with no sentence reads as a broken page.
      out.textContent = "No contract matches — widen the filters.";
    } else {
      out.textContent = n + " of " + total + " contracts.";
    }
  }

  function reset() {
    el("rbq").value = "";
    el("rbteam").value = "";
    el("rbterm").value = "";
    el("rbfrom").value = "";
    el("rbto").value = "";
    el("rblen").value = "1";
    el("rbsort").value = "first";
    apply();
  }

  function wire() {
    if (!readRows()) return;
    ["rbq", "rbteam", "rbterm", "rbfrom", "rbto", "rblen", "rbsort"]
      .forEach(function (id) {
        var node = el(id);
        if (!node) return;
        node.addEventListener("input", apply);
        node.addEventListener("change", apply);
      });
    var r = el("rbreset");
    if (r) r.addEventListener("click", reset);

    // ?team=F03 or ?q=Kamara, so a link from a franchise page can open
    // this one already narrowed. The explorer takes ?q= the same way.
    var params = new URLSearchParams(window.location.search);
    if (params.get("team")) el("rbteam").value = params.get("team");
    if (params.get("q")) el("rbq").value = params.get("q");
    if (params.get("term")) el("rbterm").value = params.get("term");
    apply();
  }

  document.addEventListener("DOMContentLoaded", wire);
})();
