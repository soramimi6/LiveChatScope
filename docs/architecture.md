# LiveChatScope — 技術アーキテクチャ

> 要件: [requirements.md](requirements.md) | API 詳細: [api-spec.md](api-spec.md) | UI: [ui-spec.md](ui-spec.md)

## 全体構成

```
[Web UI]
   │  URL入力 / サマリー / 話題分析 / ジャンプリンク / エクスポート
   ▼
[API Server]
   │
   ├─ Fetch Worker    … chat-downloader でリプレイ取得
   ├─ Analysis Pipeline … 正規化 → 集計 → 話題分析 → 派生出力
   └─ Storage         … DB（messages + analysis 派生テーブル）
```

## 確定スタック

| レイヤ | 技術 | 備考 |
|--------|------|------|
| 取得 Worker | Python + chat-downloader | リプレイ取得（非公式 API・要リスク管理） |
| 分析 | Python | Worker と同一プロセス可（第一弾 POC） |
| 形態素解析 | **Janome** | 第一弾。精度不足時 SudachiPy へ |
| API | **FastAPI** | `/api/v1`、OpenAPI 自動生成 |
| DB | **SQLite**（第一弾）→ PostgreSQL | 10 万コメント級まで SQLite |
| ジョブ | 同期（第一弾）→ Redis + Celery | Phase B 以降 |
| フロント | **Next.js**（App Router） | TypeScript |
| UI | **shadcn/ui + Tailwind CSS** | 詳細は ui-spec.md |
| グラフ | **Recharts** | 密度・重ねグラフ |
| 認証 | **なし**（第一弾 POC） | Phase D で OAuth |

方針: **メインストリームで安全な定番技術**を採用。第一弾はインフラ最小、将来は段階的拡張。

---

## 技術選定の根拠

### 全体方針

LiveChatScope の処理は **取得（Python 向き）→ 分析（データ処理）→ 表示（Web UI）** に分かれる。  
各レイヤに業界標準の定番を置き、第一弾 POC では **1 人開発でも破綻しにくい** 構成とする。

| 観点 | 方針 |
|------|------|
| メインストリーム | npm / PyPI で実績が厚い定番 |
| 安全 | フレームワーク本体は大コミュニティが維持 |
| 第一弾 | SQLite・認証なし・単一プロセス可 |
| 将来 | PostgreSQL・ジョブキュー・認証へ段階的拡張 |

### Python + FastAPI（バックエンド）

| 項目 | 内容 |
|------|------|
| 選定理由 | chat-downloader・Janome と **同一言語**で取得〜分析〜 API を一体運用 |
| 特徴 | 型ヒント、Pydantic、**OpenAPI 自動生成**（`/docs`） |
| メインストリーム度 | 2020 年代以降の Python 新規 API で de facto |
| 見送り | Django（第一弾には過剰）、Node（Python NLP 資産と二言語化） |

### chat-downloader（取得）

| 項目 | 内容 |
|------|------|
| 選定理由 | 終了後リプレイは **公式 API 不可**。OSS として最も実績がある |
| 特徴 | MIT、`time_in_seconds` 付与、スパチャ対応 |
| リスク | **非公式 API 依存** — 仕様変更・ToS。バージョン固定・定期確認が必須 |

### Next.js（フロント）

| 項目 | 内容 |
|------|------|
| 選定理由 | React 系 **de facto**、App Router が画面構成と一致 |
| 特徴 | 情報量最多、shadcn/ui との一体性、将来 Vercel デプロイ可 |
| 見送り | Vue/Svelte（UI 部品エコシステムが React 中心） |

### shadcn/ui + Tailwind + Recharts（UI）

| 項目 | 内容 |
|------|------|
| 選定理由 | 2024–2026 年の **SaaS ダッシュボード標準セット** |
| 特徴 | Radix（a11y）+ Tailwind（CSS 標準）、Recharts（React チャート定番） |
| 見送り | MUI（重い）、素 Tailwind のみ（工数増） |

### SQLite → PostgreSQL（DB）

| 項目 | 内容 |
|------|------|
| 第一弾 | **ファイル 1 つ**で完結。Docker 不要。10 万コメント級まで十分 |
| 将来 | マルチユーザー・本格 FTS・並列書き込みは PostgreSQL |
| 移行 | SQL を PostgreSQL 互換で設計し、移行パスを確保 |

