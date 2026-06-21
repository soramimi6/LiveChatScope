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

## I. エクスポート

### UX-21: ダウンロードファイル名の改善 ✅ 実装済み（2026-06-21）

| 項目 | 内容 |
|------|------|
| **旧** | `{video_id}.json` / `{video_id}.csv` / `{video_id}-markdown-*.md` |
| **新** | `LiveChatScope_Result_{video_id}.json`, `.csv`, `_summary.md`, `_clips.md`, `_thanks.md` |
| **実装** | `backend/app/api/export_names.py`, `frontend/lib/export-filename.ts`, `export.py`, `export.ts`, `revenue-tab.tsx` |

### UX-22: エクスポートメニュー表記の簡素化

| 項目 | 内容 |
|------|------|
| **要望** | ドロップダウンが冗長。「ダウンロード」→ **「DL」**、「クリップボードにコピー」→ **「コピー」** など短い表記に |
| **現状** | `export-menu.tsx` の `actionLabel()` が `{ラベル}をダウンロード` / `{ラベル}をクリップボードにコピー` を各形式×2アクションで計 10 行表示 |
| **案** | 例: `JSON · DL` / `JSON · コピー`。グループ見出し（データ / Markdown）で形式を示し、動詞は短縮。収益タブのボタン文言も揃えるか要検討 |
| **触るファイル** | `frontend/components/export-menu.tsx`（`revenue-tab.tsx` は別途要否判断） |
| **優先** | Quick win |

### UX-23: JSON / CSV の出力情報種別を統一（最小公倍数マージ）

| 項目 | 内容 |
|------|------|
| **要望** | JSON と CSV で **出せる情報の種類を同じ** にしたい。現状それぞれの内容の **最小公倍数（和集合）** としてマージ |
| **現状（JSON）** | 動画メタ、`density[]`、`authors[]`（全件）、`super_chats[]`。**messages なし** |
| **現状（CSV）** | 全 messages の 6 列（`time_in_seconds`, `time_text`, `author_name`, `message_type`, `text`, `jump_url`）。集約データなし |
| **統一後に含める情報種別（案）** | ① 動画メタ ② 密度バケット ③ 投稿者ランキング ④ スパチャ一覧 ⑤ 全メッセージ行 |
| **形式ごとの載せ方（要設計）** | **JSON**: 上記を 1 オブジェクトにネスト（`messages[]` を追加）。**CSV**: メッセージを主 CSV とし、メタ・集約は先頭コメント行、`# section` 区切り、または ZIP 同梱の複数 CSV — 単一 CSV への無理な押し込みは避ける |
| **関連ギャップ** | FR-5「JSON 生データ」「CSV 分析列含む」、A-F5-01「messages 含む」と現実装が不一致。本改修で JSON 側は解消方向 |
| **触るファイル** | `backend/app/api/export.py`, `backend/tests/test_e2e_flow.py`, `docs/requirements.md` / `test-acceptance.md`（期待値更新） |
| **関連** | 下記「エクスポート内容精査メモ」、UX-24（フィルター ON 時はエクスポートにも反映） |

#### エクスポート内容精査メモ（2026-06-21 調査・未実装）

| 形式 | 主な出力 | DB にあるが未出力の例 |
|------|----------|----------------------|
| JSON | メタ・密度・authors・SC | messages, highlights, topics, keywords, stream_summary, UC |
| CSV | messages 6 列 | author_id, SC 金額列, 集約テーブル |
| markdown-summary（API） | ピーク・SC 合計 | キーワード・話題（**stage8 キャッシュ版にはあり、API 版になし** — 二重実装） |
| markdown-clips | highlights 全件 | 低活動区間 |
| markdown-thanks | SC 一覧 + 固定テンプレ | jump_url（収益タブ fallback のみあり） |

**削減候補（別チケット）**: Markdown 内 `analysis_status`、stage8 の「stream_summary キャッシュ済み」注記、thanks 固定テンプレの任意化。

### UX-24: サマリー画面のグローバル表示フィルター（NG キーワード / スタンプのみ除外）

