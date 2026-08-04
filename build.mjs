/* 讓現場活起來 —— 靜態建置
 *
 *   content.json  七幕文案
 *   photos.json   照片清單（檔案不存在時自動退成 placeholder）
 *   content/*.md  文章
 *   site.config.json  網址、SEO、外部連結、Supabase
 *        ↓
 *   docs/  （GitHub Pages 與 Cloudflare Pages 共用同一份輸出）
 *
 * 首頁的文章卡片是建置時就寫進 HTML 的，前端不讀 JSON。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, cpSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { marked } from 'marked';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(ROOT, 'content');
const ASSETS = join(ROOT, 'assets');
const OUT = join(ROOT, 'docs');

const config = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const C = JSON.parse(readFileSync(join(ROOT, 'content.json'), 'utf8'));
const PHOTOS = JSON.parse(readFileSync(join(ROOT, 'photos.json'), 'utf8'));

/* ---------- 小工具 ---------- */

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const attr = (s = '') => esc(s);

/** 段落陣列 → <p> */
const paras = (arr = [], cls = '') =>
  arr.map((t) => `<p${cls ? ` class="${cls}"` : ''}>${esc(t)}</p>`).join('\n');

/** 外部連結才加 target */
const ext = (url) => (/^https?:\/\//.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '');

/** 取得外部連結；沒設定就回空字串 */
const link = (key) => (key && config.links?.[key]) || '';

/* ---------- 圖片 ---------- */

const RATIOS = { '3:2': [3, 2], '4:5': [4, 5], '1:1': [1, 1], '3:4': [3, 4], '16:9': [16, 9] };
const missingPhotos = [];

/** 讀實際像素尺寸，讓 width/height 屬性正確、不產生 layout shift */
function pixelSize(absPath) {
  try {
    const info = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', absPath], { encoding: 'utf8' });
    const w = Number(/pixelWidth:\s*(\d+)/.exec(info)?.[1]);
    const h = Number(/pixelHeight:\s*(\d+)/.exec(info)?.[1]);
    if (w && h) return [w, h];
  } catch { /* sips 不在或讀取失敗 → 退回用 ratio */ }
  return null;
}

/** 這個 id 是否已經有實際圖檔（決定要不要用文字壓圖） */
function photoHasImage(id) {
  const p = PHOTOS[id];
  return Boolean(p && p.src && existsSync(join(ROOT, p.src)));
}

/**
 * 渲染一張照片。檔案存在 → <figure><img>；不存在 → placeholder。
 * placeholder 一樣佔用正確比例的空間，所以照片補上去時版面不會跳動。
 * opts.overlay：把文字壓在圖上（只在真的有圖時才會用，且一定帶暗色漸層
 * 保證對比，否則壓在未知照片上會讀不到）。
 */
function photo(id, opts = {}) {
  const p = PHOTOS[id];
  if (!p) return '';

  const [rw, rh] = RATIOS[p.ratio] || RATIOS['3:2'];
  const cls = ['photo', opts.feature ? 'photo-feature' : '', opts.small ? 'photo-small' : '']
    .filter(Boolean).join(' ');

  const src = p.src && existsSync(join(ROOT, p.src)) ? p.src : '';

  if (!src) {
    missingPhotos.push({ id, need: p.need || '' });
    return `<figure class="${cls}">
  <div class="ph" style="aspect-ratio:${rw}/${rh}" role="img" aria-label="${attr(p.need || '照片待補')}">
    <span class="ph-id">${esc(id)}　${esc(p.ratio || '3:2')}</span>
    <span class="ph-need">${esc(p.need || '照片待補')}</span>
    <span class="ph-tag">照片待補</span>
  </div>
</figure>`;
  }

  const dims = pixelSize(join(ROOT, p.src));
  const [w, h] = dims || [rw * 400, rh * 400];
  const cap = p.caption
    ? `\n  <figcaption>${esc(p.caption)}</figcaption>`
    : '';
  const over = opts.overlay
    ? `\n  <div class="photo-overlay"><p>${esc(opts.overlay)}</p></div>`
    : '';

  return `<figure class="${cls}${over ? ' has-overlay' : ''}">
  <img src="${attr(src)}" alt="${attr(p.alt || '')}" width="${w}" height="${h}" loading="${opts.eager ? 'eager' : 'lazy'}" decoding="async">${over}${cap}
</figure>`;
}

/** CC BY 三要素標示：作品名 / 作者 / 授權條款，各自帶連結 */
function creditHtml(credit) {
  if (!credit) return '';
  if (!credit.title && !credit.author && !credit.license) return '';
  const a = (text, url) =>
    url ? `<a href="${attr(url)}" rel="noopener noreferrer" target="_blank">${esc(text)}</a>` : esc(text);
  const prefix = credit.authorPrefix || 'by';
  const parts = [];
  if (credit.title) parts.push(a(credit.title, credit.titleUrl || credit.sourceUrl));
  if (credit.author) parts.push(`${prefix} ${a(credit.author, credit.authorUrl)}`);
  if (credit.license) parts.push(`授權條款 ${a(credit.license, credit.licenseUrl)}`);
  return `<p class="credit">${esc(credit.prefix || '圖片')}：${parts.join('，')}</p>`;
}

/** 收集全站所有用到的圖片授權，統一放頁尾 */
function allCredits() {
  const out = [];
  for (const [id, p] of Object.entries(PHOTOS)) {
    if (!p || !p.credit) continue;
    if (!p.src || !existsSync(join(ROOT, p.src))) continue;
    out.push(creditHtml(p.credit));
  }
  return out.filter(Boolean).join('\n');
}

/* ---------- 文章 ---------- */

function lastUpdated(filePath) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', filePath], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out) return out.slice(0, 10);
  } catch { /* 尚未 commit → 用檔案 mtime */ }
  return new Date(statSync(filePath).mtime).toISOString().slice(0, 10);
}

