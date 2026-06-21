# LiveChatScope — UI/UX 改修メモ

> **最終整理**: 2026-06-21  
> **出典**: ローカル実画面確認（ユーザー feedback）+ コードベース照合（`dev` ブランチ）  
> **位置づけ**: 第一弾完成後の polish / 差別化 backlog  
> **関連**: [phase-1-checklist.md](phase-1-checklist.md) §C

---

## 0. このドキュメントの運用

| ルール | 内容 |
|--------|------|
| **実装** | 本メモの項目は **明示指示があるまで実装しない**（UX-21 ファイル名のみ例外で完了） |
| **更新** | feedback 受領 → 本メモ追記 → 必要なら「未決事項」に質問を追加 |
| **精度** | 「現状」列は可能な限り **ファイル・設定値・DB** を根拠に記載 |

### 状態ラベル

| ラベル | 意味 |
|--------|------|
| 📋 未着手 | メモのみ |
| 🔍 要調査 | 切り分け・方針決定が先 |
| ❓ 要確認 | ユーザー判断待ち（§1 参照） |
| ✅ 完了 | 実装・マージ済み |

---

## 1. 未決事項（ユーザー確認が必要）

実装優先度や設計を決めるため、以下への回答があると着手しやすい。

| # | 関連 UX | 質問 |
|---|---------|------|
| Q1 | UX-24, UX-06, UX-19 | **グローバルフィルター**（NG ワード / スタンプのみ除外）を変えたとき、**A** 表示のみ都度集計 **B** 解析 Pipeline 再実行 **C** ハイブリッド（密度は全件・話題のみ除外）のどれを第一優先にしますか？ |
| Q2 | UX-23 | JSON/CSV 統一時、CSV の集約データ（密度・Top 投稿者等）は **単一 CSV** / **ZIP 複数 CSV** / **JSON のみ集約・CSV は messages 専用** のどれがよいですか？ |
| Q3 | UX-25 | 差別化アイデア（§5）から **Must 3 件** を選びたい。編集者向け（チャプター export 等）・配信者向け（お礼・サマリー）・分析深度のどれを最優先軸にしますか？ |
| Q4 | UX-26 | ロゴの方向性（例: ミニマル / 配信・チャット感 / テック）や、既存ブランドカラー（青 `#3b82f6` 系を継続？）の希望はありますか？ |
| Q5 | UX-27 | 元動画リンクは **進捗画面の動画 ID のみ** か、**結果画面の動画タイトル行も** YouTube リンクにしますか？ |
| Q6 | UX-05 | スパチャ 0 件の配信について、「取得漏れ」と「本当に SC なし」の UI 表示を分けたいですか？ |

---

## 2. 実装との差分（コード照合 2026-06-21）

設計ドキュメントと現行コードが一致していない点。改修時の前提として参照。

| 項目 | 設計・期待 | 現行実装 | 影響 UX |
|------|-----------|----------|---------|
| `analysis_status=partial` | Phase A のみ完了（[architecture.md](architecture.md)） | Pipeline は常に `complete` で終了（`partial` をセットするコードなし） | `PartialAnalysisBadge` は実質未使用 |
| 進捗 → 結果遷移 | 分析完了待ち（[e2e-runbook.md](e2e-runbook.md)） | `fetch_status=fetched` で即 `/videos/` へ（`analyze/…/page.tsx` L33–35） | 分析 `running` 中に結果画面へ行き API 409 の可能性 |
| 動画メタ | タイトル・チャンネル・尺 | `fetch_worker.py` は **messages のみ** 保存。`title` / `channel_name` / `duration_seconds` は **UPDATE なし**（常に null になりうる） | ヘッダタイトルが `動画 {id}` フォールバック、UX-09 ブロック |
| `/summary` 件数上限 | `analysis_defaults.json` stage7: keywords **10**, topics preview **6**, highlights **5** | `analysis.py` が highlights / keywords / topic preview すべて **`LIMIT 5` 固定** | UX-07, UX-08 |
| JSON export `authors` | — | `author_stats` 全行出力だが、Stage 1 は **Top 20 のみ** 保存（`author_top_n=20`） | 「全投稿者」と誤解しやすい |
| markdown-summary | — | **API**（`export.py`）と **Stage 8 キャッシュ**（`stage8.py`）で内容不一致。DL は API 版 | キーワード・話題はキャッシュのみ |
| 収益タブ CSV | SC 専用想定（UI 文脈） | 同一 API `export/csv` → **全 messages** CSV | UX-23 と関連 |
| `tokens` テーブル | Stage 4 中間データ | `delete_tokens_after_stage4: true` で **Stage 4 後削除** | 再トークナイズは messages からのみ |
| `GET /videos/{id}` | — | `VideoMetaResponse` に **`source_url` なし**（DB カラムは存在） | UX-27 は API 拡張が必要 |