| 項目 | 内容 |
|------|------|
| **要望** | サマリー画面に **切り替えスイッチ** を追加。「**NG キーワードを除外する**: ON/OFF」「**スタンプのみの発言を除外する**: ON/OFF」等。解析・結果表示・**エクスポート** に反映される **グローバル指定** |
| **現状** | フィルター UI なし。除外は `stopwords_ja_chat.txt`（解析時固定）のみ。密度・盛り上がりは全メッセージ、話題は Janome + ストップワード（UX-06） |
| **案（UI）** | サマリータブ上部（またはダッシュボード共通バー）に Switch 2 本 + 状態バッジ「フィルター適用中」。Switch コンポーネントは **未導入**（新規追加 or Checkbox で代用） |
| **案（スコープ — 要ユーザー確認）** | **A. 表示のみ**: API クエリパラメータで都度集計（72k 規模は負荷注意）。**B. 解析再実行**: トグル変更で Pipeline 再走（正確だが重い）。**C. ハイブリッド**: 密度は全件、話題・キーワード・エクスポート messages のみフィルター（UX-06 の `all` / `text_only` と整合） |
| **NG キーワード** | UX-19 の除外ワードと統合。第一弾は **セッション / video 単位** のカンマ区切り入力 + localStorage。ON 時は `stopwords` に加算 |
| **スタンプのみ除外** | テキストがスタンプパターンのみの行を除外（`:xxx:` / チャンネル絵文字名等）。`stamp_patterns.txt` または正規表現設定（UX-06 参照） |
| **反映先** | サマリー KPI・キーワード・話題、話題/盛り上がり/コミュニティ/検索タブ、JSON/CSV エクスポート（UX-23 と連動） |
| **触るファイル** | `summary-tab.tsx`, `video-dashboard.tsx`（Context で全タブ共有）, 新規 `view-filters` API または query params 全 API 拡張, `export.py`, `stage1.py`〜`stage5.py`（再解析時）, `analysis_defaults.json` |
| **関連** | UX-06, UX-11, UX-19, UX-20, UX-23 |
| **注意** | **明示指示があるまで実装しない**（改善メモ段階） |

---

## J. 差別化・ブランディング（ブレスト / UI polish）

### UX-25: 解析・出力バリエーションの拡充（差別化ブレスト）

| 項目 | 内容 |
|------|------|
| **要望** | 解析・出力のバリエーションを増やし差別化を図りたい。**現在取得・蓄積している情報** から算出可能で、**実現可能性がある** 候補をブレストで洗い出し、優先順位づけしたい |
| **前提データ（既存 DB）** | `messages`, `density_buckets`, `author_stats`, `message_type_stats`, `highlights`, `super_chat_*`, `keyword_stats`, `keyword_timeline`, `topic_blocks`, `topic_transitions`, `topic_author_stats`, `low_activity_segments`, `stream_summary`, `videos` メタ（`source_url`, `duration_seconds` 等） |
| **注意** | **明示指示があるまで実装しない**。以下はアイデアストック。★=既存テーブルだけで比較的容易 / ★★=新 Stage または API 拡張 / ★★★=外部データ・ML・複数配信横断 |

#### A. タイムライン・盛り上がり系

| # | アイデア | 概要 | 実現性 | 主な出力先 |
|---|----------|------|:------:|------------|
| A1 | **コメント速度・加速度** ★ | 密度バケットの差分 / 2次差分で「急上昇」「急降下」区間 | 高 | 盛り上がりタブ、summary MD |
| A2 | **配信内位置正規化** ★★ | 全指標を `time / duration`（%・早い/中盤/終盤）で表示（UX-09 連動） | 高 | サマリー、clips MD |
| A3 | **ピークの多層分解** ★★ | 全体ピーク vs テキストのみピーク vs SC ピークを並列表示 | 中 | サマリー、収益 |
| A4 | **低活動 ↔ 高活動マップ** ★ | 既存 `low_activity_segments` + highlights を 1 本 TL に統合 | 高 | 盛り上がり、エクスポート |
| A5 | **初見・定着シグナル** ★★ | 「初見」「はじめまして」等キーワード + 密度スパイクで **流入っぽい区間** 推定 | 中 | 話題タブ、新規 KPI |
| A6 | **バケット別ユニーク投稿者** ★★ | 1 分ごとの UC（現状はブロック単位のみ）→ **同時参加感** の可視化 | 中 | 新グラフ、JSON export |