function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    meta[kv[1]] = v;
  }
  return { meta, body: m[2] };
}

const toSlug = (file, meta) => meta.slug || basename(file, '.md').replace(/^\d+[-_]/, '');

/** 中文粗體：**字** 在 CJK 之間 marked 不會轉，先補上 */
function cjkBold(src = '') {
  return src.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
}
const inline = (s = '') => marked.parseInline(cjkBold(s));

/* ---------- SEO / OG ---------- */

function absUrl(rel) {
  const base = (config.baseUrl || '').replace(/\/+$/, '');
  if (!rel) return '';
  if (/^https?:\/\//.test(rel)) return rel;
  return base ? `${base}/${rel.replace(/^\/+/, '')}` : '';
}

let ogSkipped = false;
function ensureOgImage(srcRel, name) {
  if (!srcRel) return '';
  const src = join(ROOT, srcRel);
  if (!existsSync(src)) return '';
  const outRel = `assets/og/${name}.jpg`;
  const out = join(ROOT, outRel);
  if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) return outRel;
  const W = 1200, H = 630;
  try {
    mkdirSync(join(ASSETS, 'og'), { recursive: true });
    const dims = pixelSize(src);
    if (!dims) throw new Error('no size');
    const fitByHeight = dims[0] / dims[1] > W / H;
    const resample = fitByHeight ? ['--resampleHeight', String(H)] : ['--resampleWidth', String(W)];
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80',
      ...resample, src, '--out', out], { stdio: 'ignore' });
    execFileSync('sips', ['-c', String(H), String(W), out], { stdio: 'ignore' });
    return outRel;
  } catch {
    ogSkipped = true;
    return '';
  }
}

/* ---------- Supabase ---------- */

const supabaseKey = config.supabase?.publishableKey || config.supabase?.anonKey || '';
const supabaseReady = Boolean(config.supabase?.url && supabaseKey);

function counterScript(base) {
  if (!supabaseReady) return '';
  const cfg = JSON.stringify({
    url: config.supabase.url,
    anonKey: supabaseKey,
    table: config.supabase.table || 'page_views',
    rpc: config.supabase.rpc || 'increment_page_view',
  });
  return `<script>window.SITE_SUPABASE=${cfg};</script>
<script src="${base}assets/counter.js" defer></script>`;
}

/* ---------- 版型 ---------- */

/** 後段才浮出的 CTA 條。主 CTA 沒有連結時就不渲染，避免出現點不了的東西。 */
function floatbarHtml() {
  const url = link('course');
  const label = C.act7.exits.find((e) => e.primary)?.action || '';
  if (!url) return '';
  return `<div class="floatbar" role="complementary" aria-label="快速入口">
  <p>${esc(C.act7.closing)}</p>
  <a class="cta cta-primary" href="${attr(url)}"${ext(url)}>${esc(label)}</a>
  <a class="top" href="#main">回頂端</a>
</div>`;
}