### Janome（形態素解析）

| 項目 | 内容 |
|------|------|
| 第一弾 | Pure Python、**MeCab 不要** — Windows 開発で詰まりにくい |
| 将来 | 精度不足時 **SudachiPy** へ差し替え |

### 技術リスク一覧

| 技術 | メインストリーム | 第一弾安全性 | 備考 |
|------|:----------------:|:------------:|------|
| FastAPI / Next.js / SQLite | ◎ | ◎ | 定番 |
| shadcn / Tailwind / Recharts | ◎ | ◎ | 定番 |
| Janome | ○ | ◎ | 導入容易 |
| chat-downloader | ○ | △ | **唯一の非公式依存** |

---

## 開発環境（第一弾 POC）

| 項目 | 決定 |
|------|------|
| API バージョン | **`/api/v1/...`** で固定 |
| 認証 | **なし**（ローカル・単一ユーザー POC） |
| フロント | `http://localhost:3000`（Next.js） |
| API | `http://localhost:8000`（FastAPI） |
| CORS | FastAPI で `http://localhost:3000` を許可 |
| DB | `data/livechatscope.db`（gitignore） |

詳細なエンドポイント・スキーマ: [api-spec.md](api-spec.md)

---

## 取得フロー

1. ユーザーが URL を送信
2. API が `video_id` を抽出し、`videos` レコードを `pending` で作成
3. Fetch Worker が chat-downloader でリプレイをイテレート
4. メッセージを正規化して `messages` にバッチ INSERT
5. 取得完了後、`videos.status = fetched` に更新
6. **Analysis Pipeline を起動**（同一 Worker 内 or 別ジョブ）
7. Pipeline 完了後、`videos.status = analyzed`、UI に通知

---

## 分析パイプライン

### 概要

取得済み `messages` を入力とし、**段階的に派生データを生成**する。
各ステージは前ステージの出力に依存する。失敗したステージは再実行可能とする。

```
messages (raw)
    │
    ▼
[Stage 0] 正規化・インデックス
    │
    ▼
[Stage 1] 基本集計 ──────────────────────────┐
    │                                        │
    ▼                                        ▼
[Stage 2] 盛り上がり検出              [Stage 3] スパチャ集計
    │                                        │
    ▼                                        │
[Stage 4] 形態素解析・キーワード              │
    │                                        │
    ▼                                        │
[Stage 5] 話題ブロック分割                    │
    │                                        │
    ├──────────────┬─────────────────────────┤
    ▼              ▼                         ▼
[Stage 6a]    [Stage 6b]              [Stage 6c]
話題遷移      話題別アクティブユーザ    低活動区間
    │              │                         │
    └──────────────┴────────────┬────────────┘
                                ▼
                         [Stage 7] 振り返りサマリー
                                │
                                ▼
                         [Stage 8] エクスポート用ビュー生成
```

### ステージ一覧

| Stage | 名称 | 入力 | 出力（DB / キャッシュ） | 対応 FR | Phase |
|:-----:|------|------|-------------------------|---------|-------|
| 0 | 正規化・インデックス | raw messages | `messages`（正規化済）、全文検索 index | FR-2 | A |
| 1 | 基本集計 | messages | `density_buckets`, `author_stats`, `message_type_stats` | FR-3 基本 | A |
| 2 | 盛り上がり検出 | density_buckets | `highlights` | FR-3a | A+ |
| 3 | スパチャ集計 | messages (super_chat) | `super_chat_events`, `super_chat_summary` | FR-3 基本, FR-3p1, FR-3p5 | A / A+ |
| 4 | 形態素解析・キーワード | messages (text) | `tokens`, `keyword_stats`, `keyword_timeline` | FR-3b | A+ |
| 5 | 話題ブロック分割 | keyword_timeline, density | `topic_blocks` | FR-3c, FR-3s2, FR-3s3 | A+ |
| 6a | 話題遷移 | topic_blocks | `topic_transitions` | FR-3d | A+ |
| 6b | 話題別アクティブユーザ | topic_blocks, messages | `topic_author_stats` | FR-3e, FR-3p4 | A+ |
| 6c | 低活動区間 | density_buckets | `low_activity_segments` | FR-3p3 | A+ |
| 7 | 振り返りサマリー | 全派生テーブル | `stream_summary`（1行 + JSON blob） | FR-3s1 | A+ |
| 8 | エクスポートビュー | highlights, super_chat, topic_blocks | ファイル生成（Markdown / CSV） | FR-3p2, FR-5 | A+ |

