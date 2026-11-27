(function () {
  "use strict";

  var MAX = window.DP_MAX || 12;
  var SLOTS = 3;
  var PER_PAGE = 30;   // one character-select screen: 6 x 5

  var R = window.ROSTER;
  var ICONS = window.ICONS || {};
  var PAGES = Math.ceil(R.length / PER_PAGE);
  var PAGE = Math.min(PAGES, Math.max(1, parseInt(document.body.dataset.page || "1", 10)));

  var GROUP = {
    uzumaki: "#ffb347", uchiha: "#ff5a5a", haruno: "#ff7eb6",
    konoha: "#7ddc7d", akatsuki: "#c95cff", otsutsuki: "#b9a6ff",
    kage: "#5cb8ff", sand: "#e8c37a", mist: "#6ee7e0",
    sound: "#b6d16a", boruto: "#ff9ad5", other: "#9aa7b4"
  };
  var TIER = { 6: "#ffd166", 5: "#c9a6ff", 4: "#6fe3ff", 3: "#8bd17c", 2: "#a8b8c8", 1: "#7b8794" };
  var TIER_NAME = { 6: "Meta carry", 5: "Top specialist", 4: "Tournament core", 3: "Mid-tier", 2: "Support filler", 1: "Budget anchor" };
  var ROLE = {
    6: "Meta-defining. Wins neutral on its own and forces the opponent to play around it.",
    5: "Top-tier specialist. Elite damage or support value, with one real weakness.",
    4: "Tournament core. Clean fundamentals, no broken mechanic.",
    3: "Mid-tier. Strong in one team shape, mediocre outside it.",
    2: "Support filler. Bought for the assist, not the carry.",
    1: "Budget anchor. Fills the third slot on a 6+5 build."
  };
  var SUP_CODE = {
    "Break Guard": "BG",
    "Charge Assist": "CA",
    "Charge Guard": "CG",
    "Cover Fire": "CF",
    "Dash Cut": "DC",
    "Secret Substitution": "SS",
    "Strike Back": "SB"
  };
  var SUP_ICON = "img/ui/";
  function supIcon(name) { return SUP_ICON + encodeURIComponent(name) + ".webp"; }

  var team = [];
  function validIdx(i) { return typeof i === "number" && i >= 0 && i < R.length; }

  var DEFAULT_SORT = "name";
  var SORT = DEFAULT_SORT;
  try {
    var sm = new URLSearchParams(location.search).get("s");
    if (sm === "asc" || sm === "desc" || sm === "name" || sm === "game") SORT = sm;
  } catch (e) {}

  function trim(list) {
    var out = [], spent = 0;
    list.forEach(function (i) {
      if (out.length >= SLOTS) return;
      if (out.indexOf(i) !== -1) return;
      if (out.some(function (j) { return R[j].n === R[i].n; })) return;
      if (spent + R[i].dp > MAX) return;
      out.push(i);
      spent += R[i].dp;
    });
    return out;
  }

  /* file:// blocks localStorage, so the squad travels in the query string */
  (function loadTeam() {
    var raw = null;
    try { raw = new URLSearchParams(location.search).get("t"); } catch (e) {}
    if (raw !== null) { team = trim(raw.split(",").map(Number).filter(validIdx)); return; }
    try { team = trim((JSON.parse(localStorage.getItem("narutoDPTeam") || "[]") || []).filter(validIdx)); }
    catch (e) { team = []; }
  })();

  var $ = function (s) { return document.querySelector(s); };

  function initials(c) {
    var words = c.n.trim().split(/\s+/);
    if (words.length > 1) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    return c.n.slice(0, 2);
  }
  function label(c) { return c.f ? c.n + " (" + c.f + ")" : c.n; }
  function total() { return team.reduce(function (s, i) { return s + R[i].dp; }, 0); }

  /* the game allows only one version of a character per squad */
  function familyOf(c) { return c.n; }
  function familyTaken(name, exceptIdx) {
    for (var i = 0; i < team.length; i++) {
      if (team[i] === exceptIdx) continue;
      if (R[team[i]].n === name) return R[team[i]];
    }
    return null;
  }

  function save() {
    try { localStorage.setItem("narutoDPTeam", JSON.stringify(team)); } catch (e) {}
    try {
      var q = [];
      if (team.length) q.push("t=" + team.join(","));
      if (SORT !== DEFAULT_SORT) q.push("s=" + SORT);
      history.replaceState(null, "", q.length ? "?" + q.join("&") : location.pathname.split("/").pop());
    } catch (e) {}
  }

  /* keeps squad + sort when moving between pages */
  function link(href) {
    var q = [];
    if (team.length) q.push("t=" + team.join(","));
    if (SORT !== DEFAULT_SORT) q.push("s=" + SORT);
    return href + (q.length ? "?" + q.join("&") : "");
  }

  /* display order: game order, by NP, or by first name */
  function viewOrder() {
    var idx = R.map(function (_, i) { return i; });
    if (SORT === "asc") idx.sort(function (a, b) { return (R[a].dp - R[b].dp) || (a - b); });
    else if (SORT === "desc") idx.sort(function (a, b) { return (R[b].dp - R[a].dp) || (a - b); });
    else if (SORT === "name") idx.sort(function (a, b) {
      var an = firstWord(R[a].n), bn = firstWord(R[b].n);
      if (an !== bn) return an < bn ? -1 : 1;
      if (R[a].n !== R[b].n) return R[a].n < R[b].n ? -1 : 1;
      return a - b;   /* forms of one character keep game order */
    });
    return idx;
  }

  /* "Naruto Uzumaki" -> "naruto": the roster is written given-name first */
  function firstWord(name) {
    return String(name).split(/\s+/)[0].toLowerCase();
  }

  var toastTimer = null;
  function toast(msg, ok) {
    var el = $("#toast");
    el.textContent = msg;
    el.className = "toast show" + (ok ? " ok" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "toast"; }, 1900);
  }

  /* portrait: image when we have one, initials otherwise */
  function portrait(idx, c, extraClass) {
    var wrap = document.createElement("span");
    wrap.className = "ava " + (extraClass || "");
    wrap.style.setProperty("--glow", GROUP[c.g] || GROUP.other);
    wrap.style.setProperty("--tier", TIER[c.dp]);

    var ini = document.createElement("span");
    ini.className = "initial";
    ini.textContent = initials(c);
    wrap.appendChild(ini);

    var url = (window.LOCAL_ART && window.LOCAL_ART[c.n + "|" + c.f]) || ICONS[c.n + "|" + c.f];
    if (url) {
      var img = document.createElement("img");
      var remote = ICONS[c.n + "|" + c.f];
      img.className = url === remote ? "pic" : "pic fit";
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = function () {
        /* local file not dropped in yet - use the remote portrait instead */
        if (remote && img.src.indexOf(remote) === -1) {
          img.className = "pic";
          img.src = remote;
          return;
        }
        img.remove();
        wrap.classList.add("noimg");
      };
      img.src = url;
      wrap.appendChild(img);
    } else {
      wrap.classList.add("noimg");
    }
    return wrap;
  }

  /* ---------- team bar ---------- */
  function renderSlots() {
    var wrap = $("#slots");
    wrap.innerHTML = "";
    for (var s = 0; s < SLOTS; s++) {
      (function (s) {
        var idx = team[s];
        var b = document.createElement("button");
        b.type = "button";
        b.className = "slot " + (idx == null ? "empty" : "filled");
        if (idx != null) {
          var c = R[idx];
          b.title = label(c) + " — " + c.dp + " NP (click to remove)";
          b.appendChild(portrait(idx, c, "mini"));
          var dp = document.createElement("span");
          dp.className = "dp";
          dp.innerHTML = "<span>NP</span><b>" + c.dp + "</b>";
          b.appendChild(dp);
          b.onclick = function () { remove(idx); };
        } else {
          b.title = "Empty slot";
        }
        wrap.appendChild(b);
      })(s);
    }

    var t = total();
    $("#cur").textContent = t;
    $("#cur").parentNode.classList.toggle("over", t > MAX);
  }

  function add(idx) {
    var c = R[idx];
    if (team.indexOf(idx) !== -1) { remove(idx); return; }
    var taken = familyTaken(c.n, -1);
    if (taken) {
      toast(c.n + " is already in the squad — one version per character");
      return;
    }
    if (team.length >= SLOTS) { toast("Team is full — 3 slots"); return; }
    if (total() + c.dp > MAX) { toast("Over cap: " + c.dp + " NP won't fit in " + (MAX - total()) + " left"); return; }
    team.push(idx);
    save(); renderSlots(); renderGrid(); renderNav(); renderDetail(idx);
    toast(label(c) + " added · " + total() + "/" + MAX + " NP", true);
  }

  function remove(idx) {
    var at = team.indexOf(idx);
    if (at === -1) return;
    var c = R[idx];
    team.splice(at, 1);
    save(); renderSlots(); renderGrid(); renderNav();
    toast(label(c) + " removed", true);
  }

  /* ---------- grid ---------- */
  function renderGrid() {
    var grid = $("#grid");
    grid.innerHTML = "";
    var start = (PAGE - 1) * PER_PAGE;
    var used = team.map(function (i) { return R[i].n; });
    viewOrder().slice(start, start + PER_PAGE).forEach(function (idx) {
      var c = R[idx];
      var picked = team.indexOf(idx) !== -1;
      var locked = !picked && used.indexOf(c.n) !== -1;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tile" + (picked ? " picked" : "") + (locked ? " locked" : "");
      b.title = label(c) + " — " + c.dp + " NP" + (c.sup ? " · " + c.sup : "") + (locked ? " · " + c.n + " already picked" : "");
      b.appendChild(portrait(idx, c));

      var dp = document.createElement("span");
      dp.className = "dp";
      dp.innerHTML = "<span>NP</span><b>" + c.dp + "</b>";
      b.querySelector(".ava").appendChild(dp);

      var sp = document.createElement("span");
      sp.className = "sup";
      if (c.sup) {
        var si = document.createElement("img");
        si.src = supIcon(c.sup);
        si.alt = c.sup;
        si.title = c.sup;
        si.loading = "lazy";
        si.decoding = "async";
        si.onerror = function () {
          sp.classList.add("fallback");
          sp.textContent = SUP_CODE[c.sup] || "–";
        };
        sp.appendChild(si);
      } else {
        sp.classList.add("none");
        sp.title = "No support type listed";
      }
      b.querySelector(".ava").appendChild(sp);

      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = c.n;
      b.appendChild(nm);

      b.addEventListener("click", function () { add(idx); });
      b.addEventListener("mouseenter", function () { renderDetail(idx); });
      grid.appendChild(b);
    });
  }

  /* ---------- detail ---------- */
  function renderDetail(idx) {
    var c = R[idx];

    var inTeam = team.indexOf(idx) !== -1;
    var left = MAX - total();
    var ikey = c.n + "|" + c.f;
    var localArt = (window.LOCAL_ART && window.LOCAL_ART[ikey]) || "";
    var remoteArt = ICONS[ikey] || "";
    var artURL = localArt || remoteArt;
    var art = artURL
      ? '<img class="bigpic' + (localArt ? " fit" : "") + '" src="' + artURL + '" alt="" onerror="' +
        (localArt && remoteArt
          ? "if(this.dataset.f){this.remove()}else{this.dataset.f=1;this.className='bigpic';this.src='" + remoteArt + "'}"
          : "this.remove()") +
        '">'
      : "";

    $("#detail").innerHTML =
      '<div class="detail">' +
      '<div class="watermark">' + initials(c) + '</div>' +
      art +
      '<div class="cname">' + c.n + '</div>' +
      (c.f ? '<div class="cform">' + c.f + '</div>' : "") +
      '<div class="cmeta">' + c.era + '</div>' +
      '<div class="card tier">' +
      '<h3>Tier information <i>' + c.dp + " / 6</i></h3>" +
      '<div class="rows">' +
      '<div class="row"><span>Cost</span><b><span class="costdot" style="background:' + TIER[c.dp] + '"></span>' + c.dp + " NP</b></div>" +
      '<div class="row"><span>Bracket</span><b>' + TIER_NAME[c.dp] + '</b></div>' +
      '<div class="row"><span>Support type</span><b>' + (c.sup
        ? '<img class="supmini" src="' + supIcon(c.sup) + '" alt="">' + c.sup
        : "—") + '</b></div>' +
      '<div class="row"><span>Team status</span><b>' + (inTeam ? "In squad" : "Not picked") + '</b></div>' +
      '</div></div>' +
      '<div class="card">' +
      '<h3>Role <i>design note</i></h3>' +
      '<p>' + ROLE[c.dp] + '</p>' +
      '</div>' +
      '<div class="card">' +
      '<h3>Budget <i>12 NP cap</i></h3>' +
      '<p class="hint">' + (inTeam
        ? "Picked — " + (MAX - total()) + " NP left for the remaining " + (SLOTS - team.length) + " slot(s)."
        : c.dp > left
          ? "Doesn't fit: costs " + c.dp + " NP, only " + left + " left."
          : "Fits — leaves " + (left - c.dp) + " NP if added now.") + '</p>' +
      '</div>' +
      '</div>';
  }

  function renderDetailEmpty() {
    var counts = { 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    R.forEach(function (c) { counts[c.dp]++; });
    var legend = "";
    [6, 5, 4, 3, 2, 1].forEach(function (d) {
      legend += '<i style="background:' + TIER[d] + '">' + d + " NP · " + counts[d] + '</i>';
    });

    var supLegend = "";
    ["Break Guard", "Charge Assist", "Charge Guard", "Cover Fire", "Dash Cut", "Secret Substitution", "Strike Back"]
      .forEach(function (k) {
        supLegend += '<i class="supkey"><img src="' + supIcon(k) + '" alt="">' + k + '</i>';
      });

    $("#detail").innerHTML =
      '<div class="detail">' +
      '<div class="watermark">NP</div>' +
      '<div class="cname">NP Team<br>Build</div>' +
      '<div class="cform">Storm Connections · custom scale</div>' +
      '<div class="cmeta">3 slots · 12 NP cap</div>' +
      '<div class="card">' +
      '<h3>How to use <i>' + R.length + " slots</i></h3>" +
      "<p class=\"hint\">Click a portrait to add it to the team. The counter tracks the 12 NP cap and " +
      "refuses anything that would overflow. <b>Only one version of a character per squad</b> — pick " +
      "any Naruto and every other Naruto locks out, same as the game. Hover to inspect. The squad " +
      "carries across pages.</p>" +
      '</div>' +
      '<div class="card">' +
      '<h3>Tier spread <i>' + PAGES + " pages</i></h3>" +
      '<div class="legend">' + legend + '</div>' +
      '</div>' +
      '<div class="card">' +
      '<h3>Support types <i>corner tag</i></h3>' +
      '<div class="legend">' + supLegend + '</div>' +
      '</div>' +
      '</div>';
  }

  /* ---------- sort bar ---------- */
  function renderSort() {
    var bar = $("#sortbar");
    if (!bar) return;
    var opts = [
      { id: "game", label: "Game order" },
      { id: "asc", label: "NP \u2191" },
      { id: "desc", label: "NP \u2193" },
      { id: "name", label: "Name A\u2013Z" }
    ];
    bar.innerHTML = "<span>Sort</span>" + opts.map(function (o) {
      return '<button type="button" data-sort="' + o.id + '"' +
        (SORT === o.id ? ' class="on"' : "") + ">" + o.label + "</button>";
    }).join("");
    Array.prototype.forEach.call(bar.querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () {
        SORT = b.getAttribute("data-sort");
        save();
        renderSort();
        renderGrid();
        renderNav();
      });
    });
  }

  /* ---------- page nav ---------- */
  function renderNav() {
    var nav = $("#pagenav");
    var prev = PAGE > 1
      ? '<a href="' + link("page" + (PAGE - 1) + ".html") + '">◀ Prev</a>'
      : '<span class="off">◀ Prev</span>';
    var next = PAGE < PAGES
      ? '<a href="' + link("page" + (PAGE + 1) + ".html") + '">Next ▶</a>'
      : '<span class="off">Next ▶</span>';

    var dots = '<span class="dots">';
    for (var p = 1; p <= PAGES; p++) {
      dots += p === PAGE ? '<i>' + p + '</i>' : '<a href="' + link("page" + p + ".html") + '">' + p + '</a>';
    }
    dots += '</span>';

    nav.innerHTML = prev + dots + next;
  }

  /* ---------- boot ---------- */
  save();
  renderSlots();
  renderSort();
  renderGrid();
  renderNav();
  renderDetailEmpty();

  $("#reset").addEventListener("click", function () {
    team.length = 0;
    save(); renderSlots(); renderGrid(); renderNav(); renderDetailEmpty();
    toast("Team cleared", true);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" && PAGE > 1) location.href = link("page" + (PAGE - 1) + ".html");
    if (e.key === "ArrowRight" && PAGE < PAGES) location.href = link("page" + (PAGE + 1) + ".html");
  });
})();
