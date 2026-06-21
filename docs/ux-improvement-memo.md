# LiveChatScope — UI/UX 改修メモ

> **記録日**: 2026-06-21  
> **出典**: ローカル環境での実画面確認（ユーザー feedback）  
> **優先度**: Phase B 以降（第一弾完成後の polish / 差別化）  
> **関連**: [phase-1-checklist.md](phase-1-checklist.md) §C

---

## 背景

第一弾プロトタイプは **取得 → 分析 → 結果表示** まで一連の動作を確認済み（設計・実装は概ね合格）。  
以下は **実際の画面を見て気づいた改善点** を逐次整理した backlog。

---

## 用語メモ（FAQ）

### 「UC」とは？

| 項目 | 内容 |
|------|------|
| **現状 UI** | 話題タブ表頭・構成タイムライン tooltip に **「UC」** と略記（`topics-tab.tsx`, `topic-timeline-bar.tsx`） |
| **意味** | **Unique Chatters** = **ユニーク投稿者数**（その区間・ブロック内で発言した **重複なし** のユーザー数） |
| **問題** | 略称だけでは意味が伝わらない |
| **改修案（UX-04）** | **「UC」表記を廃止**し、「ユニーク投稿者」「投稿者数（重複なし）」等に統一。初回表示時はツールチップで説明 |

---

## A. 進捗画面（初回 feedback）

### UX-01: 進捗画面のステップ表示を詳細化

| 項目 | 内容 |
|------|------|
| **現状** | 1 行の `stepLabel` のみ。プログレスバーは fetch 状態に粗く紐づく |
| **要望** | ステップをもう少し詳細に |
| **案** | ① URL 登録 → ② チャット取得 → ③ 基本分析 → ④ 話題・盛り上がり → ⑤ 完了。`analysis_stage` / `analysis_stage_label` を表示 |
| **触るファイル** | `frontend/app/analyze/[videoId]/page.tsx` |

### UX-02: 「取得済みメッセージ」→「取得済みチャットコメント」

| 項目 | 内容 |
|------|------|
| **現状** | `frontend/app/analyze/[videoId]/page.tsx` L88–89 |
| **要望** | ライブチャット用語に合わせて文言変更 |
| **触るファイル** | 同上 |

### UX-03: 取得件数の更新頻度を上げる

| 項目 | 内容 |
|------|------|
| **現状** | Backend `batch_size=500`（`fetch_worker.py`）、Frontend ポーリング 2.5s |
| **要望** | 500 件刻みでは「動いてる感」が弱い |
| **案** | バッチ 100 件 + ポーリング 1s、スピナー / 件/秒表示 |
| **触るファイル** | `fetch_worker.py`, `analyze/[videoId]/page.tsx` |

---

## B. データ取得・分析ロジック

### UX-05: スパチャ情報が取れていない

| 項目 | 内容 |
|------|------|
| **現状** | Stage 3 が `super_chat` 系 `message_type` + `super_chat_amount` に依存。テスト配信（`-K_aRlUGoLI` 等）では **スパチャ 0 件** で Empty 表示 |
| **要望** | スパチャがある配信で正しく取得・表示したい |
| **調査項目** | ① スパチャあり配信で再現テスト ② chat-downloader が `money` / `amount` フィールドを返しているか ③ `message_type` の enum 不一致 ④ メンバーシップ・スーパーステッカー等の種別漏れ |
| **触るファイル** | `fetch_worker.py`, `stage0.py`, `stage3.py`, `revenue-tab.tsx` |
| **備考** | 「取得漏れバグ」か「当該配信にスパチャが無かっただけ」かを切り分け必要 |

### UX-06: スタンプとテキストの分析分離（大手・長時間配信向け）