---

## 3. 一覧インデックス

| ID | タイトル | 状態 | カテゴリ | 優先 tier |
|----|----------|------|----------|-----------|
| UX-01 | 進捗ステップ詳細化 | 📋 | 進捗 | 体験向上 |
| UX-02 | 「取得済みチャットコメント」文言 | 📋 | 進捗 | Quick win |
| UX-03 | 取得件数更新頻度 | 📋 | 進捗 | 体験向上 |
| UX-04 | 「UC」表記改善 | 📋 | 用語 | Quick win |
| UX-05 | スパチャ取得 | 🔍 | 取得 | 要調査 |
| UX-06 | スタンプとテキスト分析分離 | 📋 | 分析 | 大手配信 |
| UX-07 | 構成タイムライン改善 | 📋 | サマリー | 体験向上 |
| UX-08 | Top キーワード表示数 | 📋 | サマリー | Quick win |
| UX-09 | 盛り上がりの配信内位置 | 📋 | サマリー | 体験向上 |
| UX-10 | 話題ブロックサムネ | 📋 | 話題 | リッチ UI |
| UX-11 | 話題ラベル品質 | 📋 | 話題 | 大手配信 |
| UX-12 | 盛り上がり文脈情報 | 📋 | 盛り上がり | リッチ UI |
| UX-13 | 盛り上がりスコア説明 | 📋 | 盛り上がり | Quick win |
| UX-14 | 低活動区間（相対判定） | 📋 | 盛り上がり | 体験向上 |
| UX-15 | 投稿者プロフィールリンク | 📋 | コミュニティ | リッチ UI |
| UX-16 | Top 投稿者の特徴コメント | 📋 | コミュニティ | リッチ UI |
| UX-17 | ユーザー別解析ビュー | 📋 | コミュニティ | リッチ UI |
| UX-18 | 検索結果サムネ・リンク | 📋 | 検索 | リッチ UI |
| UX-19 | 除外ワード・除外ユーザー | 📋 | 設定 | 大手配信 |
| UX-20 | 設定永続化（Phase D） | 📋 | 設定 | Phase D |
| UX-21 | エクスポートファイル名 | ✅ | エクスポート | — |
| UX-22 | エクスポートメニュー表記短縮 | 📋 | エクスポート | Quick win |
| UX-23 | JSON/CSV 情報種別統一 | ❓ | エクスポート | 要確認 Q2 |
| UX-24 | グローバル表示フィルター | ❓ | 分析+UI | 要確認 Q1 |
| UX-25 | 差別化アイデアストック | 📋 | 差別化 | 要確認 Q3 |
| UX-26 | ヘッダ・ロゴ | ❓ | ブランド | 要確認 Q4 |
| UX-27 | ヘッダ動画 ID → 元動画リンク | 📋 | ナビ | Quick win |

---

## 4. 詳細

### 用語 FAQ — UX-04 関連

| 項目 | 内容 |
|------|------|
| **「UC」の意味** | Unique Chatters = **ユニーク投稿者数**（区間内の重複なし投稿者） |
| **現状 UI（2026-06-21）** | **「UC」表記**: `topics-tab.tsx` 表頭、`topic-timeline-bar.tsx` tooltip。**フル表記**: `summary-tab.tsx` KPI「ユニーク投稿者」、スコアカード「ユニーク」 |
| **改修案** | 「UC」を廃止し「ユニーク投稿者」等に統一。必要なら初回ツールチップ |