### ジョブ状態

`videos.analysis_status`:

| 値 | 意味 |
|----|------|
| `pending` | 取得完了、分析未開始 |
| `running` | Pipeline 実行中 |
| `partial` | 基本分析のみ完了（Phase A 相当） |
| `complete` | Phase A+ まで完了 |
| `failed` | 失敗（`analysis_error` に理由） |

Phase A MVP では Stage 0〜1（+ Stage 3 の最小）で `partial` とし、A+ 追加時に Stage 2, 4〜8 実行で `complete` へ。

---

## Stage 詳細

### Stage 0: 正規化・インデックス

**目的**: 以降の全ステージが参照する統一スキーマを保証する。

**処理**:

1. chat-downloader 出力を `messages` 行にマッピング
2. `time_in_seconds` 欠損行は分析対象外フラグ（または timestamp から推定を試み、失敗時スキップ）
3. `message_type` を enum 化（`text_message`, `super_chat`, `super_sticker`, `system`, …）
4. `jump_url` を生成列として保存（または API 層で都度生成）
5. 全文検索用 index 更新（SQLite FTS5 / PostgreSQL tsvector）

**正規化ルール（例）**:

```
text        ← message（空なら null）
author_id   ← author.id
author_name ← author.name
amount      ← super_chat 系フィールド（存在時）
currency    ← super_chat 系フィールド（存在時）
```

---

### Stage 1: 基本集計

**目的**: 密度タイムライン・Top N・種別集計（Phase A MVP の分析コア）。

**処理**:

1. **密度バケット**: `time_in_seconds` を `bucket_sec`（初期値 60秒）で floor し、件数集計  
   → `density_buckets(video_id, bucket_start_sec, count)`
2. **投稿者 Top N**: `author_id` ごとに count、上位 N 件  
   → `author_stats(video_id, author_id, author_name, message_count, rank)`
3. **種別集計**: `message_type` ごとの count  
   → `message_type_stats`

**パラメータ（設定可能）**:

| キー | 初期値 | 説明 |
|------|--------|------|
| `density_bucket_sec` | 60 | 密度グラフの粒度 |
| `author_top_n` | 20 | Top N 件数 |

---

### Stage 2: 盛り上がり検出（FR-3a）

**目的**: 密度スパイクから「見返すべき瞬間」候補を抽出。

**アルゴリズム（案）**:

1. `density_buckets` を移動平均（窓 = 5バケット）で平滑化
2. 各バケットの `score = count / moving_avg`（移動平均 0 回避）
3. スコア上位 N 件を `highlights` に保存
4. 近接候補（±2バケット以内）はマージし、代表時刻 = ピークバケット中央

**出力**:

```
highlights(video_id, time_in_seconds, score, rank, jump_url)
```

**パラメータ**:

| キー | 初期値 |
|------|--------|
| `highlight_top_n` | 10 |
| `highlight_merge_window_sec` | 120 |

---

### Stage 3: スパチャ集計

**目的**: 収益タブ・お礼リスト・密度重ねのデータ源。

**処理**:

1. `message_type IN (super_chat, super_sticker, …)` を抽出
2. `super_chat_events` に時刻・金額・投稿者・本文・jump_url を保存
3. `super_chat_summary` に合計・件数・通貨別内訳
4. Stage 1 の `density_buckets` と時刻 join 用にタイムライン系列を用意（FR-3p5）

---

### Stage 4: 形態素解析・キーワード（FR-3b）

**目的**: 話題ブロックの入力特徴量、配信全体の語俯瞰。

**処理**:

1. `text_message` の `text` を形態素解析
2. **ストップワード除去**: 助詞・助動詞、チャット固有（`www`, `草`, `888`, 単独絵文字等）
3. トークンを `tokens(video_id, message_id, time_in_seconds, token, pos)` に保存（pos は品詞）
4. **全体頻度**: `keyword_stats(video_id, token, count, rank)`
5. **時間帯頻度**: バケット単位で co-occurrence  
   → `keyword_timeline(video_id, bucket_start_sec, token, count)`