| 項目 | 内容 |
|------|------|
| **現状** | 密度・盛り上がり・Top 投稿者は **全メッセージ** ベース。話題・キーワードは Janome + ストップワード（`stopwords_ja_chat.txt`）だが **`mikoKusa` 等のチャンネルスタンプが Top 語を独占** |
| **要望** | **カウント・盛り上がり** → スタンプ込みでよい。**話題・文脈把握** → **スタンプ除外のテキスト発言** から抽出 |
| **案** | 分析モードを二系統: `all` / `text_only`。話題 Stage 4–5 は `text_message` かつスタンプパターン除外（正規表現 + チャンネル絵文字辞書）。密度は現状維持 |
| **触るファイル** | `stage4.py`, `stage5.py`, `stopwords_ja_chat.txt`, 新規 `stamp_patterns.txt` または設定 JSON |
| **関連** | UX-19 除外ワード設定と連携 |

---

## C. サマリータブ

### UX-07: 構成タイムラインのグラフに内容がない

| 項目 | 内容 |
|------|------|
| **現状** | `TopicTimelineBar`（`topic-timeline-bar.tsx`）が `summary.topic_blocks_preview` を積み上げ棒で表示。API は preview **最大 5 ブロック**（`analysis.py` LIMIT 5）。`duration_seconds` が null の場合は block の `end_sec` から推定 |
| **要望** | グラフが空に見える / 内容が把握できない |
| **調査項目** | ① Recharts 積み上げ 1 行データの描画不具合 ② preview が空なのに `topic_block_count > 0` ③ 凡例はあるが棒が見えない（色・domain）④ **全ブロックではなく preview 5 件のみ** でタイムラインが欠ける |
| **案** | `/summary` または timeline 専用 API で **全 topic_blocks** を返す。グラフ高さ・ラベル改善。動画 `duration_seconds` を fetch 時に保存 |
| **触るファイル** | `topic-timeline-bar.tsx`, `analysis.py`, `fetch_worker.py` / `videos` メタ |

### UX-08: Top キーワードの表示数を増やす

| 項目 | 内容 |
|------|------|
| **現状** | Stage 7 `summary_keywords_n` 既定 **10**。ただし `/summary` API が **`LIMIT 5`** で上書き（`analysis.py` L113–115）— **API と設定の不一致** |
| **要望** | もっと多く見たい |
| **案** | API の LIMIT を `summary_keywords_n` に合わせる。UI は Badge + グラフの表示件数を設定可能に（例: 10 / 20 / 30）。折りたたみ「もっと見る」 |
| **触るファイル** | `analysis.py`, `stage7.py`, `summary-tab.tsx`, `analysis_defaults.json` |

### UX-09: Top 盛り上がりに「配信全体の中の位置」を表示

| 項目 | 内容 |
|------|------|
| **現状** | `time_text`（00:58:30）とスコアのみ |
| **要望** | 「全体の中央付近」「後半 3/4 あたり」等、**配信時間に対する位置** が分かる表示 |
| **案** | `position_ratio = time_in_seconds / duration_seconds` → 表示例: 「58:30（全体の 42%・中盤）」。帯 UI またはプログレスバー上にマーカー |
| **触るファイル** | `summary-tab.tsx`, `highlights-tab.tsx`, `lib/format.ts` |
| **依存** | 動画尺 `duration_seconds` の取得・保存 |

---

## D. 話題分析タブ

### UX-04: 「UC」表記の改善

→ 上記 **用語メモ（FAQ）** 参照。

### UX-10: 話題ブロックに YouTube サムネイル表示

| 項目 | 内容 |
|------|------|
| **要望** | 各ブロックの開始時刻付近の **動画サムネ** を一覧に表示 |
| **技術的検討** | ① **配信全体サムネ** は `https://i.ytimg.com/vi/{video_id}/hqdefault.jpg` で容易 ② **時刻指定サムネ** は公式の単純 URL が無く、YouTube Data API・storyboard スプライト解析・oEmbed 等が必要 ③ 外部画像 hotlink の ToS・キャッシュ方針 |
| **案（段階）** | Phase B-1: ブロック共通の動画サムネ + 時刻ラベル。Phase B-2: storyboard または API で **近似フレーム** サムネ |
| **触るファイル** | `topics-tab.tsx`, `summary-tab.tsx`（スコアカード）, 新規 `lib/youtube-thumbnail.ts` |

### UX-11: 話題ラベルの品質（スタンプ偏重）