#### B. 話題・キーワード系

| # | アイデア | 概要 | 実現性 | 主な出力先 |
|---|----------|------|:------:|------------|
| B1 | **キーワードバースト** ★ | `keyword_timeline` の急増語 → 「この瞬間に急増した語」 | 高 | 話題タブ、summary |
| B2 | **共起・フレーズ Top** ★★ | 2-gram / 3-gram または名詞句ペア（Stage 4 拡張） | 中 | 話題、エクスポート |
| B3 | **話題遷移サンキー / フロー** ★ | 既存 `topic_transitions` の視覚強化 | 高 | 話題タブ |
| B4 | **話題ブロック「エネルギー」** ★★ | `message_count × unique_authors × density_peak` 等の合成スコア | 中 | サマリースコアカード |
| B5 | **質問コメント密度** ★ | `?` / 「？」終わり行の時系列 | 高 | 新 KPI、編集者向け |
| B6 | **スタンプ vs テキスト比率 TL** ★★ | `message_type_stats` + 時系列（UX-06 連動） | 中 | サマリー、大手配信向け |

#### C. コミュニティ・投稿者系

| # | アイデア | 概要 | 実現性 | 主な出力先 |
|---|----------|------|:------:|------------|
| C1 | **常連コア層プロファイル** ★ | `is_core_regular` + `topic_author_stats` の深掘りカード | 高 | コミュニティ |
| C2 | **発言集中度（Gini っぽい指標）** ★★ | Top N 投稿者が全体の何 % を占めるか | 中 | サマリー KPI |
| C3 | **初回発言タイミング分布** ★★ | 各 author の first_message_sec ヒストグラム | 中 | コミュニティ |
| C4 | **投稿者タイプ分類** ★★ | 短文連投 / 長文 / SC 寄与 / スタンプ勢 — ルールベース | 中 | コミュニティ、JSON |
| C5 | **話題別ファンランキング差分** ★ | ブロック A と B で Top 投稿者の入れ替わり | 高 | コミュニティ |

#### D. 収益・スパチャ系

| # | アイデア | 概要 | 実現性 | 主な出力先 |
|---|----------|------|:------:|------------|
| D1 | **SC 直前直後のチャット熱** ★★ | SC 時刻 ±60s の density 比較 | 中 | 収益タブ |
| D2 | **SC タイミング vs 話題ブロック** ★ | どの推定話題中に SC が集中したか | 高 | 収益、thanks MD |
| D3 | **通貨換算サマリー** ★★ | 固定レート or 表示時換算で合算（免責付き） | 中 | 収益 KPI |
| D4 | **メンバー / システムイベント TL** ★ | `message_type=system` の時刻一覧 | 高 | 収益 or 新タブ |

#### E. 出力フォーマット・編集者向け（差別化の核）

| # | アイデア | 概要 | 実現性 | 主な出力先 |
|---|----------|------|:------:|------------|
| E1 | **OBS / YouTube チャプター形式** ★ | topic_blocks / highlights から `00:00:00 タイトル` | 高 | 新 export type |
| E2 | **編集ソフト用マーカー CSV** ★ | Premiere / DaVinci 等向けシンプル CSV（時刻, ラベル） | 高 | 新 export |
| E3 | **X / SNS 振り返りスレ草案 MD** ★★ | Top ハイライト + キーワード + ジャンプをテンプレ化 | 中 | 新 export |
| E4 | **「配信レポート」PDF/HTML 一括** ★★★ | サマリー + グラフ SVG 埋め込み | 低〜中 | 新 export |
| E5 | **ハイライト ±N 秒の代表コメント束** ★★ | clips MD に文脈コメント Top 3 を添付（UX-12 連動） | 中 | clips MD |
| E6 | **比較レポート（同一チャンネル複数配信）** ★★★ | 複数 `video_id` 横断 — 要 UI・DB 設計 | 低 | Phase D |

