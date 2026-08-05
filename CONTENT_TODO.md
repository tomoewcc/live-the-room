# 待補資料

**原則：這個清單上的東西，在你提供之前一律不會被生成。**
沒有的欄位顯示為「待補」或 placeholder，不會編造推薦語、銷量、個案、日期或引文。

打勾 = 已核實可用；空白 = 還沒有。

---

## 1. 作者與品牌

- [x] 正式姓名：王家齊
- [x] 專業稱謂：臨床心理師
- [x] 個人網站：`chiachipsy.com/2015/12/cv.html`
- [ ] **作者照**（工作中優先於形象照）
- [ ] **品牌色**（目前用暫定色票：冷灰藍＝生成，暖赭＝現場）
- [ ] **既有字體**（目前用 Noto Sans TC）
- [ ] 社群與電子報連結（`site.config.json` → `links.newsletter`）
- [ ] 網站正式網址（目前 `baseUrl` 是 pages.dev，切到 improv 後要改）

## 2. 真實照片

**全部 14 張都還沒有。規格與交件方式見 [PHOTO_SPEC.md](PHOTO_SPEC.md)。**
丟到 `assets/photos-inbox/`。

- [ ] HERO ×1
- [ ] 第三幕連續序列 ×3 組（每組 3 張，共 9 張）—— **最重要**
- [ ] 第五幕三個現場 ×3
- [ ] 作者照 ×1
- [ ] 書封 ×1
- [ ] 每張照片的**時間、情境與關係事件說明**（圖說來源）
- [ ] 每張照片的**替代文字**
- [ ] **肖像權、攝影權、主辦單位授權**（三者缺一就先不要用）

## 3. 《教學即興力》

- [x] 出版社：商周出版
- [x] 出版年：2023
- [x] 購書連結：博客來 `0010972240`
- [x] 定位：全台第一本將應用即興劇運用於教育訓練的工具書
- [ ] **書封圖檔**
- [ ] 作者最希望強調的 3–5 個概念
- [ ] 可合法使用的書摘
- [ ] 經授權的推薦語（**沒有就不放，不編造**）
- [ ] 其他通路連結

## 4. 團督演練專班 ← 主要 CTA，優先度最高

- [x] 正式名稱：《線上整合式實務團督：演練專班》
- [ ] **正式介紹頁或報名連結**（`site.config.json` → `links.course`）
      ⚠️ 目前全站唯一能點的連結只有博客來。這一項補上之前，主 CTA 是「待補」狀態，
      頁尾浮出的 CTA 條也不會出現。
- [ ] 課程對象與進行方式的正式說法
- [ ] 一次可公開的完整演練歷程
- [ ] 日期、地點、費用、報名狀態（**不會自行創造**）
- [ ] 可公開的匿名回饋

## 5. 手工智慧／加速式學習

- [x] 認證正式名稱：Accelerated Learning (AL) 加速式學習課程引導師／設計師（2025）
- [x] 另一張：Levers of Transfer Effectiveness Certified Transfer Designer（2025）
- [ ] 實際使用過的活動案例（參與者實際做了什麼）
- [ ] 「手工智慧」是否需要英文名稱
- [ ] 相關文章或演講連結

## 6. 心理諮商 FAQ

- [ ] **舊文〈AI 可以取代心理諮商嗎？〉全文與網址**（本機專案裡找不到）
- [ ] 希望保留或修正的觀點
- [ ] FAQ 題目清單
- [ ] 心理健康風險、隱私與危機處理聲明
      （第五幕現場二已有「AI 可以做的／真人承擔的」誠實區分，但還缺正式聲明）

## 7. 引文

- [x] **Keith Johnstone 引文**：原文與出處已核實並上線（2026-08-04）
      `Imagination is as effortless as perception, unless we think it might be ‘wrong’,
      which is what our education encourages us to believe.`
      出處：*Impro: Improvisation and the Theatre*（Faber and Faber, 1979）
      ⚠️ **網路引文站流傳的「Routledge, 1981」是錯的**——那是把著作權年份（© 1979, 1981）
      誤當成版本年份，再安上錯誤的出版社。作者手上那本的版權頁寫的是
      Faber and Faber 原版、Bloomsbury（Methuen Drama，ISBN 978-0-7136-8701-9）發行。
- [ ] **頁碼**：作者讀的是 ePub，頁碼會隨字級流動，不能用。要拿紙本或固定頁碼的 PDF 對過再補
- [x] 王家齊自己的兩句（已使用，其中一句明確標示為「轉譯，非翻譯」）

## 8. 網站目標

- [x] 最重要的 CTA：團督演練專班
- [x] 優先順序：演練專班 > 書 > 資源
- [ ] 是否收集電子郵件（Kit？）
- [ ] 是否需要中英雙語
- [x] 部署平台：GitHub Pages + Cloudflare Pages
- [ ] 預計上線時間
- [ ] 成功指標

---

## 補資料之後要做什麼

| 你補的東西 | 改哪裡 | 然後 |
|---|---|---|
| 照片 | 丟 `assets/photos-inbox/`，我搬到 `assets/` 並填 `photos.json` | `npm run build` |
| 課程連結 | `site.config.json` → `links.course` | `npm run build` |
| 書封 | `assets/`，填 `photos.json` 的 `book-cover.src` | `npm run build` |
| 文案微調 | `content.json` | `npm run build` |
| 新文章 | `content/` 新增 `.md` | `npm run build`，卡片自動出現並排序 |
