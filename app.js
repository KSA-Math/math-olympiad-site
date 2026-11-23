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

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tex = (s) => (s ? window.TeX.render(String(s), window.katex) : "");
  const store = {
    get(k, d) { try { const v = localStorage.getItem("archive:" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("archive:" + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const inLevel = (p, L) => L === 0 || p.levels.includes(L);   // 0 = any level
  const sortProblems = (list) => list.slice().sort((a, b) => (b.stars - a.stars) || a.id.localeCompare(b.id));
  const starText = (n) => "★".repeat(n);
  const githubEdit = (p) => `${REPO}/edit/main/data/problems/${p.subject}/${p.id}.yaml`;

  // ---------- language: English, or Arabic (whole site right to left) ----------
  let lang = store.get("lang", "en") === "ar" ? "ar" : "en";
  const AR = () => lang === "ar";
  const T = (en, ar) => (lang === "ar" ? ar : en);
  const num = (n) => n.toLocaleString("en-US");
  const SEP = () => T(" › ", " ‹ ");
  // count(n, ["problem", "problems"], ["مسألة واحدة", "مسألتان", "مسائل", "مسألة"])
  function count(n, en, ar) {
    if (!AR()) return `${num(n)} ${n === 1 ? en[0] : en[1]}`;
    if (n === 1) return ar[0];
    if (n === 2) return ar[1];
    return `${num(n)} ${n >= 3 && n <= 10 ? ar[2] : ar[3]}`;
  }
  const W = {
    problems: [["problem", "problems"], ["مسألة واحدة", "مسألتان", "مسائل", "مسألة"]],
    topics: [["topic", "topics"], ["موضوع واحد", "موضوعان", "مواضيع", "موضوعًا"]],
    concepts: [["key concept", "key concepts"], ["مفهوم أساسي واحد", "مفهومان أساسيان", "مفاهيم أساسية", "مفهومًا أساسيًا"]],
    results: [["result", "results"], ["نتيجة واحدة", "نتيجتان", "نتائج", "نتيجة"]],
  };
  const cnt = (n, w) => count(n, W[w][0], W[w][1]);

  const subjName = (s) => T(A.subjects[s].name, A.subjects[s].name_ar || A.subjects[s].name);
  const levelName = (L) => L === 0 ? T("Any level", "أي مستوى") : T(A.levels[L].name, A.levels[L].name_ar || A.levels[L].name);
  const levelDesc = (L) => T(A.levels[L].description || "", A.levels[L].description_ar || A.levels[L].description || "");
  const topicName = (t) => T(t.name, t.name_ar || t.name);
  const byName = (a, b) => topicName(a).localeCompare(topicName(b), lang);
  const levelPill = (ls) => AR() ? (ls.length === 1 ? `المستوى ${ls[0]}` : `المستويات ${ls.join("، ")}`)
                                 : ls.map((L) => "L" + L).join(" · ");
  // English-only content (key concepts, solutions, file names) keeps its own direction on the Arabic site.
  const EN = ' lang="en" dir="ltr"';
  const KIND_AR = { theorem: "مبرهنة", lemma: "تمهيدية", corollary: "نتيجة", definition: "تعريف",
                    technique: "طريقة", remark: "ملاحظة", concept: "مفهوم" };

  const useAr = (p) => AR() && p.ar && p.ar.statement;
  const statementSrc = (p) => (useAr(p) ? p.ar.statement : p.statement);
  const statementHtml = (p) => useAr(p)
    ? `<div class="statement" lang="ar" dir="rtl">${tex(p.ar.statement)}</div>`
    : `<div class="statement"${EN}>${tex(p.statement)}</div>`;

  function setLang(l) { lang = l; store.set("lang", l); chrome(); route(); }
  // The parts of the page outside #app.
  function chrome() {
    const h = document.documentElement;
    h.lang = lang;
    h.dir = AR() ? "rtl" : "ltr";
    document.title = T("Olympiad Problem Archive", "أرشيف مسائل الرياضيات");
    document.getElementById("brand-name").textContent = T("Olympiad Problem Archive", "أرشيف مسائل الرياضيات");
    document.querySelector(".brand-logo").alt = T("Saudi Math Team logo", "شعار الفريق السعودي للرياضيات");
    const si = document.getElementById("search-input");
    si.placeholder = T("Search…", "ابحث…");
    si.title = T("Search by words, source (e.g. ISL 2015 A1) or ID", "ابحث بالكلمات أو بالمصدر (مثل ISL 2015 A1) أو برقم المسألة");
    si.setAttribute("aria-label", T("Search", "بحث"));
    document.getElementById("footer").textContent = T(
      "Problems from the training material of the Saudi Arabian Mathematical Olympiad program (2016–2026), the IMO Shortlist and EGMO. Sources are shown where known.",
      "مسائل من المواد التدريبية لبرنامج الأولمبياد السعودي للرياضيات (2016–2026)، ومن القائمة القصيرة للأولمبياد الدولي (ISL) وأولمبياد البنات الأوروبي (EGMO). يُذكر مصدر المسألة حين يكون معروفًا.");
    const b = document.getElementById("lang-toggle");
    b.textContent = T("عربي", "English");
    b.lang = T("ar", "en");
    b.title = T("اعرض الموقع بالعربية", "Show the site in English");
  }

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
    return `<a href="#/t/${t.id}/${L}">${esc(topicName(t))}</a>`;
  }
  function prettyHandout(s) {
    return String(s).replace(/^year\s+/, "").replace(/\.(txt|tex|pdf)\b/g, "");
  }

  function aopsLabel(p) {
    const url = p.aops;
    const m = /\b(ISL|EGMO) (\d{4})\b/.exec(p.source || "");
    const contest = m ? (m[1] === "ISL" ? T("IMO Shortlist", "القائمة القصيرة للأولمبياد الدولي") : "EGMO") : "";
    if (/\/c\d+h\d+/.test(url)) return T("Discussion thread on AoPS", "نقاش المسألة على موقع AoPS");
    if (/c3223_imo_shortlist|European_Girls/.test(url)) return T(`AoPS: ${contest || "contest"} page (all years)`, `AoPS: صفحة ${contest || "المسابقة"} (كل السنوات)`);
    if (/\/wiki\//.test(url)) return T(`AoPS Wiki: ${m ? `${m[2]} ${contest}` : "contest"} problems`, `ويكي AoPS: مسائل ${m ? `${contest} ${m[2]}` : "المسابقة"}`);
    return m ? T(`${contest} ${m[2]} on AoPS (problems and discussion threads)`, `${contest} ${m[2]} على موقع AoPS (المسائل ونقاشاتها)`) : "AoPS";
  }

  function pills(p, inTopic) {
    const out = [];
    if (!inTopic) {   // on a topic page the subject is known; show only extra levels
      out.push(`<span class="pill subject-${p.subject}">${esc(subjName(p.subject))}</span>`);
      out.push(`<span class="pill">${levelPill(p.levels)}</span>`);
    } else if (p.levels.length > 1) {
      out.push(`<span class="pill" title="${T("Also used at these levels", "تُستخدم أيضًا في هذه المستويات")}">${levelPill(p.levels)}</span>`);
    }
    if (p.stars) out.push(`<span class="pill stars" title="${esc(T(A.stars[p.stars] || "", "مسألة مميّزة"))}">${starText(p.stars)}</span>`);
    if (p.hard) out.push(`<span class="pill hard" title="${T("Hard for its level (marked in the source handouts, or IMO Shortlist problem 6 or later)", "صعبة لمستواها (حسب الملزمات الأصلية، أو من مسائل القائمة القصيرة رقم 6 فما بعد)")}">${T("hard", "صعبة")}</span>`);
    return out.join(" ");
  }

  function problemCard(p, L) {
    return `
      <article class="card problem-card">
        <div class="head">
          <a class="pid" href="#/p/${p.id}">${p.id}</a>
          ${pills(p, L != null)}
          ${p.source ? `<span class="source" dir="ltr">${esc(p.source)}</span>` : ""}
          <span class="spacer"></span>
          ${handoutButton(p)}
          <a class="small" href="#/p/${p.id}">${T("Open →", "افتح ←")}</a>
        </div>
        ${statementHtml(p)}
      </article>`;
  }

  // ---------- handout (a per-browser list of chosen problems) ----------
  let handout = store.get("handout", []).filter((id) => byId.has(id));
  const inHandout = (id) => handout.includes(id);
  function saveHandout() { store.set("handout", handout); nav(currentNav); }
  function handoutButton(p) {
    const on = inHandout(p.id);
    return `<button class="btn-mini add-h ${on ? "on" : ""}" data-id="${p.id}" title="${T("Add to / remove from your handout", "أضف إلى الملزمة أو احذف منها")}">${on ? T("✓ In handout", "✓ في الملزمة") : T("+ Handout", "+ الملزمة")}</button>`;
  }
  app.addEventListener("click", (e) => {
    const b = e.target.closest(".add-h");
    if (!b) return;
    const id = b.dataset.id;
    handout = inHandout(id) ? handout.filter((x) => x !== id) : handout.concat(id);
    saveHandout();
    document.querySelectorAll(`.add-h[data-id="${id}"]`).forEach((el) => {
      const big = el.classList.contains("btn");
      el.outerHTML = big ? handoutButton(byId.get(id)).replace("btn-mini", "btn") : handoutButton(byId.get(id));
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
    const opts = store.get("handoutOpts", { title: T("Problem set", "مجموعة مسائل"), sources: true, ids: false });
    const list = handout.map((id) => byId.get(id));
    app.innerHTML = `
      <div class="crumbs no-print"><a href="#/">${T("Home", "الرئيسية")}</a>${SEP()}${T("Handout", "الملزمة")}</div>
      <div class="no-print">
        <h1>${T("Handout", "الملزمة")}</h1>
        <p class="lead">${T(`Collect problems with the <b>+ Handout</b> button on any problem, then print it or export LaTeX.
          The list is saved in this browser only.`, `اجمع المسائل بزر <b>+ الملزمة</b> الموجود في كل مسألة، ثم اطبعها أو صدّرها بصيغة LaTeX.
          تُحفظ القائمة في هذا المتصفح فقط.`)}</p>
        ${list.length ? `
        <div class="card handout-controls">
          <label class="field">${T("Title", "العنوان")} <input id="h-title" value="${esc(opts.title)}"></label>
          <label><input type="checkbox" id="h-sources" ${opts.sources ? "checked" : ""}> ${T("Show sources", "أظهر المصادر")}</label>
          <label><input type="checkbox" id="h-ids" ${opts.ids ? "checked" : ""}> ${T("Show problem IDs", "أظهر أرقام المسائل")}</label>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="h-print">${T("Print / save as PDF", "اطبع / احفظ PDF")}</button>
            <button class="btn" id="h-tex" title="${T("", "ملف LaTeX بنصوص المسائل الإنجليزية")}">${T("Download .tex", "نزّل ملف ‎.tex")}</button>
            <button class="btn" id="h-copy">${T("Copy LaTeX", "انسخ LaTeX")}</button>
            <span class="spacer"></span>
            <button class="btn" id="h-clear">${T("Clear handout", "أفرغ الملزمة")}</button>
          </div>
          ${AR() ? `<p class="muted small" style="margin:8px 0 0">ملف LaTeX يحتوي على نصوص المسائل بالإنجليزية.</p>` : ""}
        </div>` : `<p class="muted">${T("Your handout is empty.", "ملزمتك فارغة.")}</p>`}
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
            <button class="btn-mini" data-remove="${p.id}">${T("Remove", "احذف")}</button>
          </div>
          ${statementHtml(p)}
          ${tag ? `<div class="handout-tag"><span dir="ltr">(${esc(tag)})</span></div>` : ""}
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
      a.download = (o.title.trim().replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "handout") + ".tex";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    document.getElementById("h-copy").onclick = (e) => {
      const o = draw();
      const label = e.target.textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(handoutLatex(o.title, o.sources, o.ids)).then(() => {
        e.target.textContent = T("Copied", "نُسخ"); setTimeout(() => (e.target.textContent = label), 1500);
      }, () => {});
    };
    document.getElementById("h-clear").onclick = () => {
      if (confirm(T("Remove all problems from the handout?", "حذف كل المسائل من الملزمة؟"))) { handout = []; saveHandout(); viewHandout(); }
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
                                      : `<p class="muted">${esc(emptyText || T("No problems.", "لا توجد مسائل."))}</p>`;
    if (!list.length) return;
    const ul = container.querySelector(".problem-list");
    const more = container.querySelector(".more");
    const step = () => {
      const chunk = list.slice(shown, shown + PAGE);
      ul.insertAdjacentHTML("beforeend", chunk.map((p) => problemCard(p, L)).join(""));
      shown += chunk.length;
      clampStatements(ul);
      more.innerHTML = shown < list.length
        ? `<button class="btn">${T(`Show more (${num(list.length - shown)} left)`, `أظهر المزيد (بقي ${num(list.length - shown)})`)}</button>` : "";
      const b = more.querySelector("button");
      if (b) b.onclick = step;
    };
    step();
  }

  // ---------- views ----------
  function viewHome() {
    const counts = Object.fromEntries(SUBJECTS.map((s) => [s, problems.filter((p) => p.subject === s).length]));
    const withSource = problems.filter((p) => p.source).length;
    const lastL = store.get("level", 2), recL = store.get("recLevel", lastL), lastS = store.get("subject", "any");
    app.innerHTML = `
      <section class="hero">
        <h1>${T("Olympiad Problem Archive", "أرشيف مسائل الرياضيات")}</h1>
        <p class="lead">${T("Problems from ten years of the Saudi national training program, organised by subject, topic and level, plus the IMO Shortlist and EGMO.",
          "مسائل من عشر سنوات من برنامج التدريب الوطني السعودي، مرتّبة حسب المجال والموضوع والمستوى، إضافةً إلى القائمة القصيرة للأولمبياد الدولي وأولمبياد البنات الأوروبي.")}</p>
        <div class="stats">
          <span><b>${num(problems.length)}</b> ${T("problems", "مسألة")}</span>
          <span><b>${A.topics.length}</b> ${T("topics", "موضوعًا")}</span>
          <span><b>4</b> ${T("levels", "مستويات")}</span>
          <span><b>${num(withSource)}</b> ${T("with a known competition source", "مسألة من مسابقة معروفة")}</span>
        </div>
      </section>
      <section class="grid subjects">
        ${SUBJECTS.map((s) => `
          <a class="card subject-card" href="#/s/${s}/${lastL}" style="--c: var(--${s})">
            <h2>${esc(subjName(s))}</h2>
            <div class="muted">${cnt(counts[s], "problems")} · ${cnt(A.topics.filter((t) => t.subject === s).length, "topics")}</div>
            <div class="levels">${LEVELS.map((L) => `<span class="pill">${T("L" + L, "م" + L)}: ${problems.filter((p) => p.subject === s && inLevel(p, L)).length}</span>`).join("")}</div>
          </a>`).join("")}
      </section>
      <section class="card recommend">
        <h2>${T("Recommend me a problem", "اقترح عليّ مسألة")}</h2>
        <p class="muted small" style="margin:0">${T("Picks a random problem for your level. Starred problems come up more often.",
          "يختار مسألة عشوائية من مستواك، وتظهر المسائل المميّزة بنجمة أكثر من غيرها.")}</p>
        <form class="row" id="rec-form">
          <label>${T("Subject", "المجال")}
            <select name="s">
              <option value="any">${T("Any subject", "أي مجال")}</option>
              ${SUBJECTS.map((s) => `<option value="${s}" ${s === lastS ? "selected" : ""}>${esc(subjName(s))}</option>`).join("")}
            </select>
          </label>
          <label>${T("Level", "المستوى")}
            <select name="L">${[0, ...LEVELS].map((L) => `<option value="${L}" ${L === recL ? "selected" : ""}>${esc(levelName(L))}</option>`).join("")}</select>
          </label>
          <label id="rec-topic-wrap" hidden>${T("Topic", "الموضوع")}
            <select name="t"></select>
          </label>
          <button class="btn primary" type="submit">${T("Give me a problem", "أعطني مسألة")}</button>
        </form>
      </section>
      <section>
        <h2>${T("Levels", "المستويات")}</h2>
        <div class="grid subjects">
          ${LEVELS.map((L) => `<a class="card level-card" href="#/l/${L}"><h3>${esc(levelName(L))}</h3><div class="muted small">${esc(levelDesc(L))}</div>
            <div class="count">${cnt(problems.filter((p) => inLevel(p, L)).length, "problems")} · ${cnt(A.topics.filter((t) => topicCount(t.id, L) > 0).length, "topics")}</div></a>`).join("")}
        </div>
      </section>`;
    // Topic picker appears once a subject is chosen; lists that subject's topics at the chosen level.
    const form = document.getElementById("rec-form");
    const wrap = document.getElementById("rec-topic-wrap");
    const [selS, selL, selT] = ["s", "L", "t"].map((n) => form.querySelector(`[name="${n}"]`));
    const fillTopics = () => {
      const s = selS.value, L = Number(selL.value), keep = selT.value || store.get("topic", "");
      if (s === "any") { wrap.hidden = true; selT.innerHTML = ""; return; }
      const ts = A.topics.filter((t) => t.subject === s && topicCount(t.id, L) > 0).sort(byName);
      selT.innerHTML = `<option value="">${T("Any topic", "أي موضوع")}</option>` + ts.map((t) =>
        `<option value="${t.id}" ${t.id === keep ? "selected" : ""}>${esc(topicName(t))} (${topicCount(t.id, L)})</option>`).join("");
      wrap.hidden = false;
    };
    selS.onchange = fillTopics;
    selL.onchange = fillTopics;
    fillTopics();
    form.onsubmit = (e) => {
      e.preventDefault();
      const s = selS.value, L = selL.value, t = selT.value;
      store.set("topic", t);
      location.hash = t ? `#/random/topic:${t}/${L}` : `#/random/${s}/${L}`;
    };
  }

  function levelTabs(hrefFor, available, current) {
    return `<nav class="tabs">${LEVELS.map((L) => `<a href="${hrefFor(L)}" class="${L === current ? "active" : ""} ${available.includes(L) ? "" : "empty"}">${esc(levelName(L))}</a>`).join("")}</nav>`;
  }

  function topicCards(topics, L) {
    return topics.map(({ t, n, kc }) => `
      <a class="card topic-card" href="#/t/${t.id}/${L}">
        <h3>${esc(topicName(t))}</h3>
        <div class="count">${cnt(n, "problems")}${kc ? ` · ${cnt(kc, "concepts")}` : ""}</div>
      </a>`).join("") || `<p class="muted">${T("No topics at this level yet.", "لا توجد مواضيع في هذا المستوى بعد.")}</p>`;
  }
  function subjectTopics(s, L) {
    return A.topics.filter((t) => t.subject === s)
      .map((t) => ({ t, n: topicCount(t.id, L), kc: ((t.levels[L] || {}).key_concepts || []).length }))
      .filter((x) => x.n || x.kc)
      .sort((a, b) => byName(a.t, b.t));
  }

  function viewSubject(s, L) {
    if (!A.subjects[s]) return viewNotFound();
    L = LEVELS.includes(L) ? L : store.get("level", 2);
    store.set("level", L);
    const topics = subjectTopics(s, L);
    const total = problems.filter((p) => p.subject === s && inLevel(p, L)).length;
    app.innerHTML = `
      <div class="crumbs"><a href="#/">${T("Home", "الرئيسية")}</a>${SEP()}${esc(subjName(s))}</div>
      <div class="row"><h1>${esc(subjName(s))}</h1><span class="spacer"></span>
        <a class="btn" href="#/random/${s}/${L}">${T(`Random ${esc(subjName(s))} problem at ${esc(levelName(L))}`, `مسألة عشوائية في ${esc(subjName(s))}، ${esc(levelName(L))}`)}</a></div>
      ${levelTabs((x) => `#/s/${s}/${x}`, LEVELS, L)}
      <p class="lead">${esc(levelDesc(L))} ${T(`${cnt(total, "problems")} in ${cnt(topics.length, "topics")}.`, `${cnt(total, "problems")} في ${cnt(topics.length, "topics")}.`)}</p>
      <div class="grid topics">${topicCards(topics, L)}</div>`;
  }

  // All topics at one level, grouped by subject.
  function viewLevel(L) {
    if (!LEVELS.includes(L)) return viewNotFound();
    store.set("level", L);
    const total = problems.filter((p) => inLevel(p, L)).length;
    const sections = SUBJECTS.map((s) => {
      const topics = subjectTopics(s, L);
      const n = problems.filter((p) => p.subject === s && inLevel(p, L)).length;
      return `
        <section class="level-subject" style="--c: var(--${s})">
          <div class="row"><h2><a href="#/s/${s}/${L}">${esc(subjName(s))}</a></h2>
            <span class="muted">${cnt(n, "problems")} · ${cnt(topics.length, "topics")}</span><span class="spacer"></span>
            <a class="btn" href="#/random/${s}/${L}">${T(`Random ${esc(subjName(s))} problem`, `مسألة عشوائية في ${esc(subjName(s))}`)}</a></div>
          <div class="grid topics">${topicCards(topics, L)}</div>
        </section>`;
    }).join("");
    app.innerHTML = `
      <div class="crumbs"><a href="#/">${T("Home", "الرئيسية")}</a>${SEP()}${esc(levelName(L))}</div>
      <div class="row"><h1>${esc(levelName(L))}</h1><span class="spacer"></span>
        <a class="btn primary" href="#/random/any/${L}">${T("Random problem at this level", "مسألة عشوائية من هذا المستوى")}</a></div>
      ${levelTabs((x) => `#/l/${x}`, LEVELS, L)}
      <p class="lead">${esc(levelDesc(L))} ${cnt(total, "problems")}.</p>
      ${sections}`;
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
      <div class="crumbs"><a href="#/">${T("Home", "الرئيسية")}</a>${SEP()}<a href="#/s/${t.subject}/${L}">${esc(subjName(t.subject))}</a>${SEP()}${esc(levelName(L))}</div>
      <div class="row"><h1>${esc(topicName(t))}</h1><span class="spacer"></span>
        ${all.length ? `<a class="btn" href="#/random/topic:${t.id}/${L}">${T("Random problem from this topic", "مسألة عشوائية من هذا الموضوع")}</a>` : ""}</div>
      ${levelTabs((x) => `#/t/${t.id}/${x}`, avail, L)}
      ${block.sections && block.sections.length ? `<div class="sections-note">${T("From the training book:", "من كتاب التدريب:")} <span${EN}>${block.sections.map(esc).join(" · ")}</span></div>` : ""}
      ${block.intro ? (AR() && block.intro_ar
        ? `<div class="intro" lang="ar" dir="rtl">${tex(block.intro_ar)}</div>`
        : `<div class="intro"${EN}>${tex(block.intro)}</div>`) : ""}
      ${kcs.length ? `<h2>${T("Key concepts", "مفاهيم أساسية")}</h2><div class="concepts">${kcs.map((k) => {
        const ar = AR() && k.body_ar;
        const title = ar ? k.title_ar || k.title : k.title;
        return `
        <div class="card concept"${ar ? ' lang="ar" dir="rtl"' : EN}>
          <div class="kind">${esc(ar ? KIND_AR[k.kind || "concept"] || k.kind : k.kind || "concept")}</div>
          ${title ? `<div class="title">${tex(title)}</div>` : ""}
          <div class="body">${tex(ar ? k.body_ar : k.body)}</div>
        </div>`;
      }).join("")}</div>` : ""}
      <div class="row"><h2 style="margin:0">${T("Problems", "المسائل")}</h2><span class="muted">${all.length}</span></div>
      <div class="filters" id="filters">
        <button class="chip" data-f="stars">${T("★ Starred only", "★ المميّزة فقط")}</button>
        <button class="chip" data-f="hard">${T("Hard only", "الصعبة فقط")}</button>
        <button class="chip" data-f="source">${T("With competition source", "من مسابقات معروفة")}</button>
      </div>
      <div id="plist"></div>`;
    const active = new Set();
    const apply = () => {
      const list = all.filter((p) => (!active.has("stars") || p.stars > 0) && (!active.has("hard") || p.hard)
                                     && (!active.has("source") || p.source));
      pagedList(document.getElementById("plist"), list, L, T("No problems match these filters.", "لا توجد مسائل تطابق هذه الخيارات."));
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
      const book = AR() ? esc(o.book).replace(/^Problem\b/, "مسألة") : esc(o.book);
      const label = T(`Training book, ${book}${o.book_page ? `, page ${o.book_page}` : ""}`,
                      `كتاب التدريب، ${book}${o.book_page ? `، صفحة ${o.book_page}` : ""}`);
      originBits.push((o.book_page
        ? `<a href="material/training-book.pdf#page=${o.book_page}" target="_blank" rel="noopener">${label}</a>`
        : label) + (o.section ? ` <span class="muted">· <span${EN}>${esc(o.section)}</span></span>` : ""));
    }
    if (o.official) {
      const what = /^EGMO/.test(p.source || "")
        ? T("Official EGMO problems and solutions", "مسائل EGMO الرسمية مع حلولها")
        : T("Official IMO Shortlist booklet (with solutions)", "كتيّب القائمة القصيرة الرسمي للأولمبياد الدولي (مع الحلول)");
      originBits.push(`<a href="${esc(o.official)}" target="_blank" rel="noopener">${what}</a>`);
    }
    if (o.handout) originBits.push(`<span class="muted">${T("Original handout:", "الملزمة الأصلية:")} <span${EN}>${esc(prettyHandout(o.handout))}</span></span>`);
    const ar = useAr(p);
    const hints = (p.hints || []).map((h, i) => ar && p.ar.hints && p.ar.hints[i] ? { ...h, text: p.ar.hints[i], ar: true } : h);
    return `
      ${statementHtml(p)}
      <dl class="meta">
        ${p.source ? `<dt>${T("Source", "المصدر")}</dt><dd dir="ltr" class="ltr-cell">${esc(p.source)}</dd>` : ""}
        <dt>${T("Topics", "المواضيع")}</dt><dd>${p.topics.map((t) => topicLink(t, L)).join(" · ")}</dd>
        <dt>${T("Levels", "المستويات")}</dt><dd>${p.levels.map((x) => esc(levelName(x))).join(T(", ", "، "))}</dd>
        ${(p.related || []).length ? `<dt>${T("Related", "مسائل مرتبطة")}</dt><dd>${p.related.filter((r) => byId.has(r)).map((r) =>
          `<a href="#/p/${r}" title="${T("A variant of this problem", "صيغة أخرى من هذه المسألة")}">${r}</a>${byId.get(r).source ? ` <span class="muted small" dir="ltr">(${esc(byId.get(r).source)})</span>` : ""}`).join(" · ")}</dd>` : ""}
        ${originBits.length ? `<dt>${T("Material", "المادة التدريبية")}</dt><dd class="small">${originBits.join("<br>")}</dd>` : ""}
        ${p.aops ? `<dt>${T("Link", "رابط")}</dt><dd><a href="${esc(p.aops)}" target="_blank" rel="noopener">${esc(aopsLabel(p))}</a></dd>` : ""}
      </dl>
      ${p.needs_check ? `<div class="notice">${T("The statement could not be fully verified against the original (damaged) source files.", "تعذّر التحقق الكامل من نص المسألة مقابل الملفات الأصلية (التالفة).")}</div>` : ""}
      ${p.notes ? `<details class="editor-notes"><summary>${T("Notes for editors", "ملاحظات للمحررين")}</summary><div${EN}>${esc(p.notes)}</div></details>` : ""}
      ${hints.map((h, i) => `<details class="reveal"><summary>${T("Hint", "تلميح")} ${i + 1}${h.by ? ` <span class="pill">${h.by === "trainer" ? T("trainer", "المدرب") : esc(h.by)}</span>` : ""}</summary><div${h.ar ? ' lang="ar" dir="rtl"' : EN}>${tex(h.text)}</div></details>`).join("")}
      ${p.solution ? `<details class="reveal"><summary>${T("Solution", "الحل")}</summary><div${EN}>${tex(p.solution)}</div></details>` : ""}`;
  }

  function viewProblem(id, rec) {
    const p = byId.get(id);
    if (!p) return viewNotFound();
    const rs = rec && recScope(rec.scope, rec.L);
    if (rs) seen.add(p.id);
    const L = rs && p.levels.includes(rec.L) ? rec.L
      : p.levels.includes(store.get("level", 0)) ? store.get("level", 0) : p.levels[0];
    const idx = problems.indexOf(p);
    const prev = problems[idx - 1], next = problems[idx + 1];
    const t0 = topicById.get(p.topics[0]);
    const home = `<a href="#/">${T("Home", "الرئيسية")}</a>`;
    app.innerHTML = `
      <div class="crumbs">${rs
        ? `${home}${SEP()}<a href="${rs.back}">${esc(rs.label)}</a>${SEP()}${T("Recommended", "مقترحة")}`
        : `${home}${SEP()}<a href="#/s/${p.subject}/${L}">${esc(subjName(p.subject))}</a>${t0 ? SEP() + topicLink(t0.id, L) : ""}`}</div>
      <article class="problem-view">
        <div class="row"><h1 style="margin:0">${T("Problem", "المسألة")} ${p.id}</h1> ${pills(p)}</div>
        <div class="card" style="margin-top:14px">${problemBody(p, { level: L })}</div>
        <div class="row" style="margin-top:16px">
          ${rs ? `<a class="btn primary" href="#/random/${encodeURIComponent(rec.scope)}/${rec.L}">${T("Another problem", "مسألة أخرى")}</a>`
               : t0 ? `<a class="btn" href="#/random/topic:${t0.id}/${L}">${T(`Another problem from ${esc(topicName(t0))}`, `مسألة أخرى من ${esc(topicName(t0))}`)}</a>` : ""}
          ${handoutButton(p).replace("btn-mini", "btn")}
          ${p.ar && p.ar.statement ? `<button class="btn" id="p-lang" lang="${T("ar", "en")}">${T("اعرض بالعربية", "Show in English")}</button>` : ""}
          <button class="btn" id="copy">${T("Copy LaTeX", "انسخ LaTeX")}</button>
          <a class="btn" href="${githubEdit(p)}" target="_blank" rel="noopener">${T("Edit on GitHub", "عدّل على GitHub")}</a>
          <span class="spacer"></span>
          ${prev ? `<a class="btn" href="#/p/${prev.id}">${T("← " + prev.id, "→ " + prev.id)}</a>` : ""}
          ${next ? `<a class="btn" href="#/p/${next.id}">${T(next.id + " →", next.id + " ←")}</a>` : ""}
        </div>
      </article>`;
    document.getElementById("copy").onclick = (e) => {
      const label = e.target.textContent;
      const done = () => { e.target.textContent = T("Copied", "نُسخ"); setTimeout(() => (e.target.textContent = label), 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(statementSrc(p)).then(done, () => {});
    };
    const pl = document.getElementById("p-lang");
    if (pl) pl.onclick = () => setLang(AR() ? "en" : "ar");
  }

  // ---------- recommendations ----------
  // #/random/<scope>/<L> picks a problem and replaces itself with that problem's page,
  // #/p/<id>/rec/<scope>/<L>, which carries an "Another problem" button for the same scope.
  function recScope(scope, L) {
    if (L !== 0 && !LEVELS.includes(L)) return null;
    const backL = L || store.get("level", 2);
    if (scope.startsWith("topic:")) {
      const t = topicById.get(scope.slice(6));
      if (!t) return null;
      return { pool: (byTopic.get(t.id) || []).filter((p) => inLevel(p, L)),
               label: `${topicName(t)}${T(", ", "، ")}${levelName(L)}`, back: `#/t/${t.id}/${backL}` };
    }
    if (scope !== "any" && !A.subjects[scope]) return null;
    return { pool: problems.filter((p) => inLevel(p, L) && (scope === "any" || p.subject === scope)),
             label: `${scope === "any" ? T("Any subject", "أي مجال") : subjName(scope)}${T(", ", "، ")}${levelName(L)}`,
             back: scope === "any" ? "#/" : `#/s/${scope}/${backL}` };
  }

  const seen = new Set();
  function viewRandom(scope, L) {
    const r = recScope(scope, L);
    if (!r) return viewNotFound();
    if (!scope.startsWith("topic:")) store.set("subject", scope);
    store.set("recLevel", L);
    if (L) store.set("level", L);
    if (!r.pool.length) { app.innerHTML = `<p class="muted">${T("No problems for", "لا توجد مسائل في")} ${esc(r.label)}.</p>`; return; }
    let fresh = r.pool.filter((p) => !seen.has(p.id));
    if (!fresh.length) { r.pool.forEach((p) => seen.delete(p.id)); fresh = r.pool; }
    const weights = fresh.map((p) => 1 + 3 * (p.stars || 0));
    let x = Math.random() * weights.reduce((a, b) => a + b, 0);
    let pick = fresh[0];
    for (let i = 0; i < fresh.length; i++) { x -= weights[i]; if (x <= 0) { pick = fresh[i]; break; } }
    seen.add(pick.id);
    location.replace(`#/p/${pick.id}/rec/${encodeURIComponent(scope)}/${L}`);
  }

  let searchIndex = null;
  function viewSearch(q) {
    document.getElementById("search-input").value = q;
    if (!searchIndex) {
      searchIndex = problems.map((p) => [p, [p.id, p.source || "", p.statement.replace(/\\[a-zA-Z]+/g, " "),
        p.ar ? p.ar.statement.replace(/\\[a-zA-Z]+/g, " ") : "",
        p.topics.map((t) => { const x = topicById.get(t) || {}; return `${x.name || ""} ${x.name_ar || ""}`; }).join(" ")].join(" ").toLowerCase()]);
    }
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const exact = byId.get(q.trim().toUpperCase());
    const hits = terms.length ? searchIndex.filter(([, s]) => terms.every((w) => s.includes(w))).map(([p]) => p) : [];
    app.innerHTML = `
      <div class="crumbs"><a href="#/">${T("Home", "الرئيسية")}</a>${SEP()}${T("Search", "بحث")}</div>
      <h1>${T("Search", "بحث")}</h1>
      <p class="lead">${T(`${cnt(hits.length, "results")} for “${esc(q)}”`, `${cnt(hits.length, "results")} للبحث عن «${esc(q)}»`)}${exact ? ` · <a href="#/p/${exact.id}">${T("go to", "اذهب إلى")} ${exact.id}</a>` : ""}</p>
      <div id="plist"></div>`;
    // Problems whose source contains the whole query (e.g. "ISL 2015 A1") come first.
    const ql = q.trim().toLowerCase();
    const inSource = (p) => (p.source || "").toLowerCase().includes(ql);
    const ranked = sortProblems(hits).sort((a, b) => inSource(b) - inSource(a));
    pagedList(document.getElementById("plist"), ranked, null,
      T("Try other words, a source like “ISL 2015”, or an ID like A0012.", "جرّب كلمات أخرى، أو مصدرًا مثل ISL 2015، أو رقم مسألة مثل A0012."));
  }

  function viewNotFound() {
    app.innerHTML = `<h1>${T("Not found", "الصفحة غير موجودة")}</h1><p><a href="#/">${T("Back to the start page", "العودة إلى الصفحة الرئيسية")}</a></p>`;
  }

  // ---------- router ----------
  let currentNav = null;
  function nav(active) {
    currentNav = active;
    document.getElementById("topnav").innerHTML = SUBJECTS.map((s) =>
      `<a href="#/s/${s}/${store.get("level", 2)}" class="${active === s ? "active" : ""}">${esc(subjName(s))}</a>`).join("")
      + `<a href="#/random/${store.get("subject", "any")}/${store.get("level", 2)}" class="${active === "random" ? "active" : ""}">${T("Recommend", "اقترح مسألة")}</a>`
      + `<a href="#/handout" class="${active === "handout" ? "active" : ""}">${T("Handout", "الملزمة")}${handout.length ? ` (${handout.length})` : ""}</a>`;
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    const [view, a, b] = parts;
    let active = null;
    if (!view) viewHome();
    else if (view === "l") viewLevel(Number(a));
    else if (view === "s") { viewSubject(a, Number(b)); active = a; }
    else if (view === "t") { viewTopic(a, Number(b)); active = (topicById.get(a) || {}).subject; }
    else if (view === "p") {
      const rec = b === "rec" && parts[3] ? { scope: parts[3], L: parts[4] === "0" ? 0 : Number(parts[4]) || 2 } : null;
      viewProblem(a, rec);
      active = rec ? "random" : (byId.get(a) || {}).subject;
    }
    else if (view === "random") { viewRandom(a || "any", b === "0" ? 0 : Number(b) || 2); active = "random"; }
    else if (view === "search") viewSearch(parts.slice(1).join("/"));
    else if (view === "handout") { viewHandout(); active = "handout"; }
    else viewNotFound();
    nav(active);
    window.scrollTo(0, 0);
  }

  document.getElementById("search-form").onsubmit = (e) => {
    e.preventDefault();
    const q = document.getElementById("search-input").value.trim();
    if (!q) return;
    // A problem id (e.g. N0121, n121) opens the problem directly.
    const m = q.match(/^([ANCG])\s*-?\s*0*(\d{1,4})$/i);
    const id = m && m[1].toUpperCase() + m[2].padStart(4, "0");
    location.hash = id && byId.has(id) ? "#/p/" + id : "#/search/" + encodeURIComponent(q);
  };
  document.getElementById("lang-toggle").onclick = () => setLang(AR() ? "en" : "ar");
  chrome();
  window.addEventListener("hashchange", route);
  route();
})();