function layout({ title, description, content, depth = 0, pageSlug, ogImage, ogType, pagePath, bodyClass = '', jsonLd = '', floatbar = '' }) {
  const base = depth > 0 ? '../'.repeat(depth) : '';
  const year = new Date().getFullYear();
  const canonical = absUrl(pagePath);
  const og = absUrl(ogImage);

  return `<!doctype html>
<html lang="${attr(config.lang || 'zh-Hant')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description || '')}">
<meta name="author" content="${attr(config.author)}">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description || '')}">
<meta property="og:type" content="${attr(ogType || 'website')}">
<meta property="og:site_name" content="${attr(config.title)}">
<meta property="og:locale" content="zh_TW">${canonical ? `
<meta property="og:url" content="${attr(canonical)}">
<link rel="canonical" href="${attr(canonical)}">` : ''}${og ? `
<meta property="og:image" content="${attr(og)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${attr(description || title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${attr(og)}">` : ''}
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(description || '')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@300;400;500&display=swap">
<link rel="stylesheet" href="${base}assets/style.css">
<link rel="icon" type="image/svg+xml" href="${base}assets/favicon.svg">
<meta name="theme-color" content="#f7f4ef" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#191b1e" media="(prefers-color-scheme: dark)">${jsonLd}
</head>
<body class="${attr(bodyClass)}" data-page-slug="${attr(pageSlug)}">
<a class="skip-link" href="#main">跳到主要內容</a>
<div class="progress" role="presentation"><span id="progress-bar"></span></div>

<main id="main">
${content}
</main>

<footer class="site-footer">
  <div class="wrap">
    <p class="foot-closing">${esc(C.act7.closing)}</p>
    <nav class="foot-nav" aria-label="頁尾導覽">
      <a href="${base}index.html">首頁</a>
      ${link('authorSite') ? `<a href="${attr(link('authorSite'))}"${ext(link('authorSite'))}>關於王家齊</a>` : ''}
    </nav>
    ${allCredits()}
    <p class="foot-meta">© ${year} ${esc(config.author)}　${esc(config.authorTitle)}</p>
    <p class="foot-meta">全站瀏覽：<span class="counter" data-slug="__total__" aria-live="polite">—</span></p>
  </div>
</footer>
${floatbar}
<script src="${base}assets/site.js" defer></script>
${counterScript(base)}
</body>
</html>
`;
}

/* ---------- 各幕 ---------- */

function act1() {
  const items = C.act1.activities.map((a, i) =>
    `      <li data-i="${i}">${esc(a)}</li>`).join('\n');
  return `<section id="${C.act1.id}" class="act act-flood" aria-labelledby="site-title">
  <div class="wrap">
    <div class="flood" data-flood>
      <ul class="flood-list" aria-hidden="true">
${items}
      </ul>
    </div>
    <div class="flood-stop">
      ${C.act1.stopLines.map((l, i) => `<p class="stop-line stop-line-${i + 1}">${esc(l)}</p>`).join('\n      ')}
      <p class="pivot">${esc(C.act1.pivot)}</p>
    </div>
    <div class="masthead">
      <h1 id="site-title">${esc(C.act1.title)}</h1>
      <p class="tagline">${esc(C.act1.tagline)}</p>
    </div>
    ${photo('hero', { eager: true })}
  </div>
</section>`;
}

function act2() {
  const a = C.act2;
  return `<section id="${a.id}" class="act act-script" aria-labelledby="act2-h">
  <div class="wrap">
    <p class="eyebrow" id="act2-h">${esc(a.eyebrow)}</p>
    <div class="scenario">
      <p class="scenario-label">${esc(a.label)}</p>
      ${paras(a.paragraphs)}
    </div>
    <p class="landing">${esc(a.landing)}</p>
    <ul class="bridge">
      ${a.bridge.map((b) => `<li>${esc(b)}</li>`).join('\n      ')}
    </ul>
  </div>
</section>`;
}

