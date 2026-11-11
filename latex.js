// Turns a problem statement (LaTeX: text with $math$, lists, \emph, ...) into HTML.
// Math is rendered with KaTeX. Shared by the site (window.TeX) and scripts/check_render.js.
(function (root) {
  "use strict";

  const MACROS = {
    "\\Z": "\\mathbb{Z}", "\\N": "\\mathbb{N}", "\\Q": "\\mathbb{Q}",
    "\\R": "\\mathbb{R}", "\\C": "\\mathbb{C}",
    "\\floor": "\\left\\lfloor #1 \\right\\rfloor",
    "\\ceil": "\\left\\lceil #1 \\right\\rceil",
    "\\abs": "\\left| #1 \\right|",
    "\\lcm": "\\operatorname{lcm}", "\\ord": "\\operatorname{ord}",
    "\\vp": "v_{#1}",
    "\\legendre": "\\left(\\tfrac{#1}{#2}\\right)",
  };
  const MATH_ENVS = ["align", "align*", "equation", "equation*", "gather", "gather*",
                     "multline", "multline*", "eqnarray", "eqnarray*", "displaymath"];
  const FORMAT = { emph: "em", textit: "em", textsl: "em", textbf: "strong", underline: "u",
                   texttt: "code", textsc: "span", textrm: "span", textup: "span", mbox: "span",
                   text: "span", textnormal: "span" };
  const SYMBOLS = { ldots: "…", dots: "…", textellipsis: "…", "%": "%", "&": "&amp;", "$": "$",
                    "#": "#", "_": "_", "{": "{", "}": "}", ",": " ", ";": " ", ":": " ", "!": "",
                    quad: " ", qquad: "  ", " ": " ", S: "§", copyright: "©", textendash: "–",
                    textemdash: "—", textquoteright: "’", textquoteleft: "‘", "-": "" };
  const ACCENTS = { "'": "́", "`": "̀", '"': "̈", "^": "̂", "~": "̃",
                    "=": "̄", ".": "̇", u: "̆", v: "̌", H: "̋", c: "̧" };
  const DROP = new Set(["noindent", "medskip", "smallskip", "bigskip", "hfill", "vfill", "centering",
                        "footnotesize", "small", "normalsize", "large", "Large", "indent", "nopagebreak",
                        "newpage", "clearpage", "hardstar", "verifyflag", "displaystyle"]);

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function matchBrace(s, i) {            // s[i] === "{" -> index of matching "}"
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (c === "\\") { j++; continue; }
      if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return j;
    }
    return -1;
  }

  function findClose(s, from, close) {    // next unescaped occurrence of `close`
    for (let j = from; j < s.length; j++) {
      if (s[j] === "\\" && close !== "$" && s.startsWith(close, j)) return j;
      if (s[j] === "\\") { j++; continue; }
      if (s.startsWith(close, j)) return j;
    }
    return -1;
  }

  function typography(t) {
    return esc(t)
      .replace(/---/g, "—").replace(/--/g, "–")
      .replace(/``/g, "“").replace(/''/g, "”").replace(/`/g, "‘")
      .replace(/~/g, "&nbsp;")
      .replace(/\n[ \t]*\n\s*/g, '<span class="pbreak"></span>');
  }

  function render(src, katex, errors) {
    const out = [];
    const lists = [];                     // stack of open list types
    let i = 0, text = "";
    const flush = () => { if (text) { out.push(typography(text)); text = ""; } };
    const math = (tex, display) => {
      flush();
      try {
        out.push(katex.renderToString(tex, { displayMode: display, macros: Object.assign({}, MACROS),
                                             throwOnError: true, strict: false }));
      } catch (e) {
        if (errors) errors.push({ tex, message: String(e.message || e) });
        out.push(`<code class="tex-error" title="${esc(String(e.message || e))}">${esc(tex)}</code>`);
      }
    };

    while (i < src.length) {
      const c = src[i];
      if (c === "$") {
        const display = src[i + 1] === "$";
        const open = display ? 2 : 1;
        const j = findClose(src, i + open, display ? "$$" : "$");
        if (j < 0) { text += c; i++; continue; }
        math(src.slice(i + open, j), display);
        i = j + open;
        continue;
      }
      if (c !== "\\") { text += c; i++; continue; }

      // ---- backslash commands ----
      const two = src.slice(i, i + 2);
      if (two === "\\[" || two === "\\(") {
        const close = two === "\\[" ? "\\]" : "\\)";
        const j = src.indexOf(close, i + 2);
        if (j >= 0) { math(src.slice(i + 2, j), two === "\\["); i = j + 2; continue; }
      }
      if (two === "\\\\") { flush(); out.push("<br>"); i += 2; continue; }
      const m = /^\\([a-zA-Z]+\*?|.)/.exec(src.slice(i));
      const name = m[1];
      let k = i + m[0].length;

      if (name === "begin" || name === "end") {
        const em = /^\{([a-zA-Z*]+)\}/.exec(src.slice(k));
        if (!em) { text += "\\" + name; i = k; continue; }
        const env = em[1];
        k += em[0].length;
        if (name === "begin" && MATH_ENVS.includes(env)) {
          const endTag = `\\end{${env}}`;
          const j = src.indexOf(endTag, k);
          const inner = src.slice(k, j < 0 ? src.length : j);
          const env2 = env.replace("eqnarray", "align").replace("displaymath", "");
          math(env2 ? `\\begin{${env2.endsWith("*") ? env2 : env2 + "*"}}${inner}\\end{${env2.endsWith("*") ? env2 : env2 + "*"}}` : inner, true);
          i = j < 0 ? src.length : j + endTag.length;
          continue;
        }
        if (name === "begin" && env === "tikzpicture") {
          const endTag = "\\end{tikzpicture}";
          const j = src.indexOf(endTag, k);
          flush();
          out.push('<div class="figure-missing">Figure (available in the training book)</div>');
          i = j < 0 ? src.length : j + endTag.length;
          continue;
        }
        flush();
        if (env === "enumerate" || env === "itemize") {
          if (name === "begin") {
            let style = env === "itemize" ? "disc" : "decimal";
            const opt = /^\s*\[([^\]]*)\]/.exec(src.slice(k));
            if (opt) {
              k += opt[0].length;
              if (/\\alph/.test(opt[1])) style = "lower-alpha";
              else if (/\\Alph/.test(opt[1])) style = "upper-alpha";
              else if (/\\roman/.test(opt[1])) style = "lower-roman";
              else if (/\\Roman/.test(opt[1])) style = "upper-roman";
            }
            lists.push({ open: false });
            out.push(opt && /\(/.test(opt[1])   // "(a)"-style labels, drawn by CSS counters
              ? `<ol class="tex-list paren" data-style="${style}">`
              : `<ol class="tex-list" style="list-style-type:${style}">`);
          } else {
            const l = lists.pop();
            if (l && l.open) out.push("</li>");
            out.push("</ol>");
          }
        } else if (env === "center") {
          out.push(name === "begin" ? '<div class="center">' : "</div>");
        } else if (env === "quote" || env === "quotation") {
          out.push(name === "begin" ? "<blockquote>" : "</blockquote>");
        }
        // other environments (e.g. minipage): ignore the markers, keep the content
        i = k;
        continue;
      }

      if (name === "item") {
        flush();
        const l = lists[lists.length - 1];
        if (l && l.open) out.push("</li>");
        let label = "";
        const opt = /^\s*\[([^\]]*)\]/.exec(src.slice(k));
        if (opt) { k += opt[0].length; label = opt[1]; }
        out.push(label ? `<li class="custom"><span class="item-label">${render(label, katex, errors)}</span> `
                       : "<li>");
        if (l) l.open = true;
        i = k;
        continue;
      }

      if (name === "includegraphics") {      // figures pre-rendered to SVG by scripts/render_figures.py
        const gm = /^\s*(\[[^\]]*\])?\s*\{([^}]*)\}/.exec(src.slice(k));
        if (gm) {
          flush();
          out.push(`<div class="figure"><img src="${esc(gm[2])}" alt="Figure" loading="lazy"></div>`);
          i = k + gm[0].length;
          continue;
        }
      }
      if (FORMAT[name] || name === "footnote") {
        const sp = /^\s*/.exec(src.slice(k))[0].length;
        if (src[k + sp] === "{") {
          const j = matchBrace(src, k + sp);
          const inner = render(src.slice(k + sp + 1, j), katex, errors);
          flush();
          if (name === "footnote") out.push(`<span class="footnote">(${inner})</span>`);
          else out.push(`<${FORMAT[name]}${name === "textsc" ? ' class="sc"' : ""}>${inner}</${FORMAT[name]}>`);
          i = j + 1;
          continue;
        }
      }
      if (name in ACCENTS) {                 // text accents: \'e, \'{e}, \H{o}, \v c ...
        const rest = src.slice(k);
        const am = /^\{\\?([a-zA-Z])\}|^\s*\\?([a-zA-Z])/.exec(/^[a-zA-Z]/.test(name) ? rest : rest.replace(/^\s+/, ""));
        if (am) {
          text += ((am[1] || am[2]) + ACCENTS[name]).normalize("NFC");
          i = k + (/^[a-zA-Z]/.test(name) ? 0 : rest.length - rest.replace(/^\s+/, "").length) + am[0].length;
          continue;
        }
      }
      if (name === "par") { flush(); out.push('<span class="pbreak"></span>'); i = k; continue; }
      if (name in SYMBOLS) { text += SYMBOLS[name]; i = k; continue; }
      if (DROP.has(name)) { i = k; continue; }
      if (name === "label" || name === "index") {
        if (src[k] === "{") { i = matchBrace(src, k) + 1; continue; }
      }
      // a math command used outside $...$ (rare): render it as math
      math(m[0], false);
      i = k;
    }
    flush();
    while (lists.length) { const l = lists.pop(); out.push((l.open ? "</li>" : "") + "</ol>"); }
    return out.join("");
  }

  const api = { render, MACROS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TeX = api;
})(typeof window !== "undefined" ? window : globalThis);
