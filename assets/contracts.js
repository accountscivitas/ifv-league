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
        // Each term PAIRED WITH ITS SEASON, so a term filter and a year
        // window can compose into one question instead of two that
        // happen to both be true. See `data-ys` in ribbon.py.
        pairs: g.getAttribute("data-ys") || "",
        first: +(g.getAttribute("data-first") || 0),
        last: +(g.getAttribute("data-last") || 0),
        len: +(g.getAttribute("data-len") || 0),
        cut: g.getAttribute("data-cut") === "1",
        peak: +(g.getAttribute("data-peak") || 0)
      };
    });
    return true;
  }

  // A term matches when it IS the asked-for one. "C2" must match "C2F",
  // because a C2 that ran to its end is written that way -- but "C1"
  // must never match "C10", so the test is anchored at both ends rather
  // than being a prefix.
  //
  // ⛔ A PREFIX TEST IS CURRENTLY EQUIVALENT, AND ONLY BY THE RULEBOOK.
  // Mutating this to `term.indexOf(want) === 0` came back INERT, and it
  // is a PROVABLE non-mutation rather than a gap: MEASURED over the whole
  // 14-term vocabulary ('', A, B, C1..C5, C1F..C5F, CUT), exact and
  // prefix agree on every pair, because a C contract is capped at five
  // years so no term is a prefix of another except its own F form.
  // The exact form is kept because it survives the cap changing; do not
  // "simplify" it back on the grounds that the mutation is inert.
  function isTerm(term, want) {
    if (want === "F") return term.charAt(term.length - 1) === "F";
    if (want === "CUT") return term === "CUT";
    return term === want || term === want + "F";
  }

  // The terms this contract holds INSIDE [from, to]. With no window that
  // is every term it ever held.
  function termsInWindow(d, from, to) {
    var out = [];
    d.pairs.split("|").forEach(function (pair) {
      if (!pair) return;
      var cut = pair.indexOf(":");
      var season = +pair.slice(0, cut);
      if (from && season < from) return;
      if (to && season > to) return;
      out.push(pair.slice(cut + 1));
    });
    return out;
  }

  function matches(d, q, team, term, from, to, minlen) {
    if (q && d.name.indexOf(q) < 0) return false;
    if (team && d.team !== team) return false;
    if (minlen > 1 && d.len < minlen) return false;

    // ⛔ ONE RULE COVERS BOTH FILTERS, and that is why they compose.
    // The window selects which SEASONS count; the term then asks what
    // happened in them.
    //
    // With no term this reduces exactly to the OVERLAP test it replaced
    // -- "live between 2020 and 2024" is "holds at least one season in
    // the window" -- so a long 2018-2022 deal still shows, which is the
    // thing the page exists to show.
    //
    // With a term it answers the question the owner actually asked:
    // "for 2026, give me all the contracts that are in the final year
    // only and therefore are coming up free next year." Previously the
    // two conditions were checked separately, so a contract whose final
    // year was 2022 and which merely overlapped 2026 came back too.
    var here = termsInWindow(d, from, to);
    if (!here.length) return false;
    if (!term) return true;
    return here.some(function (t) { return isTerm(t, term); });
  }

  function byText(x, y) { return x < y ? -1 : (x > y ? 1 : 0); }

  var SORTS = {
    // THE DEFAULT, and the owner named its three keys: "sort it by year
    // first, and then by team, and then by contract length. Right now it
    // just seems to be sorted randomly."
    //
    // It was not random -- it was the start season alone, with the
    // franchise as a tie-break. But the start season is not DRAWN as a
    // number anywhere, so a reader sees only the left edge of each bar,
    // and 39 rows whose bars begin in a dozen different places read as
    // no order at all. Grouping by franchise within the year is what
    // makes the ordering visible on the page rather than merely present.
    year: function (a, b) {
      return (a.__d.first - b.__d.first)
        || byText(a.__d.team, b.__d.team)
        || (b.__d.len - a.__d.len);
    },
    recent: function (a, b) {
      return (b.__d.last - a.__d.last)
        || byText(a.__d.team, b.__d.team)
        || (b.__d.len - a.__d.len);
    },
    len: function (a, b) { return b.__d.len - a.__d.len; },
    peak: function (a, b) { return b.__d.peak - a.__d.peak; },
    team: function (a, b) {
      return byText(a.__d.team, b.__d.team)
        || (a.__d.first - b.__d.first)
        || (b.__d.len - a.__d.len);
    },
    name: function (a, b) { return byText(a.__d.name, b.__d.name); }
  };

  function apply() {
    var q = (el("rbq").value || "").trim().toLowerCase();
    var team = el("rbteam").value;
    var term = el("rbterm").value;
    var from = +el("rbfrom").value || 0;
    var to = +el("rbto").value || 0;
    var minlen = +el("rblen").value || 1;
    var how = el("rbsort").value || "year";

    var shown = rows.filter(function (g) {
      var ok = matches(g.__d, q, team, term, from, to, minlen);
      g.style.display = ok ? "" : "none";
      return ok;
    });
    // A STABLE TIE-BREAK, always. Without one, two contracts equal on the
    // sort key swap places between renders and the chart appears to
    // shuffle itself when an unrelated filter changes.
    shown.sort(function (a, b) {
      return (SORTS[how] || SORTS.year)(a, b)
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
    el("rbsort").value = "year";
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
