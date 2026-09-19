(function () {
  var tip = null;

  function el() {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "charttip";
      tip.setAttribute("role", "status");
      document.body.appendChild(tip);
    }
    return tip;
  }

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/[&<>]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
      });
  }

  function b(s) { return "<b>" + esc(s) + "</b>"; }
  function dim(s) { return "<span class='t-sub'>" + esc(s) + "</span>"; }

  // One formatter per kind. Keyed on data-kind, never inferred.
  var FORMATTERS = {
    grid: function (d) {
      return [b(d.t), dim(d.s),
              d.v === "in progress" ? "Season in progress"
                                    : "Finished " + esc(d.v)];
    },
    h2h: function (d) {
      return [b(d.a) + " vs " + esc(d.b),
              d.v ? esc(d.v) + "  (row team's record)" : "Never played"];
    },
    value: function (d) {
      return [b(d.n), dim(esc(d.t) + " \u00b7 " + esc(d.s)),
              "Cost $" + esc(d.p), "Scored " + esc(d.y),
              dim(d.k === "steal" ? "Beat the going rate for his price"
                  : d.k === "bust" ? "Fell short of it" : "About par")];
    },
    luck: function (d) {
      return [b(d.t), dim(d.s), "Record " + esc(d.w),
              esc(d.p) + " points per game",
              dim(d.k === "lucky" ? "Won more than the scoring bought"
                  : d.k === "unlucky" ? "Won less than the scoring bought"
                  : "About what the scoring bought")];
    },
    pay: function (d) {
      return [b(d.t), dim(d.s + " season"), "$" + esc(d.v) + " committed"];
    },
    bench: function (d) {
      return [b(d.t), esc(d.v) + "% left on the bench",
              dim(esc(d.l) + " points, 2018 onward")];
    },
    ribbon: function (d) {
      return [b(d.n), dim(esc(d.s) + "  \u00b7  " + esc(d.d)),
              d.cut === "1" ? "Cut \u2014 $" + esc(d.v) + " dead money"
                            : "$" + esc(d.v) + " salary"];
    },
    place: function (d) {
      return [b(d.t), dim(d.s), esc(d.v)];
    }
  };

  function lines(mark) {
    var fn = FORMATTERS[mark.dataset.kind];
    return fn ? fn(mark.dataset).filter(function (x) { return x; }) : [];
  }

  function show(mark, x, y) {
    var body = lines(mark);
    if (!body.length) return;
    var node = el();
    node.innerHTML = body.join("<br>");
    node.style.display = "block";
    // Measured AFTER the content is set: the box has no size before it.
    var box = node.getBoundingClientRect();
    var left = x + 14, top = y + 14;
    if (left + box.width > window.innerWidth - 8) left = x - box.width - 14;
    if (top + box.height > window.innerHeight - 8) top = y - box.height - 14;
    node.style.left = Math.max(4, left) + "px";
    node.style.top = Math.max(4, top) + "px";
  }

  function hide() { if (tip) tip.style.display = "none"; }

  function markOf(node) {
    return node && node.closest ? node.closest("[data-kind]") : null;
  }

  document.addEventListener("mouseover", function (e) {
    var mark = markOf(e.target);
    if (mark) show(mark, e.clientX, e.clientY);
    else hide();
  });
  document.addEventListener("mousemove", function (e) {
    var mark = markOf(e.target);
    if (mark && tip && tip.style.display === "block") {
      show(mark, e.clientX, e.clientY);
    }
  });
  document.addEventListener("mouseleave", hide, true);

  // Keyboard parity: a focused lane shows the same thing hover does, so the
  // tooltip is never the only route to a value for a keyboard reader.
  document.addEventListener("focusin", function (e) {
    var lane = e.target.closest && e.target.closest("g.lane");
    if (!lane) return;
    document.querySelectorAll("g.lane.on").forEach(function (g) {
      g.classList.remove("on");
    });
    lane.classList.add("on");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hide();
  });

  // The value scatter's position filter. Nothing ticked means EVERY
  // position -- see _position_filter in scatter.py for why that is not the
  // same as ticking them all.
  //
  // It HIDES marks rather than redrawing the chart, so the axes and the
  // market curve stay put: the reader is narrowing what is plotted, not
  // getting a new chart each click, and a mark keeps its position between
  // selections so the eye can follow it.
  Array.prototype.forEach.call(
    document.querySelectorAll("[data-posfilter]"), function (box) {
      var fig = box.nextElementSibling;
      if (!fig) return;
      box.addEventListener("change", function () {
        var on = {}, any = false;
        Array.prototype.forEach.call(
          box.querySelectorAll("input:checked"), function (i) {
            on[i.value] = true; any = true;
          });
        Array.prototype.forEach.call(
          fig.querySelectorAll("[data-pos]"), function (dot) {
            var show = !any || on[dot.getAttribute("data-pos")];
            dot.style.display = show ? "" : "none";
          });
      });
    });

  // Hovering a lane in a many-line chart raises it out of the pack. CSS
  // does this for :hover; this adds it for the season-list chips, where the
  // thing being highlighted is elsewhere on the page.
  document.addEventListener("mouseover", function (e) {
    var chip = e.target.closest && e.target.closest("[data-team]");
    var team = chip && chip.getAttribute("data-team");
    document.querySelectorAll("[data-team].lit").forEach(function (n) {
      n.classList.remove("lit");
    });
    if (!team) return;
    document.querySelectorAll('[data-team="' + CSS.escape(team) + '"]')
      .forEach(function (n) { n.classList.add("lit"); });
  });
})();