**技術選定**:

| 候補 | 長所 | 短所 |
|------|------|------|
| SudachiPy | 精度・辞書 | 依存がやや重い |
| Janome | 軽量・導入容易 | 精度は Sudachi より劣る |

MVP 推荐: **Janome** で開始 → 精度不足時 SudachiPy へ移行。

---

### Stage 5: 話題ブロック分割（FR-3c）

**目的**: 配信を「チャット上の話題区間」に分割し、代表語ラベルを付与。

**アルゴリズム（案）— 語分布の変化点検出**:

1. Stage 4 の `keyword_timeline` をバケット×語の行列にする
2. 隣接バケット間でコサイン距離（または JS ダイバージェンス）を計算
3. 距離が閾値を超える点を**変化点**とする
4. 変化点で区間分割 → `topic_blocks`
5. 各区間の **代表語ラベル**: 区間内 Top 3 キーワードを連結（例: `ボス戦 / 無理 / 草`）
6. 区間メタ: `message_count`, `unique_authors`, 区間内スパチャ合計

**出力**:

```
topic_blocks(
  block_id, video_id, block_index,
  start_sec, end_sec,
  label,          -- 推定ラベル（UI で「チャット上の話題」と明記）
  message_count, unique_authors, super_chat_total
)
```

**パラメータ**:

| キー | 初期値 | 説明 |
|------|--------|------|
| `topic_window_sec` | 60 | 語分布の集計窓（Stage 4 と揃える） |
| `topic_change_threshold` | 要チューニング | 変化点判定 |
| `topic_min_block_sec` | 180 | 短すぎる区間は隣接とマージ |

**注意**: ラベルは推定値。UI では必ず「推定」「チャット上の話題」と表示。

---

### Stage 6a: 話題遷移（FR-3d）

**入力**: `topic_blocks`（block_index 順）

**出力**: `topic_transitions(from_block_id, to_block_id, from_label, to_label)`

**UI 向け**: 帯グラフ（横軸=時間、色=block_index）＋遷移一覧。

---

### Stage 6b: 話題別アクティブユーザ（FR-3e, FR-3p4）

**処理**:

1. 各 `topic_block` の `[start_sec, end_sec)` 内メッセージを抽出
2. `author_id` ごとに count → Top N
3. **常連コア層（FR-3p4）**: 全ブロックの 50% 以上に登場する author を別フラグ

**出力**: `topic_author_stats(block_id, author_id, author_name, message_count, rank, is_core_regular)`

---

### Stage 6c: 低活動区間（FR-3p3）

**処理**:

1. `density_buckets.count` の配信全体平均を算出
2. 連続バケットで `count < avg * low_ratio` が `min_duration` 以上続く区間を抽出

**パラメータ**:

| キー | 初期値 |
|------|--------|
| `low_activity_ratio` | 0.5 |
| `low_activity_min_sec` | 300 |

---

### Stage 7: 振り返りサマリー（FR-3s1）

**処理**: 派生テーブルを集約し 1 レコード + JSON にまとめる。

```json
{
  "message_count": 12345,
  "unique_authors": 890,
  "peak_time_sec": 3600,
  "peak_density": 120,
  "super_chat_total": { "JPY": 50000 },
  "topic_block_count": 8,
  "top_highlights": [ ... ],
  "top_keywords": [ ... ]
}
```

→ `stream_summary(video_id, summary_json, generated_at)`

Stage 7 完了後、UI の「サマリー」タブは **この JSON のみ** を読めば表示可能（API 設計を単純化）。

---

### Stage 8: エクスポートビュー生成

**オンデマンド or Pipeline 末尾**:

| 出力 | ソース | 形式 |
|------|--------|------|
| スパチャお礼リスト | super_chat_events | CSV, Markdown |
| 切り抜き候補パック | highlights ±30秒 | Markdown（YouTube タイムスタンプ） |
| 生データ | messages | JSON, CSV |

ファイルは `exports/{video_id}/` に保存、または API 経由でストリーム生成。

---