---

### A. 進捗・ナビゲーション

#### UX-01: 進捗画面のステップ表示を詳細化 📋

| 項目 | 内容 |
|------|------|
| **要望** | 処理段階をもう少し詳しく見せたい |
| **現状** | `analyze/[videoId]/page.tsx`: 1 行 `stepLabel` + 粗い `Progress`（fetch 状態のみ。`analysis_stage` 未使用）。分析中メッセージに「Pipeline は後続タスクで拡張」と ** outdated な文言**（L69–70） |
| **案** | 5 段階表示: URL 登録 → チャット取得 → 基本集計 → 話題・盛り上がり → 完了。`/status` の `analysis_stage` / `analysis_stage_label` を表示 |
| **関連** | §2 遷移タイミング問題 — **fetch 完了待ち** vs **analysis complete 待ち** のどちらで遷移するかも合わせて決定 |
| **触るファイル** | `frontend/app/analyze/[videoId]/page.tsx` |

#### UX-02: 「取得済みメッセージ」→「取得済みチャットコメント」 📋

| 項目 | 内容 |
|------|------|
| **現状** | `analyze/[videoId]/page.tsx` L88–89 |
| **触るファイル** | 同上 |

#### UX-03: 取得件数の更新頻度 📋

| 項目 | 内容 |
|------|------|
| **現状** | Backend `fetch_worker.py` `batch_size=500`。Frontend ポーリング **2.5s** |
| **案** | バッチ 100 + ポーリング 1s、件/秒表示 |
| **触るファイル** | `fetch_worker.py`, `analyze/[videoId]/page.tsx` |

#### UX-27: ヘッダの動画 ID / タイトルを元動画リンクに 📋

| 項目 | 内容 |
|------|------|
| **要望** | ヘッダの動画 ID（およびタイトル行）から YouTube 原典へ飛べるように |
| **現状** | 進捗: `SiteHeader title={\`動画 ID: ${videoId}\`}`（プレーンテキスト）。結果: `title={meta?.title ?? \`動画 ${videoId}\`}`。DB `videos.source_url` あり、**API 未返却**（§2） |
| **案** | `SiteHeader` に `youtubeUrl` prop。fallback `https://www.youtube.com/watch?v={videoId}`。外部リンクアイコン + `rel="noopener noreferrer"` |
| **未決** | Q5 — 結果画面タイトルもリンク化するか |
| **触るファイル** | `site-header.tsx`, `analyze/…/page.tsx`, `video-dashboard.tsx`, `videos.py`, `lib/api.ts` |

#### UX-26: ヘッダタイトル・ロゴ 📋 ❓Q4

| 項目 | 内容 |
|------|------|
| **要望** | ヘッダをかっこよく。ロゴマーク検討 |
| **現状** | `site-header.tsx`: テキスト `LiveChatScope` + サブ「配信後のチャットを、振り返り資料に。」 |
| **案** | ワードマーク調整、`public/logo.svg`, favicon, `layout.tsx` metadata |
| **触るファイル** | `site-header.tsx`, `layout.tsx`, `public/*` |

---

### B. データ取得・分析ロジック

#### UX-05: スパチャ情報 🔍

| 項目 | 内容 |
|------|------|
| **要望** | スパチャあり配信で正しく表示 |
| **現状** | `fetch_worker.py`: SC 系 `message_type` + `money`/`amount` dict。Stage 3: `super_chat_events` へ集約。テスト配信 `-K_aRlUGoLI` 等は **0 件**（スタンプ偏重・SC なしの可能性） |
| **調査** | ① SC あり配信で E2E ② chat-downloader フィールド ③ type enum ④ メンバーシップ等漏れ |
| **未決** | Q6 |
| **触るファイル** | `fetch_worker.py`, `stage3.py`, `revenue-tab.tsx` |

#### UX-06: スタンプとテキストの分析分離 📋