| 項目 | 内容 |
|------|------|
| **現状** | 代表語が `::_ / mikoKusa / :_` 等 |
| **要望** | 文脈が分かる話題ラベル |
| **案** | UX-06 の **text_only 分析** と連動。UI に「スタンプ除外ベースの推定話題」と明記 |

---

## E. 盛り上がりタブ

### UX-12: 盛り上がり候補にサムネ・文脈情報

| 項目 | 内容 |
|------|------|
| **要望** | 各候補に **サムネ**、その時間帯の **Top 投稿者・代表発言・推定話題** |
| **案** | ハイライト時刻 ±N 秒の messages から Top 語・Top author を都度集計 or Pipeline で `highlight_context` テーブル追加。サムネは UX-10 と共通基盤 |
| **触るファイル** | `highlights-tab.tsx`, 新規 Stage 2b または API 拡張 |

### UX-13: 盛り上がりスコアの説明不足

| 項目 | 内容 |
|------|------|
| **現状** | Stage 2: `score = count / moving_avg`（移動平均比）。UI は `スコア 1.8` のみ |
| **要望** | スコアの意味・最小/最大・目安が分からない |
| **案** | ツールチップ: 「この1分間のコメント数 ÷ 前後5分の平均」。配信内 min/max を表示。「1.0 = 平均並み、2.0 = 2倍盛り上がり」等。必要なら 0–3 に正規化 |
| **触るファイル** | `highlights-tab.tsx`, `summary-tab.tsx`, `docs/analysis-params.md`, `ui-spec.md` |

### UX-14: 低活動区間が検出されない / 相対判定

| 項目 | 内容 |
|------|------|
| **現状** | Stage 6c: `count < 全体平均 × 0.5` が **300 秒以上** 続く区間のみ（`low_activity_min_sec=300`）。**全編高密度** の配信では **0 件** になりうる |
| **要望** | **相対的に低い** 区間も見たい |
| **案** | ① 閾値を配信内 **パーセンタイル**（下位 20%）基準に変更 ② `min_duration` を 180s に緩和 ③ 「平均より X% 低い」ランキング表示 ④ グラフ上に薄色オーバーレイ |
| **触るファイル** | `stage6c.py`, `analysis_defaults.json`, `highlights-tab.tsx` |

---

## F. コミュニティタブ

### UX-15: ユーザー名から YouTube プロフィールへのリンク

| 項目 | 内容 |
|------|------|
| **現状** | `author_name` テキストのみ。DB に `author_id` あり（chat-downloader の `author.id`、多くは `UC...` 形式） |
| **要望** | プロフィール URL へリンク |
| **案** | `https://www.youtube.com/channel/{author_id}` または `@handle` が取れる場合はそちら。外部リンクアイコン付き |
| **触るファイル** | `community-tab.tsx`, `messages_api.py`（author_id 返却確認）, `search-tab.tsx` |
| **注意** | author_id 欠損時はリンクなし |

### UX-16: 全体 Top 投稿者に「最大頻度コメント / ワード」

| 項目 | 内容 |
|------|------|
| **要望** | 件数に加え **最も多く送った文言** や **特徴ワード** |
| **案** | author ごとに message 頻度 Top 1（完全一致）+ Stage 4 token Top 3 を `author_stats` 拡張 or API で on-the-fly |
| **触るファイル** | 新規集計 Stage / `community-tab.tsx`, `analysis.py` |

### UX-17: ユーザー別解析ビュー（常連コア層など）

| 項目 | 内容 |
|------|------|
| **現状** | 話題ブロック別 Top は `topic_author_stats`。全体 Top + `is_core_regular` フラグあり（Stage 6b） |
| **要望** | **ユーザー軸** で見たい（常連コア層の発言傾向、活動時間帯等） |
| **案** | コミュニティタブに「ユーザー詳細」ドロワー: 発言数推移、よく使う語、所属話題ブロック、プロフィールリンク |
| **触るファイル** | `community-tab.tsx`, 新規 API `GET /authors/{author_id}/profile` |

---

## G. 詳細検索タブ

### UX-18: 検索結果にサムネ・プロフィールリンク