## データモデル（分析派生）

```sql
-- Phase A
density_buckets     (video_id, bucket_start_sec, count)
author_stats        (video_id, author_id, author_name, message_count, rank)
message_type_stats  (video_id, message_type, count)
super_chat_events   (video_id, time_in_seconds, author_name, amount, currency, text, jump_url)
super_chat_summary  (video_id, currency, total_amount, count)

-- Phase A+
highlights          (video_id, time_in_seconds, score, rank, jump_url)
tokens              (video_id, message_id, time_in_seconds, token)  -- 大量。必要なら集計後削除
keyword_stats       (video_id, token, count, rank)
keyword_timeline    (video_id, bucket_start_sec, token, count)
topic_blocks        (block_id, video_id, block_index, start_sec, end_sec, label, ...)
topic_transitions   (video_id, from_block_id, to_block_id)
topic_author_stats  (block_id, author_id, author_name, message_count, rank, is_core_regular)
low_activity_segments (video_id, start_sec, end_sec, avg_density)
stream_summary      (video_id, summary_json, generated_at)
```

**ストレージ方針**:

- `tokens` は中間データ。Pipeline 完了後に削除し、`keyword_*` のみ残す（MVP 推奨）
- `stream_summary.summary_json` で UI 向け denormalize、詳細タブは個別テーブルを参照

---

## API 設計（概要）

詳細仕様は [api-spec.md](api-spec.md) を参照。ベースパス: **`/api/v1`**。

| Method | Path | 説明 |
|--------|------|------|
| POST | `/api/v1/videos` | URL 送信 → 取得ジョブ開始 |
| GET | `/api/v1/videos/{id}/status` | 取得・分析ステータス |
| GET | `/api/v1/videos/{id}/summary` | サマリー（Stage 7） |
| GET | `/api/v1/videos/{id}/density` | 密度バケット |
| GET | `/api/v1/videos/{id}/highlights` | 盛り上がり候補 |
| GET | `/api/v1/videos/{id}/topics` | 話題ブロック |
| GET | `/api/v1/videos/{id}/topics/transitions` | 話題遷移 |
| GET | `/api/v1/videos/{id}/keywords` | キーワード統計 |
| GET | `/api/v1/videos/{id}/super-chats` | スパチャ一覧 |
| GET | `/api/v1/videos/{id}/authors` | 投稿者統計 |
| GET | `/api/v1/videos/{id}/low-activity` | 低活動区間 |
| GET | `/api/v1/videos/{id}/messages` | ページング + 検索 |
| GET | `/api/v1/videos/{id}/export/{type}` | markdown / csv / json |

---

## 再実行・冪等性

- Pipeline は `video_id` 単位で **冪等** に設計する
- 再分析時: 派生テーブルを `DELETE WHERE video_id = ?` → 全 Stage 再実行
- Stage 単位再実行（将来）: `analysis_stage_log` で完了 Stage を記録

---

## ジャンプ URL 生成

```
https://www.youtube.com/watch?v={video_id}&t={floor(time_in_seconds)}s
```

- ソース: `messages.time_in_seconds` または派生テーブルの `time_in_seconds` / `start_sec`
- 表示用: `HH:MM:SS` 変換ユーティリティを API / フロント共通モジュール化

---

## chat-downloader 出力（参考）

```json
{
  "message_id": "...",
  "message": "...",
  "message_type": "text_message",
  "time_in_seconds": 1234.56,
  "time_text": "20:34",
  "author": { "id": "...", "name": "..." }
}
```

---

## Phase D で追加する要素

- 認証（OAuth）
- ユーザー/IP レート制限
- `video_id` 単位の取得キャッシュ
- Pipeline の非同期キュー化・同時実行上限
- 監視（取得失敗率・Pipeline  stage 失敗率・仕様変更検知）

---

## リスク

- 公式 API では終了後取得不可 → 非公式手段に依存
- YouTube 内部 API 変更で Fetch Worker が停止する可能性
- 話題ブロックの精度は配信ジャンル依存 → パラメータ調整 UI は Phase B 以降
- `tokens` 中間データは大規模配信で容量増 → 集計後削除をデフォルトに
- 公開サービス時は ToS・再配布範囲・データ保持期間の整理が必要