| 項目 | 内容 |
|------|------|
| **要望** | 密度・盛り上がりは全件可。**話題・キーワード**はスタンプ除外テキストから |
| **現状** | Stage 1–2: 全 messages。Stage 4–5: Janome + `stopwords_ja_chat.txt`（チャンネルスタンプ語が Top を独占しうる） |
| **案** | モード `all` / `text_only`。Stage 4–5 のみ `text_message` + スタンプパターン除外 |
| **関連** | UX-11, UX-19, UX-24 |
| **触るファイル** | `stage4.py`, `stage5.py`, 設定 JSON |

#### UX-24: グローバル表示フィルター 📋 ❓Q1

| 項目 | 内容 |
|------|------|
| **要望** | サマリー付近に「NG キーワード除外」「スタンプのみ発言除外」ON/OFF。**解析・表示・エクスポート**へ反映 |
| **現状** | フィルター UI なし。Switch コンポーネント **未導入** |
| **案** | `video-dashboard` Context + API query params または Pipeline 再実行（§1 Q1） |
| **関連** | UX-06, UX-19, UX-23 |
| **触るファイル** | `summary-tab.tsx`, `video-dashboard.tsx`, `export.py`, 各 API |

---

### C. サマリータブ

#### UX-07: 構成タイムライン 📋

| 項目 | 内容 |
|------|------|
| **要望** | グラフが空 / 内容が把握しづらい |
| **現状** | `TopicTimelineBar` は **`/summary` の `topic_blocks_preview` のみ**（最大 **5** ブロック）。`blocks.length===0` なら空メッセージ。**話題タブ**の `GET /topics` は全ブロック返却。`duration_seconds` 未設定時は `max(end_sec)` で TL 幅推定 |
| **切り分け** | ① A+ 未完了（`analysis_status!=complete`）→ preview 空 ② 完了だが topic 0 件 ③ preview 5 件のみで配信全体が欠ける ④ 描画バグ |
| **案** | summary に全ブロック or 専用 timeline API。fetch 時メタ保存（§2） |
| **触るファイル** | `topic-timeline-bar.tsx`, `analysis.py`, `fetch_worker.py` |

#### UX-08: Top キーワード表示数 📋

| 項目 | 内容 |
|------|------|
| **現状** | stage7 `summary_keywords_n=10`。`/summary` API は **`LIMIT 5`**（`analysis.py` L113–115）。話題タブ `/keywords?limit=20` は **最大 20 件**取得可 |
| **案** | summary API を stage7 設定に合わせる。UI 折りたたみ |
| **触るファイル** | `analysis.py`, `summary-tab.tsx` |

#### UX-09: 盛り上がりの配信内位置 📋

| 項目 | 内容 |
|------|------|
| **現状** | 時刻 + スコアのみ。`duration_seconds` が null になりやすい（§2） |
| **案** | `time/duration` → % + 「中盤」等ラベル |
| **触るファイル** | `summary-tab.tsx`, `highlights-tab.tsx`, `lib/format.ts`, `fetch_worker.py` |

---

### D. 話題分析タブ

#### UX-10: 話題ブロックサムネ 📋

| 案（段階） | B-1: 動画共通サムネ + 時刻。B-2: storyboard / API で近似フレーム |
| **触るファイル** | `topics-tab.tsx`, 新規 `lib/youtube-thumbnail.ts` |

#### UX-11: 話題ラベル品質 📋

| **現状** | スタンプ語がラベル化（例: `mikoKusa`） |
| **案** | UX-06 連動 + UI に「スタンプ除外ベース」明記 |

---

### E. 盛り上がりタブ

#### UX-12: 盛り上がり候補の文脈 📋

| **案** | ±N 秒の代表コメント / Top 投稿者。`highlight_context` テーブル or API 都度集計 |

#### UX-13: スコア説明 📋

| **現状** | Stage 2: `score = count / max(moving_avg, ma_floor)`。移動平均窓 **5 バケット**（60s バケットなら約 5 分）。`highlight_min_score=1.5` 未満は除外。UI は数値のみ |
| **案** | ツールチップで算式と目安（1.0=平均並み） |

#### UX-14: 低活動区間 📋