| 項目 | 内容 |
|------|------|
| **要望** | メッセージ行に **時刻サムネ**（または動画サムネ + 時刻）、**投稿者リンク** |
| **案** | UX-10 / UX-15 の共通コンポーネント化（`MessageRow`） |
| **触るファイル** | `search-tab.tsx` |

---

## H. 解析設定・永続化（Phase D 寄り）

### UX-19: 解析時の「除外ワード」「除外ユーザー」指定

| 項目 | 内容 |
|------|------|
| **要望** | 解析前または解析時に除外リストを指定 |
| **案（段階）** | B: 解析 URL 入力画面で **セッション限定** の除外ワード/ユーザー（カンマ区切り）。D: **ログインユーザー設定** として DB 保存・メンテ UI |
| **データモデル案** | `user_settings`（Phase D）: `excluded_tokens[]`, `excluded_author_ids[]`, `stamp_exclude_mode` |
| **触るファイル** | `page.tsx`（URL 入力）, `pipeline.py`, `stage4.py`, 新規 settings API |
| **関連** | UX-06 スタンプ除外、既存 `stopwords_ja_chat.txt` |

### UX-20: 利用者毎の設定永続化・メンテナンス

| 項目 | 内容 |
|------|------|
| **要望** | 除外ワード等を **ユーザー毎に保存** し、次回以降も使える |
| **依存** | 認証（Phase D）、設定 CRUD UI |
| **案** | 第一弾 POC では **localStorage** で代用可能か検討（端末ローカルのみ） |

---

## 関連する既知の実装メモ

| 項目 | ファイル | 内容 |
|------|----------|------|
| 進捗ポーリング | `frontend/app/analyze/[videoId]/page.tsx` | 2.5s。`fetched` で遷移（分析完了前の可能性） |
| バッチ進捗 | `backend/app/services/fetch_worker.py` | `batch_size = 500` |
| サマリー API キーワード | `backend/app/api/analysis.py` | **LIMIT 5**（設定 10 と不一致 → UX-08） |
| 構成 TL preview | `backend/app/api/analysis.py` | topic_blocks **LIMIT 5**（全ブロック未反映 → UX-07） |
| 低活動 | `backend/app/services/analysis/stage6c.py` | 平均×0.5 未満が 300s+ |
| 盛り上がり score | `backend/app/services/analysis/stage2.py` | count / moving_avg |
| UC 表記 | `topics-tab.tsx`, `topic-timeline-bar.tsx` | Unique authors 略称 |

---

## 優先順位（更新案）

|  tier | ID | 理由 |
|------|-----|------|
| **Quick win** | UX-02, UX-04, UX-08, UX-13 | 文言・説明・API 不一致修正 |
| **体験向上** | UX-01, UX-03, UX-07, UX-09, UX-14 | 進捗・サマリー・盛り上がりの体感 |
| **大手配信向け** | UX-06, UX-11, UX-19 | スタンプ偏重対策 |
| **リッチ UI** | UX-10, UX-12, UX-15, UX-16, UX-17, UX-18 | サムネ・リンク・ユーザー軸 |
| **要調査** | UX-05 | スパチャ取得 |
| **Phase D** | UX-20 | 認証付き設定永続化 |

---

## 完了条件（追加分）

- [ ] UX-04: UI から「UC」略称を排除しユニーク投稿者と明示
- [ ] UX-05: スパチャあり配信で収益タブにイベント表示（または取得不能理由を UI 明示）
- [ ] UX-06: 話題分析に text_only モード（スタンプ除外）
- [ ] UX-07: 構成タイムラインに全ブロックまたは相当の視覚情報
- [ ] UX-08: Top キーワード件数を設定どおり表示（≥10）
- [ ] UX-09: 盛り上がりに配信内位置（% / 早い・中盤・終盤）
- [ ] UX-13: スコアの意味を UI で説明
- [ ] UX-14: 相対的低活動区間を 1 配信以上で検出可能
- [ ] UX-15: author_id がある場合プロフィールリンク

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-06-21 | 初版（進捗画面 UX-01〜03） |
| 2026-06-21 | 結果画面 feedback 一括追加（UX-04〜20）、UC FAQ |