function act3() {
  const a = C.act3;
  const seqs = a.sequences.map((s, si) => {
    const shots = s.photos.map((pid, i) => {
      const isFeature = s.feature === i + 1;
      const q = s.questions[i];
      // 滿版出血圖有實際照片時，提問壓在圖上（Patagonia 那種做法）；
      // 還是 placeholder 的時候提問照常放在下面，才讀得到。
      const overlay = isFeature && q && photoHasImage(pid) ? q : '';
      return `      ${photo(pid, { feature: isFeature, overlay })}
${q && !overlay ? `      <p class="q">${esc(q)}</p>` : ''}`;
    }).join('\n');
    return `    <div class="seq" aria-label="第 ${si + 1} 組照片序列">
${shots}
    </div>`;
  }).join('\n');

  return `<section id="${a.id}" class="act act-room" aria-labelledby="act3-h">
  <div class="wrap">
    <p class="eyebrow" id="act3-h">${esc(a.eyebrow)}</p>
    <p class="lede">${esc(a.intro)}</p>
  </div>
  <div class="wrap seqs">
${seqs}
  </div>
</section>`;
}

function act4() {
  const a = C.act4;
  const bands = a.verbs.map((v, i) => `  <div class="band band-${i % 2 === 0 ? 'l' : 'r'}">
    <div class="wrap">
      <h3 class="verb">${esc(v.word)}</h3>
      <p class="verb-lead">${esc(v.lead)}</p>
      ${paras(v.body, 'verb-body')}
    </div>
  </div>`).join('\n');

  const quotes = a.quotes.map((q) =>
    `      <blockquote class="quote"><p>${esc(q.text)}</p><cite>${esc(q.source)}</cite></blockquote>`
  ).join('\n');

  const pending = a.quotePending
    ? `      <p class="pending">Keith Johnstone 引文位置——取得原文、版本與頁碼後補上。</p>`
    : '';

  return `<section id="${a.id}" class="act act-verbs" aria-labelledby="act4-h">
  <div class="wrap">
    <p class="eyebrow" id="act4-h">${esc(a.eyebrow)}</p>
    <p class="lede">${esc(a.intro)}</p>
  </div>
${bands}
  <div class="wrap">
${quotes}
${pending}
  </div>
</section>`;
}

function act5() {
  const a = C.act5;
  const fields = a.fields.map((f) => {
    const url = link(f.linkKey);
    const cta = url
      ? `<a class="cta${f.primary ? ' cta-primary' : ''}" href="${attr(url)}"${ext(url)}>${esc(f.linkLabel)}</a>`
      : `<span class="cta cta-pending">${esc(f.linkLabel)}<small>連結待補</small></span>`;

    const aiNote = f.aiNote ? `
      <div class="ai-note">
        <h4>${esc(f.aiNote.title)}</h4>
        <p><b>AI 可以做的：</b>${esc(f.aiNote.can)}</p>
        <p><b>真人心理工作承擔的：</b>${esc(f.aiNote.human)}</p>
      </div>` : '';

    return `    <article class="field${f.primary ? ' field-primary' : ''}" aria-labelledby="field-${f.num}">
      <header class="field-head">
        <span class="field-num">${esc(f.num)}</span>
        <h3 id="field-${f.num}">${esc(f.name)}</h3>
      </header>
      <div class="field-problem">
        ${f.problem.map((p) => `<p>${esc(p)}</p>`).join('\n        ')}
      </div>
      ${photo(f.photo)}
      <p class="field-scene">${esc(f.scene)}</p>
      <p class="field-how">${esc(f.how)}</p>${aiNote}
      <div class="field-exit">
        ${cta}
        ${f.linkNote ? `<p class="note">${esc(f.linkNote)}</p>` : ''}
      </div>
    </article>`;
  }).join('\n');

  return `<section id="${a.id}" class="act act-fields" aria-labelledby="act5-h">
  <div class="wrap">
    <p class="eyebrow" id="act5-h">${esc(a.eyebrow)}</p>
    <p class="lede">${esc(a.intro)}</p>
  </div>
  <div class="wrap fields">
${fields}
  </div>
</section>`;
}