| **現状** | Stage 6c: `count < 全体平均×0.5` が **300s 以上**（`low_activity_min_sec=300`）。全編高密度配信では 0 件 |
| **案** | パーセンタイル基準、min 180s、グラフオーバーレイ |

---

### F. コミュニティタブ

#### UX-15: プロフィールリンク 📋

| **現状** | UI は `author_name` のみ。DB / messages に `author_id`（`UC…`）あり。`messages_api` は **author_id 未返却** |
| **案** | `https://www.youtube.com/channel/{author_id}` |

#### UX-16: Top 投稿者の特徴コメント 📋

| **案** | 完全一致最多文言 + token Top 3 |

#### UX-17: ユーザー別解析ビュー 📋

| **現状** | `author_stats` Top 20、`is_core_regular`（Stage 6b）、`topic_author_stats` |
| **案** | ユーザードロワー + `GET /authors/{id}/profile` |

---

### G. 詳細検索タブ

#### UX-18: 検索結果のサムネ・リンク 📋

| **案** | `MessageRow` 共通化（UX-10, UX-15） |

---

### H. 解析設定・永続化

#### UX-19: 除外ワード・除外ユーザー 📋

| **案（段階）** | B: URL 入力画面でセッション限定。D: ユーザー設定 DB |
| **関連** | UX-06, UX-24, `stopwords_ja_chat.txt` |

#### UX-20: 設定永続化 📋 Phase D

| **案** | 認証 + CRUD。POC 代用として localStorage 検討 |

---

### I. エクスポート

#### UX-21: ファイル名 ✅（2026-06-21）

`LiveChatScope_Result_{video_id}.*` — `export_names.py`, `export-filename.ts`

#### UX-22: メニュー表記短縮 📋

| **現状** | `export-menu.tsx`: 各形式×「ダウンロード」「クリップボードにコピー」= 10 行 |
| **案** | 「DL」「コピー」。収益タブ（`CSV ダウンロード` 等）との統一は要判断 |

#### UX-23: JSON / CSV 情報種別統一 ❓Q2

**現状の和集合（出すべき情報種別）**

| 種別 | JSON | CSV | 備考 |
|------|:----:|:---:|------|
| 動画メタ | ○ | △ | CSV は別セクション or ZIP |
| 密度バケット | ○ | △ | 同上 |
| Top 投稿者 | ○（**Top 20**） | △ | `author_stats` は 20 件のみ |
| スパチャ一覧 | ○ | △ | messages 行にも SC 列追加余地 |
| 全 messages | × | ○ | JSON に `messages[]` 追加 |

**その他 export（UX-23 対象外だが関連）**

| 形式 | 内容 | ギャップ |
|------|------|----------|
| markdown-summary（API） | ピーク、SC 合計 | キーワード・話題なし（stage8 キャッシュにはあり） |
| markdown-clips | highlights 全件 | 低活動なし |
| markdown-thanks | SC 一覧 | jump_url なし（収益タブ fallback のみ） |

#### UX-24 → §B 参照

---

## 5. 差別化アイデアストック（UX-25）

**前提**: §2 の DB テーブルから派生。**★**=既存テーブルのみで可 / **★★**=新 Stage または API / **★★★**=複数配信・外部 API。

| 優先候補 | ID | 概要 | ★ |
|----------|-----|------|---|
| 編集者向け | E1 | OBS / YouTube **チャプター形式** export（topic / highlight から） | ★ |
| 編集者向け | E2 | 編集ソフト用マーカー CSV | ★ |
| 配信者向け | E5 | clips MD + ハイライト ±N 秒の代表コメント（UX-12 連動） | ★★ |
| 分析 | B1 | キーワード**バースト**（`keyword_timeline` 急増） | ★ |
| 分析 | D2 | SC が**どの話題ブロック**に集中したか | ★ |
| 分析 | A6 | **バケット別 UC**（同時参加感） | ★★ |
| 分析 | B3 | 話題**遷移フロー**視覚化（`topic_transitions`） | ★ |
| 横断 | E6 | 同一チャンネル**複数配信比較** | ★★★ |

<details>
<summary>全件リスト（折りたたみ）</summary>