#### F. 次のアクション（ブレスト継続用）

- [ ] 上表から **Must / Nice / Later** をユーザーとすり合わせ
- [ ] 「競合に無い」軸を 3 つに絞る（例: チャプター export + 話題遷移 + SC×密度）
- [ ] 各候補の **工数目安**（API のみ / 新 Stage / フロントグラフ）を付記
- [ ] UX-23 エクスポート統一・UX-24 フィルターとの組み合わせ表を作る

---

### UX-26: ヘッダタイトル・ロゴのブラッシュアップ

| 項目 | 内容 |
|------|------|
| **要望** | ヘッダのタイトルをもう少しかっこよく。**ロゴマーク画像** の作成も検討 |
| **現状** | `site-header.tsx`: テキスト `LiveChatScope`（`text-lg font-semibold`）+ サブコピー「配信後のチャットを、振り返り資料に。」結果画面では `title` に動画タイトル、`subtitle` にチャンネル名 |
| **案（ typography ）** | ワードマークの字間・ウェイト調整、サブコピーを短く（例: 「ライブチャットを、振り返りに。」）、結果画面は **プロダクト名 + 動画タイトル** の階層を明確化 |
| **案（ロゴ）** | チャット吹き出し + スコープ/レンズモチーフ。`public/logo.svg`（ヘッダ用）、`public/icon.png` / `favicon.ico`（ブラウザタブ）。ダーク/ライト両対応 |
| **案（実装）** | `next/image` で SVG 表示、`layout.tsx` の metadata.icons 更新。第一弾は **SVG 1 点** からでも可 |
| **触るファイル** | `frontend/components/site-header.tsx`, `frontend/app/layout.tsx`, `public/*`, 必要なら `docs/ui-spec.md` |
| **注意** | ロゴ生成はデザイン作業 — **明示指示後** に画像 asset 作成 or 外部デザイン取込 |

---

### UX-27: ヘッダの動画 ID を元動画リンクに

| 項目 | 内容 |
|------|------|
| **要望** | ヘッダの **動画 ID 部分** を、YouTube **元動画へのリンク** にしたい |
| **現状** | **進捗画面** `analyze/[videoId]/page.tsx`: `SiteHeader title={\`動画 ID: ${videoId}\`}` — プレーンテキスト。**結果画面** `video-dashboard.tsx`: メタ未取得時 `動画 ${videoId}`、通常は動画タイトル表示（ID はヘッダに出ない）。DB には `videos.source_url` あり |
| **案** | `SiteHeader` に `videoUrl?: string` / `videoId?: string` を追加。ID またはタイトル行を `<a href={source_url} target="_blank" rel="noopener noreferrer">` でラップ。URL 未取得時は `https://www.youtube.com/watch?v={videoId}` を fallback |
| **UX** | 外部リンクアイコン（↗）、hover で「YouTube で開く」。進捗中も ID タップで配信ページへ |
| **触るファイル** | `site-header.tsx`, `analyze/[videoId]/page.tsx`, `video-dashboard.tsx`（`getVideo` の `source_url` を API レスポンスに含める必要があれば `videos.py` / `VideoMetaResponse` も） |
| **関連** | UX-26（ロゴと並ぶヘッダ左側の情報設計） |
| **優先** | Quick win |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-06-21 | 初版（進捗画面 UX-01〜03） |
| 2026-06-21 | 結果画面 feedback 一括追加（UX-04〜20）、UC FAQ |
| 2026-06-21 | **UX-21 完了**: エクスポートファイル名を `LiveChatScope_Result_{video_id}_*` 形式に統一 |
| 2026-06-21 | エクスポート精査メモ、UX-22（メニュー表記）、UX-23（JSON/CSV 統一）、UX-24（グローバルフィルター）を追記 — **未実装** |
| 2026-06-21 | UX-25（差別化ブレスト）、UX-26（ヘッダ・ロゴ）、UX-27（動画 ID → 元動画リンク）を追記 — **未実装** |
