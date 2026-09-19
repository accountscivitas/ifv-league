(function () {
  function val(cell) {
    var t = (cell.textContent || "").trim().replace(/[$,]/g, "");
    if (t === "" || t === "\u2014") return { n: null, s: "" };
    var n = parseFloat(t);
    return { n: isNaN(n) ? null : n, s: t.toLowerCase() };
  }
  function sortBy(table, index, asc) {
    var body = table.tBodies[0];
    if (!body) return;
    var rows = Array.prototype.slice.call(body.rows);
    rows.sort(function (a, b) {
      var x = val(a.cells[index]), y = val(b.cells[index]);
      // A BLANK CELL SINKS IN BOTH DIRECTIONS, and it used to float to the
      // top on descending. The old rule ordered blanks after numbers and
      // then negated the WHOLE comparison for descending, so "sort by most"
      // led with every row that had no value at all. A blank means "no
      // figure", and no figure is never the biggest -- so it is parked
      // outside the reversal rather than inside it.
      if (x.n === null && y.n !== null) return 1;
      if (y.n === null && x.n !== null) return -1;
      var r;
      if (x.n !== null && y.n !== null) r = x.n - y.n;
      else r = x.s < y.s ? -1 : x.s > y.s ? 1 : 0;
      return asc ? r : -r;
    });
    rows.forEach(function (r) { body.appendChild(r); });
  }
  function wire(table) {
    // A table marked data-managed sorts ITSELF. Wiring both handlers put two
    // competing sorters on the explorer: this one reorders the DOM rows while
    // the explorer re-renders from its data model, so a click fired both and
    // whichever finished last won. That is why sorting by PPG and by price
    // kept coming out wrong no matter how the explorer's own comparator was
    // fixed -- the fix was being overwritten.
    if (table.hasAttribute("data-managed")) return;
    var head = table.rows[0];
    if (!head || !table.tBodies.length || table.tBodies[0].rows.length < 2)
      return;
    Array.prototype.forEach.call(head.cells, function (cell, i) {
      cell.classList.add("sortable");
      cell.tabIndex = 0;
      var asc = false;
      function go() {
        asc = !asc;
        Array.prototype.forEach.call(head.cells, function (c) {
          c.removeAttribute("data-dir");
        });
        cell.setAttribute("data-dir", asc ? "up" : "down");
        sortBy(table, i, asc);
      }
      cell.addEventListener("click", go);
      cell.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
      });
    });
  }
  // A generic panel toggle. A button carrying data-show="NAME" reveals the
  // element with data-panel="NAME" inside the same .toggles group and hides
  // its siblings. Used for the all-time table's regular-season switch; kept
  // generic so the next one costs nothing.
  function wireToggles() {
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-show]"), function (btn) {
        btn.addEventListener("click", function () {
          var group = btn.closest(".toggles");
          if (!group) return;
          var want = btn.getAttribute("data-show");
          Array.prototype.forEach.call(
            group.querySelectorAll("[data-show]"), function (b) {
              b.classList.toggle("on", b === btn);
            });
          Array.prototype.forEach.call(
            document.querySelectorAll("[data-panel]"), function (panel) {
              if (group.contains(panel) || panel.parentNode === group.parentNode)
                panel.hidden = panel.getAttribute("data-panel") !== want;
            });
        });
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll("table"), wire);
    wireToggles();
  });
})();