function act6() {
  const a = C.act6;
  const url = link(a.ctaKey);
  const cta = url
    ? `<a class="cta" href="${attr(url)}"${ext(url)}>${esc(a.cta)}</a>`
    : `<span class="cta cta-pending">${esc(a.cta)}<small>連結待補</small></span>`;
  return `<section id="${a.id}" class="act act-book" aria-labelledby="act6-h">
  <div class="wrap book-wrap">
    <div class="book-cover">${photo(a.cover, { small: true })}</div>
    <div class="book-text">
      <p class="eyebrow" id="act6-h">${esc(a.eyebrow)}</p>
      <h3>《${esc(a.title)}》</h3>
      <p class="book-meta">${esc(a.publisher)}　${esc(a.year)}</p>
      ${paras(a.paragraphs)}
      <p class="note">${esc(a.note)}</p>
      ${cta}
    </div>
  </div>
</section>`;
}

function act7() {
  const a = C.act7;
  const exits = a.exits.map((e) => {
    const url = e.anchor || link(e.linkKey);
    const inner = `<span class="exit-who">${esc(e.who)}</span><span class="exit-action">${esc(e.action)}</span>`;
    return url
      ? `      <li class="exit${e.primary ? ' exit-primary' : ''}"><a href="${attr(url)}"${ext(url)}>${inner}</a></li>`
      : `      <li class="exit${e.primary ? ' exit-primary' : ''}"><span class="exit-pending">${inner}<small>連結待補</small></span></li>`;
  }).join('\n');

  return `<section id="${a.id}" class="act act-next" aria-labelledby="act7-h">
  <div class="wrap">
    <p class="eyebrow" id="act7-h">${esc(a.eyebrow)}</p>
    <p class="lede">${esc(a.intro)}</p>
    <ul class="exits">
${exits}
    </ul>
  </div>
</section>`;
}

/* ---------- 文章卡片（建置時寫死進 HTML） ---------- */

function postsSection(posts) {
  const p = C.posts;
  const body = posts.length
    ? `    <ul class="cards">
${posts.map((post) => `      <li class="card${post.cover ? '' : ' card-textonly'}">
        <a href="posts/${attr(post.slug)}/">
          ${post.cover ? `<img src="${attr(post.cover)}" alt="${attr(post.coverAlt || '')}" width="${post.coverW}" height="${post.coverH}" loading="lazy" decoding="async">` : ''}
          <div class="card-body">
            <h3>${esc(post.title)}</h3>
            ${post.summary ? `<p class="card-sum">${esc(post.summary)}</p>` : ''}
            <p class="card-meta">
              <time datetime="${attr(post.date)}">${esc(post.date)}</time>
              ${post.updated !== post.date ? `<span class="upd">更新 <time datetime="${attr(post.updated)}">${esc(post.updated)}</time></span>` : ''}
              <span class="views"><span class="counter" data-slug="${attr(post.slug)}" aria-live="polite">—</span> 次瀏覽</span>
            </p>
          </div>
        </a>
      </li>`).join('\n')}
    </ul>`
    : `    <p class="empty">${esc(p.empty)}</p>`;

  return `<section id="posts" class="act act-posts" aria-labelledby="posts-h">
  <div class="wrap">
    <p class="eyebrow" id="posts-h">${esc(p.eyebrow)}</p>
    <p class="lede">${esc(p.intro)}</p>
${body}
  </div>
</section>`;
}

/* ---------- 讀文章 ---------- */

const files = existsSync(CONTENT)
  ? readdirSync(CONTENT).filter((f) => f.endsWith('.md')).sort()
  : [];

const posts = files.map((f) => {
  const abs = join(CONTENT, f);
  const raw = readFileSync(abs, 'utf8');
  const { meta, body } = parseFrontMatter(raw);
  const slug = toSlug(f, meta);
  const cover = meta.cover && existsSync(join(ROOT, meta.cover)) ? meta.cover : '';
  const dims = cover ? pixelSize(join(ROOT, meta.cover)) : null;
  return {
    slug,
    title: meta.title || slug,
    summary: meta.summary || '',
    author: meta.author || config.author,
    date: (meta.date || '').slice(0, 10) || lastUpdated(abs),
    updated: lastUpdated(abs),
    cover,
    coverAlt: meta.coverAlt || '',
    coverW: dims ? dims[0] : 1200,
    coverH: dims ? dims[1] : 800,
    credit: meta.heroCreditTitle || meta.heroCreditAuthor || meta.heroCreditLicense ? {
      prefix: '首圖',
      title: meta.heroCreditTitle,
      titleUrl: meta.heroCreditSourceUrl,
      author: meta.heroCreditAuthor,
      authorUrl: meta.heroCreditAuthorUrl,
      license: meta.heroCreditLicense,
      licenseUrl: meta.heroCreditLicenseUrl,
    } : null,
    html: marked.parse(cjkBold(body)),
  };
}).sort((a, b) => (b.date || '').localeCompare(a.date || ''));   // 最新在前

