# 讓現場活起來

「AI 時代的即興力」—— 王家齊關於即興、心理治療演練、體驗式學習與《教學即興力》的實踐提案。

單頁敘事（七幕）＋ 文章系統。純靜態，沒有後端。

```
content.json   七幕文案          ┐
photos.json    照片清單與授權     ├→ build.mjs →  docs/  → GitHub Pages / Cloudflare Pages
site.config.json 網址・SEO・連結  │
content/*.md   文章              ┘
```

## 日常流程

```bash
npm run build
```

改完 → `npm run build` → commit + push。Cloudflare Pages 會自動部署。

本機預覽：

```bash
npm run dev
```

## 七幕結構

| # | 區塊 | id | 內容來源 |
|---|---|---|---|
| 1 | 一百個答案 | `#flood` | `content.json` → `act1` |
| 2 | 劇本失效那一刻 | `#script` | `act2`（概念情境，**不可改寫成真實個案**） |
| 3 | 真正的現場 | `#room` | `act3` ＋ `photos.json` |
| 4 | 察覺・連結・回應 | `#verbs` | `act4` |
| 5 | 三個實驗現場 | `#fields` | `act5` |
| 6 | 《教學即興力》 | `#book` | `act6` |
| 7 | 三個入口 | `#next` | `act7` |
| — | 文章卡片 | `#posts` | `content/*.md` |

## 照片

**規格與交件方式：[PHOTO_SPEC.md](PHOTO_SPEC.md)**

`photos.json` 的 `src` 留空，或檔案不存在 → 自動渲染 placeholder，
顯示「需要什麼畫面 / 建議比例 / 待補」，並**佔用正確比例的空間**，
所以之後補上照片不會造成版面跳動。

建置時會把所有待補照片列在終端機。

授權標示自動渲染在頁尾（`photos.json` 每張的 `credit` 欄位）。
CC BY 圖：`title` / `author` / `license` 三要素各自帶連結。
出版社或自有圖：填 `title` / `author`，`authorPrefix` 設成「圖片提供」，`license` 留空。
**不要幫沒有 CC 授權的圖硬掛一個授權條款。**

## 新增文章

在 `content/` 建立 `.md`：

```markdown
---
title: 文章標題
date: 2026-08-10
summary: 顯示在首頁卡片上的簡介。
author: 王家齊
cover: assets/cover-xxx.jpg
coverAlt: 圖片替代文字
heroCreditTitle: 作品名稱
heroCreditSourceUrl: https://原始頁面
heroCreditAuthor: 攝影者
heroCreditLicense: CC BY 4.0
heroCreditLicenseUrl: https://creativecommons.org/licenses/by/4.0/
---

正文。
```

`npm run build` 之後：

- 首頁卡片自動新增，**依發布日排序（最新在前）**
- **更新日期取自該檔最後一次 git commit 時間**，不必手動維護（未 commit 時退回檔案 mtime）
- 卡片是建置時就寫進 HTML 的，**前端不讀 JSON**
- 網址是 `/posts/<slug>/`，slug 取自檔名去掉開頭編號，或用 front matter 的 `slug:` 指定
- 文章首圖等比例縮放，寬度上限＝內文欄寬（`--content`，預設 42rem）

## 瀏覽計數器

每篇文章各自獨立計數，首頁卡片顯示該篇次數，頁尾顯示全站總和。

1. Supabase SQL Editor 執行 `supabase/schema.sql`
2. `site.config.json` 的 `supabase` 區塊已填好
3. `npm run build`

⚠️ **表與函式名稱刻意跟 love.chiachipsy.com 分開**（`page_views_improv` /
`increment_page_view_improv`）。`counter.js` 是把整張表相加當「全站總和」，
兩站共用一張表會讓總瀏覽數混在一起。

安全性：publishable key 本來就會公開在前端。表開了 RLS，anon **只有讀取權限**；
寫入一律走 `SECURITY DEFINER` 函式。**絕對不要**把 service_role key 放進這個專案。

計數規則：同一瀏覽階段對同一頁只計一次（`sessionStorage` 擋重新整理灌水）。
沒設定 Supabase 時顯示 `—`，版位保留。

## 動態

只有三處，全部很小（`assets/site.js`，約 2KB）：

1. **第一幕堆疊** —— 進入視窗才開始，不劫持捲動。開場先填滿容器再跑，
   跑完才顯示落點文案與主標（`.staged` / `.revealed` 由 JS 加，**沒有 JS 就全部可見**）。
   手機減到 24 條。
2. **閱讀進度線** —— 頂部 2px。
3. **浮出的 CTA 條** —— 捲過第五幕才出現。`links.course` 沒填時完全不渲染。

`prefers-reduced-motion: reduce` 時：堆疊直接跳終態、容器不裁切、CTA 條不做位移。

## 無障礙與效能

- 語意化 `<section>` / `<article>` / `<figure>`，每區有 `aria-labelledby`
- 跳到主要內容連結、`:focus-visible` 外框
- 全站文字對比通過 WCAG AA（亮色最低 4.83、暗色最低 5.35）
- 圖片有 `width` / `height`（從實際像素讀取）＋ `loading="lazy"`
- Noto Sans TC 用 `font-display: swap`，搭配 metric-matched 的 `@font-face` fallback
  （`ascent-override: 116%` / `descent-override: 32%`）讓換字時行高不變 → CLS 0
- 亮色／暗色雙模式

## 下線開關

`site.config.json` 的 `offline` 設成 `true` → 只輸出一頁告示，
文章與圖片完全不進 `docs/`。改回 `false` 重新 build 即可上架。

## 部署

`docs/` 是建置產物，**會 commit 進版控**（GitHub Pages 需要）。

- **GitHub Pages** — Settings → Pages → `main` 分支 `/docs` 資料夾
- **Cloudflare Pages** — 連動同一個 repo，build command 留空，output directory 設 `docs`

## 待補資料

見 **[CONTENT_TODO.md](CONTENT_TODO.md)**。清單上的東西在提供之前一律不會被生成。