#### A. タイムライン・盛り上がり

| ID | アイデア | 実現性 |
|----|----------|:------:|
| A1 | 密度の速度・加速度（急上昇/急降下） | ★ |
| A2 | 配信内位置 %（UX-09 連動） | ★★ |
| A3 | ピーク多層（全体 / テキストのみ / SC） | ★★ |
| A4 | 低活動 + highlights 統合 TL | ★ |
| A5 | 初見キーワード + 密度スパイク | ★★ |
| A6 | バケット別 UC | ★★ |

#### B. 話題・キーワード

| ID | アイデア | 実現性 |
|----|----------|:------:|
| B1 | キーワードバースト | ★ |
| B2 | 共起・フレーズ Top（2-gram） | ★★ |
| B3 | 話題遷移サンキー | ★ |
| B4 | 話題ブロックエネルギースコア | ★★ |
| B5 | 質問コメント密度（？） | ★ |
| B6 | スタンプ vs テキスト比率 TL | ★★ |

#### C. コミュニティ

| ID | アイデア | 実現性 |
|----|----------|:------:|
| C1 | 常連コア層プロファイル | ★ |
| C2 | 発言集中度（Top N シェア） | ★★ |
| C3 | 初回発言タイミング分布 | ★★ |
| C4 | 投稿者タイプ分類（ルールベース） | ★★ |
| C5 | 話題間 Top 投稿者差分 | ★ |

#### D. 収益

| ID | アイデア | 実現性 |
|----|----------|:------:|
| D1 | SC 前後の密度比較 | ★★ |
| D2 | SC × 話題ブロック | ★ |
| D3 | 通貨換算合算（免責付き） | ★★ |
| D4 | system メッセージ TL | ★ |

#### E. 出力

| ID | アイデア | 実現性 |
|----|----------|:------:|
| E1 | チャプター形式 | ★ |
| E2 | 編集マーカー CSV | ★ |
| E3 | SNS 振り返りスレ草案 MD | ★★ |
| E4 | レポート PDF/HTML | ★★★ |
| E5 | clips + 文脈コメント | ★★ |
| E6 | 複数配信比較 | ★★★ |

</details>

**次ステップ**: Q3 回答後 Must 3 件確定 → 工数（API のみ / 新 Stage / UI）付記

---

## 6. 優先 tier（参考）

| tier | ID |
|------|-----|
| Quick win | UX-02, UX-04, UX-08, UX-13, UX-22, UX-27 |
| 体験向上 | UX-01, UX-03, UX-07, UX-09, UX-14, UX-26 |
| 大手配信 | UX-06, UX-11, UX-19, UX-24 |
| リッチ UI | UX-10, UX-12, UX-15〜18 |
| 要調査 | UX-05 |
| エクスポート | UX-23 |
| 差別化 | UX-25 |
| Phase D | UX-20 |

---

## 7. 完了条件（チェックリスト）

- [x] UX-21: エクスポートファイル名
- [ ] UX-04: UC 表記排除
- [ ] UX-05: SC 取得切り分け or UI 明示
- [ ] UX-06: text_only 分析
- [ ] UX-07: 構成 TL が配信全体を反映
- [ ] UX-08: summary キーワード ≥10（設定整合）
- [ ] UX-09: 盛り上がり配信内位置
- [ ] UX-13: スコア説明
- [ ] UX-14: 相対低活動の検出
- [ ] UX-15: プロフィールリンク
- [ ] §2 ギャップ: 動画メタ取得、partial/遷移タイミング、summary API LIMIT

---

## 8. 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-06-21 | 初版（UX-01〜03） |
| 2026-06-21 | 結果画面 feedback（UX-04〜20）、UC FAQ |
| 2026-06-21 | UX-21 完了（ファイル名） |
| 2026-06-21 | UX-22〜24、エクスポート精査 |
| 2026-06-21 | UX-25〜27（差別化・ブランド・動画リンク） |
| 2026-06-21 | **全体再整理**: §0 運用、§1 未決、§2 実装ギャップ、インデックス、精度修正（authors Top20、UC 表記箇所、メタ未保存、partial 未使用等） |