/* ---------- 輸出 ---------- */

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, '.nojekyll'), '');

if (config.offline) {
  writeFileSync(join(OUT, 'index.html'), `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.title)}</title><meta name="robots" content="noindex">
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#333}</style>
</head><body><p>${esc(config.offlineNotice)}</p></body></html>`);
  console.log('offline 模式：只輸出告示頁');
  process.exit(0);
}

cpSync(ASSETS, join(OUT, 'assets'), { recursive: true });
rmSync(join(OUT, 'assets', 'photos-inbox'), { recursive: true, force: true });

const homeOg = ensureOgImage(PHOTOS.hero?.src, 'home');

const jsonLd = `
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: config.title,
  description: config.description,
  inLanguage: 'zh-TW',
  url: config.baseUrl || undefined,
  author: { '@type': 'Person', name: config.author, jobTitle: config.authorTitle },
})}</script>`;

const home = [act1(), act2(), act3(), act4(), act5(), act6(), act7(), postsSection(posts)].join('\n\n');

writeFileSync(join(OUT, 'index.html'), layout({
  title: `${config.title}｜${config.tagline}`,
  description: config.description,
  content: home,
  depth: 0,
  pageSlug: '__home__',
  ogImage: homeOg,
  pagePath: '',
  bodyClass: 'home',
  jsonLd,
  floatbar: floatbarHtml(),
}));

for (const p of posts) {
  const dir = join(OUT, 'posts', p.slug);
  mkdirSync(dir, { recursive: true });
  const og = ensureOgImage(p.cover, `post-${p.slug}`);

  const hero = p.cover
    ? `  <figure class="post-hero">
    <img src="../../${attr(p.cover)}" alt="${attr(p.coverAlt)}" width="${p.coverW}" height="${p.coverH}" loading="eager" decoding="async">
  </figure>`
    : '';

  const content = `<article class="post">
  <div class="wrap">
    <p class="eyebrow"><a href="../../index.html">${esc(config.title)}</a></p>
    <h1>${esc(p.title)}</h1>
    <p class="post-meta">
      <span class="by">${esc(p.author)}</span>
      <time datetime="${attr(p.date)}">${esc(p.date)}</time>
      ${p.updated !== p.date ? `<span class="upd">更新 <time datetime="${attr(p.updated)}">${esc(p.updated)}</time></span>` : ''}
      <span class="views"><span class="counter" data-slug="${attr(p.slug)}" aria-live="polite">—</span> 次瀏覽</span>
    </p>
  </div>
${hero}
  <div class="wrap post-body">
${p.html}
  </div>
  <div class="wrap">
    ${creditHtml(p.credit)}
    <p class="back"><a href="../../index.html">← 回到首頁</a></p>
  </div>
</article>`;

  writeFileSync(join(dir, 'index.html'), layout({
    title: `${p.title}｜${config.title}`,
    description: p.summary || config.description,
    content,
    depth: 2,
    pageSlug: p.slug,
    ogImage: og,
    ogType: 'article',
    pagePath: `posts/${p.slug}/`,
    bodyClass: 'post-page',
  }));
}

/* ---------- 建置報告 ---------- */

console.log(`✓ docs/index.html`);
console.log(`✓ 文章 ${posts.length} 篇${posts.length ? '：' + posts.map((p) => p.slug).join(', ') : '（content/ 目前是空的）'}`);
if (!supabaseReady) console.log('· Supabase 未設定，計數器顯示為 —');
if (ogSkipped) console.log('· sips 不可用，OG 圖略過');
if (missingPhotos.length) {
  console.log(`\n照片待補 ${missingPhotos.length} 張：`);
  for (const m of missingPhotos) console.log(`  ${m.id.padEnd(20)} ${m.need}`);
  console.log('\n規格與交件方式見 PHOTO_SPEC.md');
}
