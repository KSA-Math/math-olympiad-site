/* Olympiad Problem Archive: a static, hash-routed single page app over window.ARCHIVE. */
(function () {
  "use strict";

  const A = window.ARCHIVE;
  const REPO = "https://github.com/KSA-Math/math-olympiad-problems";
  const SUBJECTS = ["alg", "combi", "geo", "nt"];
  const LEVELS = [1, 2, 3, 4];
  const PAGE = 25;
  const app = document.getElementById("app");

  // ---------- indexes ----------
  const problems = A.problems;
  const byId = new Map(problems.map((p) => [p.id, p]));
  const topicById = new Map(A.topics.map((t) => [t.id, t]));
  const byTopic = new Map();
  for (const p of problems) {
    for (const t of p.topics) {
      if (!byTopic.has(t)) byTopic.set(t, []);
      byTopic.get(t).push(p);
    }
  }
  const subjName = (s) => A.subjects[s].name;
  const levelName = (L) => A.levels[L].name;

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tex = (s) => (s ? window.TeX.render(String(s), window.katex) : "");
  const store = {
    get(k, d) { try { const v = localStorage.getItem("archive:" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("archive:" + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const inLevel = (p, L) => p.levels.includes(L);
  const sortProblems = (list) => list.slice().sort((a, b) => (b.stars - a.stars) || a.id.localeCompare(b.id));
  const starText = (n) => "★".repeat(n);
  const githubEdit = (p) => `${REPO}/edit/main/data/problems/${p.subject}/${p.id}.yaml`;

  function topicLevels(t) {
    const ls = new Set(Object.keys(t.levels || {}).map(Number));
    for (const p of byTopic.get(t.id) || []) p.levels.forEach((L) => ls.add(L));
    return LEVELS.filter((L) => ls.has(L));
  }
  function topicCount(tid, L) {
    return (byTopic.get(tid) || []).filter((p) => inLevel(p, L)).length;
  }
  function topicLink(tid, preferL) {
    const t = topicById.get(tid);
    if (!t) return esc(tid);
    const ls = topicLevels(t);
    const L = ls.includes(preferL) ? preferL : ls[0];
    return `<a href="#/t/${t.id}/${L}">${esc(t.name)}</a>`;
  }
  function prettyHandout(s) {
    return String(s).replace(/^year\s+/, "").replace(/\.(txt|tex|pdf)\b/g, "");
  }

  function aopsLabel(p) {
    const url = p.aops;
    const m = /\b(ISL|EGMO) (\d{4})\b/.exec(p.source || "");
    const contest = m ? (m[1] === "ISL" ? "IMO Shortlist" : "EGMO") : "";
    if (/\/c\d+h\d+/.test(url)) return "Discussion thread on AoPS";
    if (/c3223_imo_shortlist|European_Girls/.test(url)) return `AoPS: ${contest || "contest"} page (all years)`;
    if (/\/wiki\//.test(url)) return `AoPS Wiki: ${m ? `${m[2]} ${contest}` : "contest"} problems`;
    return m ? `${contest} ${m[2]} on AoPS (problems and discussion threads)` : "AoPS";
  }

  function pills(p, inTopic) {
    const out = [];
    if (!inTopic) {   // on a topic page the subject is known; show only extra levels
      out.push(`<span class="pill subject-${p.subject}">${esc(subjName(p.subject))}</span>`);
      out.push(`<span class="pill">${p.levels.map((L) => "L" + L).join(" · ")}</span>`);
    } else if (p.levels.length > 1) {
      out.push(`<span class="pill" title="Also used at these levels">${p.levels.map((L) => "L" + L).join(" · ")}</span>`);
    }
    if (p.stars) out.push(`<span class="pill stars" title="${esc(A.stars[p.stars] || "")}">${starText(p.stars)}</span>`);
    if (p.hard) out.push(`<span class="pill hard" title="Marked hard for its level in the source handouts">hard</span>`);
    return out.join(" ");
  }

  function problemCard(p, L) {
    return `
      <article class="card problem-card">
        <div class="head">
          <a class="pid" href="#/p/${p.id}">${p.id}</a>
          ${pills(p, L != null)}
          ${p.source ? `<span class="source">${esc(p.source)}</span>` : ""}
          <span class="spacer"></span>
          ${handoutButton(p)}
          <a class="small" href="#/p/${p.id}">Open →</a>
        </div>
        <div class="statement">${tex(p.statement)}</div>
      </article>`;
  }

  // ---------- handout (a per-browser list of chosen problems) ----------
  let handout = store.get("handout", []).filter((id) => byId.has(id));
  const inHandout = (id) => handout.includes(id);
  function saveHandout() { store.set("handout", handout); nav(currentNav); }
  function handoutButton(p) {
    const on = inHandout(p.id);
    return `<button class="btn-mini add-h ${on ? "on" : ""}" data-id="${p.id}" title="Add to / remove from your handout">${on ? "✓ In handout" : "+ Handout"}</button>`;
  }
  app.addEventListener("click", (e) => {
    const b = e.target.closest(".add-h");
    if (!b) return;
    const id = b.dataset.id;
    handout = inHandout(id) ? handout.filter((x) => x !== id) : handout.concat(id);
    saveHandout();
    document.querySelectorAll(`.add-h[data-id="${id}"]`).forEach((el) => {
      el.outerHTML = handoutButton(byId.get(id));
    });
  });

  const LATEX_PREAMBLE = String.raw`\documentclass[11pt]{article}
\usepackage[margin=2.2cm]{geometry}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{enumitem}
\usepackage{tikz}
\newcommand{\Z}{\mathbb{Z}}
\newcommand{\N}{\mathbb{N}}
\newcommand{\Q}{\mathbb{Q}}
\newcommand{\R}{\mathbb{R}}
\newcommand{\C}{\mathbb{C}}
\newcommand{\floor}[1]{\left\lfloor #1 \right\rfloor}
\newcommand{\ceil}[1]{\left\lceil #1 \right\rceil}
\newcommand{\abs}[1]{\left| #1 \right|}
\DeclareMathOperator{\lcm}{lcm}
\DeclareMathOperator{\ord}{ord}
\newcommand{\vp}[1]{v_{#1}}
\newcommand{\legendre}[2]{\left(\tfrac{#1}{#2}\right)}
\setlength{\parindent}{0pt}
`;

  function handoutLatex(title, withSources, withIds) {
    const items = handout.map((id) => byId.get(id)).map((p) => {
      const tag = [withIds ? p.id : "", withSources && p.source ? p.source : ""].filter(Boolean).join(", ");
      return `  \\item ${p.statement.trim()}${tag ? `\n\n  \\hfill\\textit{(${tag})}` : ""}`;
    });
    return `${LATEX_PREAMBLE}
\\begin{document}
\\begin{center}\\Large\\textbf{${title.replace(/[&%$#_{}]/g, (c) => "\\" + c)}}\\end{center}
\\bigskip

\\begin{enumerate}[label=\\textbf{Problem \\arabic*.}, leftmargin=*, itemsep=1.2em]
${items.join("\n\n")}
\\end{enumerate}
\\end{document}
`;
  }

  function viewHandout() {
    const opts = store.get("handoutOpts", { title: "Problem set", sources: true, ids: false });
    const list = handout.map((id) => byId.get(id));
    app.innerHTML = `
      <div class="crumbs no-print"><a href="#/">Home</a> › Handout</div>
      <div class="no-print">
        <h1>Handout</h1>
        <p class="lead">Collect problems with the <b>+ Handout</b> button on any problem, then print it or export LaTeX.
          The list is saved in this browser only.</p>
        ${list.length ? `
        <div class="card handout-controls">
          <label class="field">Title <input id="h-title" value="${esc(opts.title)}"></label>
          <label><input type="checkbox" id="h-sources" ${opts.sources ? "checked" : ""}> Show sources</label>
          <label><input type="checkbox" id="h-ids" ${opts.ids ? "checked" : ""}> Show problem IDs</label>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="h-print">Print / save as PDF</button>
            <button class="btn" id="h-tex">Download .tex</button>
            <button class="btn" id="h-copy">Copy LaTeX</button>
            <span class="spacer"></span>
            <button class="btn" id="h-clear">Clear handout</button>
          </div>
        </div>` : `<p class="muted">Your handout is empty.</p>`}
      </div>
      <div id="h-doc"></div>`;
    if (!list.length) return;
    const doc = document.getElementById("h-doc");
    const draw = () => {
      const o = { title: document.getElementById("h-title").value, sources: document.getElementById("h-sources").checked,
                  ids: document.getElementById("h-ids").checked };
      store.set("handoutOpts", o);
      doc.innerHTML = `<h2 class="handout-title">${esc(o.title)}</h2><ol class="handout-list">${handout.map((id, i) => {
        const p = byId.get(id);
        const tag = [o.ids ? p.id : "", o.sources && p.source ? p.source : ""].filter(Boolean).join(", ");
        return `<li class="handout-item">
          <div class="row no-print handout-tools">
            <a href="#/p/${p.id}">${p.id}</a>
            <span class="spacer"></span>
            <button class="btn-mini" data-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="btn-mini" data-move="${i}" data-dir="1" ${i === handout.length - 1 ? "disabled" : ""}>↓</button>
            <button class="btn-mini" data-remove="${p.id}">Remove</button>
          </div>
          <div class="statement">${tex(p.statement)}</div>
          ${tag ? `<div class="handout-tag">(${esc(tag)})</div>` : ""}
        </li>`;
      }).join("")}</ol>`;
      return o;
    };
    draw();
    ["h-title", "h-sources", "h-ids"].forEach((id) => document.getElementById(id).addEventListener("input", draw));
    doc.addEventListener("click", (e) => {
      const mv = e.target.closest("[data-move]"), rm = e.target.closest("[data-remove]");
      if (mv) {
        const i = Number(mv.dataset.move), j = i + Number(mv.dataset.dir);
        [handout[i], handout[j]] = [handout[j], handout[i]];
        saveHandout(); draw();
      } else if (rm) {
        handout = handout.filter((x) => x !== rm.dataset.remove);
        saveHandout(); handout.length ? draw() : viewHandout();
      }
    });
    document.getElementById("h-print").onclick = () => window.print();
    document.getElementById("h-tex").onclick = () => {
      const o = draw();
      const blob = new Blob([handoutLatex(o.title, o.sources, o.ids)], { type: "application/x-tex" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (o.title.trim() || "handout").replace(/[^\w-]+/g, "_") + ".tex";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    document.getElementById("h-copy").onclick = (e) => {
      const o = draw();
      if (navigator.clipboard) navigator.clipboard.writeText(handoutLatex(o.title, o.sources, o.ids)).then(() => {
        e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy LaTeX"), 1500);
      }, () => {});
    };
    document.getElementById("h-clear").onclick = () => {
      if (confirm("Remove all problems from the handout?")) { handout = []; saveHandout(); viewHandout(); }
    };
  }

  function clampStatements(root) {
    root.querySelectorAll(".problem-card .statement").forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 4) el.classList.add("clamped");
    });
  }

  // Renders a long problem list PAGE items at a time.
  function pagedList(container, list, L, emptyText) {
    let shown = 0;
    container.innerHTML = list.length ? `<div class="problem-list"></div><div class="more"></div>`
                                      : `<p class="muted">${esc(emptyText || "No problems.")}</p>`;
    if (!list.length) return;
    const ul = container.querySelector(".problem-list");
    const more = container.querySelector(".more");
    const step = () => {
      const chunk = list.slice(shown, shown + PAGE);
      ul.insertAdjacentHTML("beforeend", chunk.map((p) => problemCard(p, L)).join(""));
      shown += chunk.length;
      clampStatements(ul);
      more.innerHTML = shown < list.length
        ? `<button class="btn">Show more (${list.length - shown} left)</button>` : "";
      const b = more.querySelector("button");
      if (b) b.onclick = step;
    };
    step();
  }

  // ---------- views ----------
  function viewHome() {
    const counts = Object.fromEntries(SUBJECTS.map((s) => [s, problems.filter((p) => p.subject === s).length]));
    const withSource = problems.filter((p) => p.source).length;
    const lastL = store.get("level", 2), lastS = store.get("subject", "any");
    app.innerHTML = `
      <section class="hero">
        <h1>Olympiad Problem Archive</h1>
        <p class="lead">Problems from ten years of the Saudi national training program, organised by subject, topic and level, plus the IMO Shortlist and EGMO.</p>
        <div class="stats">
          <span><b>${problems.length.toLocaleString()}</b> problems</span>
          <span><b>${A.topics.length}</b> topics</span>
          <span><b>4</b> levels</span>
          <span><b>${withSource.toLocaleString()}</b> with a known competition source</span>
        </div>
      </section>
      <section class="grid subjects">
        ${SUBJECTS.map((s) => `
          <a class="card subject-card" href="#/s/${s}/${lastL}" style="--c: var(--${s})">
            <h2>${esc(subjName(s))}</h2>
            <div class="muted">${counts[s].toLocaleString()} problems · ${A.topics.filter((t) => t.subject === s).length} topics</div>
            <div class="levels">${LEVELS.map((L) => `<span class="pill">L${L}: ${problems.filter((p) => p.subject === s && inLevel(p, L)).length}</span>`).join("")}</div>
          </a>`).join("")}
      </section>
      <section class="card recommend">
        <h2>Recommend me a problem</h2>
        <p class="muted small" style="margin:0">Picks a random problem for your level. Starred problems come up more often.</p>
        <form class="row" id="rec-form">
          <label>Subject
            <select name="s">
              <option value="any">Any subject</option>
              ${SUBJECTS.map((s) => `<option value="${s}" ${s === lastS ? "selected" : ""}>${esc(subjName(s))}</option>`).join("")}
            </select>
          </label>
          <label>Level
            <select name="L">${LEVELS.map((L) => `<option value="${L}" ${L === lastL ? "selected" : ""}>${esc(levelName(L))}</option>`).join("")}</select>
          </label>
          <button class="btn primary" type="submit">Give me a problem</button>
        </form>
      </section>
      <section>
        <h2>Levels</h2>
        <div class="grid subjects">
          ${LEVELS.map((L) => `<div class="card"><h3>${esc(levelName(L))}</h3><div class="muted small">${esc(A.levels[L].description || "")}</div></div>`).join("")}
        </div>
      </section>`;
    document.getElementById("rec-form").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      location.hash = `#/random/${f.get("s")}/${f.get("L")}`;
    };
  }

  function levelTabs(hrefFor, available, current) {
    return `<nav class="tabs">${LEVELS.map((L) => `<a href="${hrefFor(L)}" class="${L === current ? "active" : ""} ${available.includes(L) ? "" : "empty"}">${esc(levelName(L))}</a>`).join("")}</nav>`;
  }

  function viewSubject(s, L) {
    if (!A.subjects[s]) return viewNotFound();
    L = LEVELS.includes(L) ? L : store.get("level", 2);
    store.set("level", L);
    const topics = A.topics.filter((t) => t.subject === s)
      .map((t) => ({ t, n: topicCount(t.id, L), kc: ((t.levels[L] || {}).key_concepts || []).length }))
      .filter((x) => x.n || x.kc)
      .sort((a, b) => a.t.name.localeCompare(b.t.name));
    const total = problems.filter((p) => p.subject === s && inLevel(p, L)).length;
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › ${esc(subjName(s))}</div>
      <div class="row"><h1>${esc(subjName(s))}</h1><span class="spacer"></span>
        <a class="btn" href="#/random/${s}/${L}">Random ${esc(subjName(s))} problem at ${esc(levelName(L))}</a></div>
      ${levelTabs((x) => `#/s/${s}/${x}`, LEVELS, L)}
      <p class="lead">${esc(A.levels[L].description || "")} ${total.toLocaleString()} problems in ${topics.length} topics.</p>
      <div class="grid topics">
        ${topics.map(({ t, n, kc }) => `
          <a class="card topic-card" href="#/t/${t.id}/${L}">
            <h3>${esc(t.name)}</h3>
            <div class="count">${n} problem${n === 1 ? "" : "s"}${kc ? ` · ${kc} key concept${kc === 1 ? "" : "s"}` : ""}</div>
          </a>`).join("") || `<p class="muted">No topics at this level yet.</p>`}
      </div>`;
  }

  function viewTopic(tid, L) {
    const t = topicById.get(tid);
    if (!t) return viewNotFound();
    const avail = topicLevels(t);
    if (!avail.includes(L)) L = avail[0];
    store.set("level", L);
    const block = t.levels[L] || {};
    const all = sortProblems((byTopic.get(t.id) || []).filter((p) => inLevel(p, L)));
    const kcs = block.key_concepts || [];
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › <a href="#/s/${t.subject}/${L}">${esc(subjName(t.subject))}</a> › ${esc(levelName(L))}</div>
      <div class="row"><h1>${esc(t.name)}</h1><span class="spacer"></span>
        ${all.length ? `<a class="btn" href="#/random/topic:${t.id}/${L}">Random problem from this topic</a>` : ""}</div>
      ${levelTabs((x) => `#/t/${t.id}/${x}`, avail, L)}
      ${block.sections && block.sections.length ? `<div class="sections-note">From the training book: ${block.sections.map(esc).join(" · ")}</div>` : ""}
      ${block.intro ? `<div class="intro">${tex(block.intro)}</div>` : ""}
      ${kcs.length ? `<h2>Key concepts</h2><div class="concepts">${kcs.map((k) => `
        <div class="card concept">
          <div class="kind">${esc(k.kind || "concept")}</div>
          ${k.title ? `<div class="title">${esc(k.title)}</div>` : ""}
          <div class="body">${tex(k.body)}</div>
        </div>`).join("")}</div>` : ""}
      <div class="row"><h2 style="margin:0">Problems</h2><span class="muted">${all.length}</span></div>
      <div class="filters" id="filters">
        <button class="chip" data-f="stars">★ Starred only</button>
        <button class="chip" data-f="hard">Hard only</button>
        <button class="chip" data-f="source">With competition source</button>
      </div>
      <div id="plist"></div>`;
    const active = new Set();
    const apply = () => {
      const list = all.filter((p) => (!active.has("stars") || p.stars > 0) && (!active.has("hard") || p.hard)
                                     && (!active.has("source") || p.source));
      pagedList(document.getElementById("plist"), list, L, "No problems match these filters.");
    };
    document.querySelectorAll("#filters .chip").forEach((b) => {
      b.onclick = () => {
        active.has(b.dataset.f) ? active.delete(b.dataset.f) : active.add(b.dataset.f);
        b.classList.toggle("on");
        apply();
      };
    });
    apply();
  }

  function problemBody(p, opts = {}) {
    const L = opts.level || p.levels[0];
    const o = p.origin || {};
    const originBits = [];
    if (o.book) {
      const label = `Training book, ${esc(o.book)}${o.book_page ? `, page ${o.book_page}` : ""}`;
      originBits.push((o.book_page
        ? `<a href="material/training-book.pdf#page=${o.book_page}" target="_blank" rel="noopener">${label}</a>`
        : label) + (o.section ? ` <span class="muted">· ${esc(o.section)}</span>` : ""));
    }
    if (o.official) {
      const what = /^EGMO/.test(p.source || "") ? "Official EGMO problems and solutions" : "Official IMO Shortlist booklet (with solutions)";
      originBits.push(`<a href="${esc(o.official)}" target="_blank" rel="noopener">${what}</a>`);
    }
    if (o.handout) originBits.push(`<span class="muted">Original handout: ${esc(prettyHandout(o.handout))}</span>`);
    const hints = p.hints || [];
    return `
      <div class="statement">${tex(p.statement)}</div>
      <dl class="meta">
        ${p.source ? `<dt>Source</dt><dd>${esc(p.source)}</dd>` : ""}
        <dt>Topics</dt><dd>${p.topics.map((t) => topicLink(t, L)).join(" · ")}</dd>
        <dt>Levels</dt><dd>${p.levels.map((x) => esc(levelName(x))).join(", ")}</dd>
        ${(p.related || []).length ? `<dt>Related</dt><dd>${p.related.filter((r) => byId.has(r)).map((r) =>
          `<a href="#/p/${r}" title="A variant of this problem">${r}</a>${byId.get(r).source ? ` <span class="muted small">(${esc(byId.get(r).source)})</span>` : ""}`).join(" · ")}</dd>` : ""}
        ${originBits.length ? `<dt>Material</dt><dd class="small">${originBits.join("<br>")}</dd>` : ""}
        ${p.aops ? `<dt>Link</dt><dd><a href="${esc(p.aops)}" target="_blank" rel="noopener">${esc(aopsLabel(p))}</a></dd>` : ""}
      </dl>
      ${p.needs_check ? `<div class="notice">The statement could not be fully verified against the original (damaged) source files.</div>` : ""}
      ${p.notes ? `<details class="editor-notes"><summary>Notes for editors</summary>${esc(p.notes)}</details>` : ""}
      ${hints.map((h, i) => `<details class="reveal"><summary>Hint ${i + 1}${h.by ? ` <span class="pill">${esc(h.by)}</span>` : ""}</summary><div>${tex(h.text)}</div></details>`).join("")}
      ${p.solution ? `<details class="reveal"><summary>Solution</summary><div>${tex(p.solution)}</div></details>` : ""}`;
  }

  function viewProblem(id) {
    const p = byId.get(id);
    if (!p) return viewNotFound();
    const L = p.levels.includes(store.get("level", 0)) ? store.get("level", 0) : p.levels[0];
    const idx = problems.indexOf(p);
    const prev = problems[idx - 1], next = problems[idx + 1];
    const t0 = topicById.get(p.topics[0]);
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › <a href="#/s/${p.subject}/${L}">${esc(subjName(p.subject))}</a>
        ${t0 ? ` › ${topicLink(t0.id, L)}` : ""}</div>
      <article class="problem-view">
        <div class="row"><h1 style="margin:0">Problem ${p.id}</h1> ${pills(p)}</div>
        <div class="card" style="margin-top:14px">${problemBody(p, { level: L })}</div>
        <div class="row" style="margin-top:16px">
          ${t0 ? `<a class="btn" href="#/random/topic:${t0.id}/${L}">Another problem from ${esc(t0.name)}</a>` : ""}
          ${handoutButton(p).replace("btn-mini", "btn")}
          <button class="btn" id="copy">Copy LaTeX</button>
          <a class="btn" href="${githubEdit(p)}" target="_blank" rel="noopener">Edit on GitHub</a>
          <span class="spacer"></span>
          ${prev ? `<a class="btn" href="#/p/${prev.id}">← ${prev.id}</a>` : ""}
          ${next ? `<a class="btn" href="#/p/${next.id}">${next.id} →</a>` : ""}
        </div>
      </article>`;
    document.getElementById("copy").onclick = (e) => {
      const done = () => { e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy LaTeX"), 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(p.statement).then(done, () => {});
    };
  }

  const seen = new Set();
  function viewRandom(scope, L) {
    let pool, label, back;
    if (scope.startsWith("topic:")) {
      const t = topicById.get(scope.slice(6));
      if (!t) return viewNotFound();
      pool = (byTopic.get(t.id) || []).filter((p) => inLevel(p, L));
      label = `${t.name}, ${levelName(L)}`;
      back = `#/t/${t.id}/${L}`;
    } else {
      pool = problems.filter((p) => inLevel(p, L) && (scope === "any" || p.subject === scope));
      label = `${scope === "any" ? "Any subject" : subjName(scope)}, ${levelName(L)}`;
      back = scope === "any" ? "#/" : `#/s/${scope}/${L}`;
      store.set("subject", scope);
    }
    store.set("level", L);
    if (!pool.length) { app.innerHTML = `<p class="muted">No problems for ${esc(label)}.</p>`; return; }
    let fresh = pool.filter((p) => !seen.has(p.id));
    if (!fresh.length) { pool.forEach((p) => seen.delete(p.id)); fresh = pool; }
    const weights = fresh.map((p) => 1 + 3 * (p.stars || 0));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    let pick = fresh[0];
    for (let i = 0; i < fresh.length; i++) { r -= weights[i]; if (r <= 0) { pick = fresh[i]; break; } }
    seen.add(pick.id);
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › <a href="${back}">${esc(label)}</a> › Recommended</div>
      <div class="row"><h1 style="margin:0">Try this one</h1> <span class="muted">${esc(label)}</span></div>
      <div class="card" style="margin-top:14px">
        <div class="head row" style="margin-bottom:8px"><a class="pid" href="#/p/${pick.id}"><b>${pick.id}</b></a> ${pills(pick)}<span class="spacer"></span>${handoutButton(pick)}</div>
        ${problemBody(pick, { level: L })}
      </div>
      <div class="row" style="margin-top:16px">
        <button class="btn primary" id="again">Another problem</button>
        <a class="btn" href="#/p/${pick.id}">Open problem page</a>
        <a class="btn" href="${back}">Back</a>
      </div>`;
    document.getElementById("again").onclick = () => viewRandom(scope, L);
  }

  let searchIndex = null;
  function viewSearch(q) {
    document.getElementById("search-input").value = q;
    if (!searchIndex) {
      searchIndex = problems.map((p) => [p, [p.id, p.source || "", p.statement.replace(/\\[a-zA-Z]+/g, " "),
        p.topics.map((t) => (topicById.get(t) || {}).name || "").join(" ")].join(" ").toLowerCase()]);
    }
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const exact = byId.get(q.trim().toUpperCase());
    const hits = terms.length ? searchIndex.filter(([, s]) => terms.every((w) => s.includes(w))).map(([p]) => p) : [];
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Home</a> › Search</div>
      <h1>Search</h1>
      <p class="lead">${hits.length.toLocaleString()} result${hits.length === 1 ? "" : "s"} for “${esc(q)}”${exact ? ` · <a href="#/p/${exact.id}">go to ${exact.id}</a>` : ""}</p>
      <div id="plist"></div>`;
    // Problems whose source contains the whole query (e.g. "ISL 2015 A1") come first.
    const ql = q.trim().toLowerCase();
    const inSource = (p) => (p.source || "").toLowerCase().includes(ql);
    const ranked = sortProblems(hits).sort((a, b) => inSource(b) - inSource(a));
    pagedList(document.getElementById("plist"), ranked, null, "Try other words, a source like “ISL 2015”, or an ID like A0012.");
  }

  function viewNotFound() {
    app.innerHTML = `<h1>Not found</h1><p><a href="#/">Back to the start page</a></p>`;
  }

  // ---------- router ----------
  let currentNav = null;
  function nav(active) {
    currentNav = active;
    document.getElementById("topnav").innerHTML = SUBJECTS.map((s) =>
      `<a href="#/s/${s}/${store.get("level", 2)}" class="${active === s ? "active" : ""}">${esc(subjName(s))}</a>`).join("")
      + `<a href="#/random/${store.get("subject", "any")}/${store.get("level", 2)}" class="${active === "random" ? "active" : ""}">Recommend</a>`
      + `<a href="#/handout" class="${active === "handout" ? "active" : ""}">Handout${handout.length ? ` (${handout.length})` : ""}</a>`;
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    const [view, a, b] = parts;
    let active = null;
    if (!view) viewHome();
    else if (view === "s") { viewSubject(a, Number(b)); active = a; }
    else if (view === "t") { viewTopic(a, Number(b)); active = (topicById.get(a) || {}).subject; }
    else if (view === "p") { viewProblem(a); active = (byId.get(a) || {}).subject; }
    else if (view === "random") { viewRandom(a || "any", Number(b) || 2); active = "random"; }
    else if (view === "search") viewSearch(parts.slice(1).join("/"));
    else if (view === "handout") { viewHandout(); active = "handout"; }
    else viewNotFound();
    nav(active);
    window.scrollTo(0, 0);
  }

  document.getElementById("search-form").onsubmit = (e) => {
    e.preventDefault();
    const q = document.getElementById("search-input").value.trim();
    if (q) location.hash = "#/search/" + encodeURIComponent(q);
  };
  window.addEventListener("hashchange", route);
  route();
})();
