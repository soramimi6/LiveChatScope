# LiveChatScope — API 詳細仕様

> タスク D-2 | ブランチ: `docs/api-spec`  
> 参照: [アーキテクチャ.md](アーキテクチャ.md), [UI仕様.md](UI仕様.md), [要件.md](要件.md)

## 1. 概要

### 1.1 基本方針

| 項目 | 決定 |
|------|------|
| ベース URL（開発） | `http://localhost:8000` |
| API バージョン | **`/api/v1`** プレフィックス固定 |
| 形式 | JSON（`Content-Type: application/json`） |
| 認証 | **なし**（第一弾 POC・ローカル / 単一ユーザー想定） |
| OpenAPI | FastAPI 自動生成 `/docs`, `/openapi.json` |
| 位置づけ | **POC** — Phase D で認証・レート制限を追加 |

### 1.2 フロント連携（開発）

| 項目 | 値 |
|------|-----|
| Next.js | `http://localhost:3000` |
| FastAPI | `http://localhost:8000` |
| CORS | `allow_origins=["http://localhost:3000"]` |
| フロント env | `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` |

本番・Docker 化時は環境変数で差し替え。

---

## 2. 共通仕様

### 2.1 エラーレスポンス

```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "有効な YouTube URL を入力してください",
    "details": {}
  }
}
```

| HTTP | 用途 |
|------|------|
| 400 | リクエスト不正（URL 形式等） |
| 404 | video_id 不存在 |
| 409 | 同一 video 処理中（任意・第一弾は 202 でも可） |
| 422 | バリデーションエラー（Pydantic） |
| 500 | サーバー内部エラー |
| 503 | chat-downloader 障害等 |

### 2.2 識別子

- **`video_id`**: YouTube 11 文字 ID（例: `dQw4w9WgXcQ`）
- API パス `{id}` は `video_id` を指す

### 2.3 時刻・URL

| フィールド | 型 | 説明 |
|------------|-----|------|
| `time_in_seconds` | number | 配信開始からの秒（float 可） |
| `time_text` | string | `HH:MM:SS` 表示用 |
| `jump_url` | string | `https://www.youtube.com/watch?v={video_id}&t={floor(sec)}s` |

---

## 3. ジョブ状態

### 3.1 `videos.fetch_status`

| 値 | 説明 |
|----|------|
| `pending` | ジョブ登録済み、未取得 |
| `fetching` | chat-downloader 実行中 |
| `fetched` | messages 保存完了 |
| `failed` | 取得失敗 |

### 3.2 `videos.analysis_status`

| 値 | 説明 |
|----|------|
| `pending` | 分析未開始 |
| `running` | Pipeline 実行中 |
| `partial` | Phase A 基本分析のみ完了 |
| `complete` | Phase A+ まで完了 |
| `failed` | 分析失敗 |

### 3.3 クライアントポーリング

- 進捗画面: `GET /api/v1/videos/{id}/status` を **2〜3 秒間隔**
- `fetch_status=fetched` かつ `analysis_status=complete` → ダッシュボードへ遷移
- `failed` → エラー表示

---

## 4. エンドポイント一覧

| Method | Path | 説明 | UI |
|--------|------|------|-----|
| POST | `/api/v1/videos` | 分析開始 | トップ |
| GET | `/api/v1/videos/{id}` | 動画メタ情報 | Header |
| GET | `/api/v1/videos/{id}/status` | ジョブ状態 | 進捗 |
| GET | `/api/v1/videos/{id}/summary` | 振り返りサマリー | サマリー |
| GET | `/api/v1/videos/{id}/density` | 密度バケット | 盛り上がり |
| GET | `/api/v1/videos/{id}/highlights` | 盛り上がり候補 | 盛り上がり |
| GET | `/api/v1/videos/{id}/low-activity` | 低活動区間 | 盛り上がり |
| GET | `/api/v1/videos/{id}/topics` | 話題ブロック | 話題 / サマリー |
| GET | `/api/v1/videos/{id}/topics/transitions` | 話題遷移 | 話題 |
| GET | `/api/v1/videos/{id}/keywords` | キーワード | 話題 / サマリー |
| GET | `/api/v1/videos/{id}/super-chats` | スパチャ一覧 | 収益 |
| GET | `/api/v1/videos/{id}/super-chats/summary` | スパチャ集計 | 収益 / サマリー |
| GET | `/api/v1/videos/{id}/authors` | 投稿者統計 | コミュニティ |
| GET | `/api/v1/videos/{id}/authors/by-topic/{block_id}` | 話題別 Top | コミュニティ |
| GET | `/api/v1/videos/{id}/messages` | メッセージ検索 | 詳細検索 |
| GET | `/api/v1/videos/{id}/export/{type}` | エクスポート | 全体 |

---

## 5. エンドポイント詳細

### POST `/api/v1/videos`

分析ジョブを開始する。

**Request**

```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

| フィールド | 型 | 必須 | 説明 |
|------------|-----|:----:|------|
| `url` | string | ✓ | `watch?v=` / `youtu.be/` |

**Response 202 Accepted**

```json
{
  "video_id": "VIDEO_ID",
  "fetch_status": "pending",
  "analysis_status": "pending",
  "status_url": "/api/v1/videos/VIDEO_ID/status"
}
```

**エラー**

| code | 条件 |
|------|------|
| `INVALID_URL` | URL 形式不正 |
| `ALREADY_PROCESSING` | 同一 video 処理中（任意） |

**処理**: バックグラウンドで Fetch → Pipeline 起動（第一弾 POC は FastAPI BackgroundTasks 可）。

---

### GET `/api/v1/videos/{id}`

**Response 200**

```json
{
  "video_id": "VIDEO_ID",
  "title": "配信タイトル",
  "channel_name": "チャンネル名",
  "duration_seconds": 7200,
  "message_count": 12345,
  "fetch_status": "fetched",
  "analysis_status": "complete",
  "fetched_at": "2026-06-21T12:00:00Z",
  "analyzed_at": "2026-06-21T12:05:00Z"
}
```

---

### GET `/api/v1/videos/{id}/status`

進捗画面用。ポーリング推奨。

**Response 200**

```json
{
  "video_id": "VIDEO_ID",
  "fetch_status": "fetching",
  "analysis_status": "pending",
  "progress": {
    "messages_fetched": 8500,
    "messages_total_estimate": null,
    "analysis_stage": null,
    "analysis_stage_label": null
  },
  "error": null
}
```

| `fetch_status` 時の `progress` | 内容 |
|-------------------------------|------|
| `fetching` | `messages_fetched` を更新 |
| `running` | `analysis_stage`（0–8）, `analysis_stage_label` |

**失敗時**

```json
{
  "video_id": "VIDEO_ID",
  "fetch_status": "failed",
  "analysis_status": "pending",
  "progress": {},
  "error": {
    "code": "REPLAY_DISABLED",
    "message": "チャットリプレイが無効です"
  }
}
```

| error.code | 説明 |
|------------|------|
| `REPLAY_DISABLED` | リプレイ無効 |
| `VIDEO_NOT_FOUND` | 動画不存在 / 非公開 |
| `FETCH_FAILED` | 取得一般エラー |
| `ANALYSIS_FAILED` | 分析失敗 |

---

### GET `/api/v1/videos/{id}/summary`

**Response 200** — FR-3s1。サマリータブの主データ源。

```json
{
  "video_id": "VIDEO_ID",
  "message_count": 12345,
  "unique_authors": 890,
  "peak": {
    "time_in_seconds": 3600,
    "time_text": "01:00:00",
    "density": 120,
    "jump_url": "https://www.youtube.com/watch?v=VIDEO_ID&t=3600s"
  },
  "super_chat_total": [
    { "currency": "JPY", "amount": 50000, "count": 12 }
  ],
  "topic_block_count": 8,
  "top_highlights": [
    {
      "rank": 1,
      "time_in_seconds": 1234.5,
      "time_text": "00:20:34",
      "score": 3.2,
      "jump_url": "https://www.youtube.com/watch?v=VIDEO_ID&t=1234s"
    }
  ],
  "top_keywords": [
    { "token": "ボス", "count": 450, "rank": 1 }
  ],
  "topic_blocks_preview": [
    {
      "block_id": "uuid",
      "block_index": 0,
      "start_sec": 0,
      "end_sec": 900,
      "label": "オープニング / 雑談",
      "label_note": "チャット上の推定話題",
      "message_count": 1200,
      "unique_authors": 300,
      "jump_url": "https://www.youtube.com/watch?v=VIDEO_ID&t=0s"
    }
  ],
  "generated_at": "2026-06-21T12:05:00Z"
}
```

`analysis_status` が `partial` の場合、A+ フィールドは空配列 / null 可。

---

### GET `/api/v1/videos/{id}/density`

**Query**

|  param | 型 |  default | 説明 |
|--------|-----|----------|------|
| `bucket_sec` | int | 60 | バケット幅（秒） |

**Response 200**

```json
{
  "video_id": "VIDEO_ID",
  "bucket_sec": 60,
  "buckets": [
    { "bucket_start_sec": 0, "count": 45 },
    { "bucket_start_sec": 60, "count": 52 }
  ],
  "average_count": 38.5
}
```

---

### GET `/api/v1/videos/{id}/highlights`

**Query**: `limit` (default 10)

**Response 200**

```json
{
  "video_id": "VIDEO_ID",
  "items": [
    {
      "rank": 1,
      "time_in_seconds": 1234.5,
      "time_text": "00:20:34",
      "score": 3.2,
      "clip_start_sec": 1204,
      "clip_end_sec": 1264,
      "jump_url": "https://www.youtube.com/watch?v=VIDEO_ID&t=1234s"
    }
  ]
}
```

`clip_*` は切り抜き候補 ±30 秒（FR-3p2）。

---

### GET `/api/v1/videos/{id}/low-activity`

**Response 200**

```json
{
  "video_id": "VIDEO_ID",
  "items": [
    {
      "start_sec": 1800,
      "end_sec": 2100,
      "duration_sec": 300,
      "avg_density": 12.3,
      "start_jump_url": "https://www.youtube.com/watch?v=VIDEO_ID&t=1800s"
    }
  ]
}
```

---

### GET `/api/v1/videos/{id}/topics`

**Response 200** — FR-3c, FR-3s2

```json
{
  "video_id": "VIDEO_ID",
  "items": [
    {
      "block_id": "uuid",
      "block_index": 0,
      "start_sec": 0,
      "end_sec": 900,
      "label": "オープニング / 雑談",
      "label_note": "チャット上の推定話題",
      "message_count": 1200,
      "unique_authors": 300,
      "super_chat_total": [{ "currency": "JPY", "amount": 1000, "count": 1 }],
      "jump_url": "https://www.youtube.com/watch?v=VIDEO_ID&t=0s"
    }
  ]
}
```

---

### GET `/api/v1/videos/{id}/topics/transitions`

**Response 200** — FR-3d（第一弾はテーブル向け JSON）

```json
{
  "video_id": "VIDEO_ID",
  "items": [
    {
      "from_block_index": 0,
      "from_label": "オープニング",
      "to_block_index": 1,
      "to_label": "本編",
      "at_sec": 900
    }
  ]
}
```

---

### GET `/api/v1/videos/{id}/keywords`

**Query**

| param | 型 | default | 説明 |
|-------|-----|---------|------|
| `limit` | int | 20 | Top N |
| `bucket_sec` | int | null | 指定時はタイムライン付き |

**Response 200**

```json
{
  "video_id": "VIDEO_ID",
  "overall": [
    { "token": "ボス", "count": 450, "rank": 1 }
  ],
  "timeline": [
    {
      "bucket_start_sec": 0,
      "tokens": [{ "token": "こんにちは", "count": 30 }]
    }
  ]
}
```

`timeline` は `bucket_sec` 指定時のみ（省略可・第一弾）。

---

### GET `/api/v1/videos/{id}/super-chats`

**Query**: `page`, `page_size` (default 50)

**Response 200**

```json
{
  "video_id": "VIDEO_ID",
  "items": [
    {
      "time_in_seconds": 600,
      "time_text": "00:10:00",
      "author_name": "viewer1",
      "amount": 500,
      "currency": "JPY",
      "message": "がんばれ",
      "jump_url": "https://www.youtube.com/watch?v=VIDEO_ID&t=600s"
    }
  ],
  "pagination": { "page": 1, "page_size": 50, "total": 12 }
}
```

---

### GET `/api/v1/videos/{id}/super-chats/summary`

**Response 200**

```json
{
  "video_id": "VIDEO_ID",
  "super_chat_status": "none_in_chat",
  "super_chat_status_message": "この配信のチャット上では…",
  "by_currency": [
    { "currency": "JPY", "total_amount": 50000, "count": 12 }
  ],
  "timeline": [
    { "bucket_start_sec": 0, "count": 0, "amount_jpy": 0 }
  ]
}
```

`super_chat_status`: `present` | `none_in_chat` | `amount_parse_failed`（UX-05）

---

### GET `/api/v1/videos/{id}/authors`

**Query**: `limit` (default 20), `core_only` (bool, FR-3p4)

**Response 200**

```json
{
  "video_id": "VIDEO_ID",
  "items": [
    {
      "author_id": "UCxxx",
      "author_name": "regular_user",
      "message_count": 150,
      "rank": 1,
      "is_core_regular": true
    }
  ]
}
```

---

### GET `/api/v1/videos/{id}/authors/by-topic/{block_id}`

**Response 200** — FR-3e

```json
{
  "block_id": "uuid",
  "items": [
    { "author_name": "user1", "message_count": 45, "rank": 1 }
  ]
}
```

---

### GET `/api/v1/videos/{id}/messages`

**Query**

| param | 型 | 説明 |
|-------|-----|------|
| `q` | string | キーワード部分一致 |
| `author` | string | 投稿者名 |
| `message_type` | string | 種別フィルタ |
| `page` | int | default 1 |
| `page_size` | int | default 50, max 100 |

**Response 200**

```json
{
  "video_id": "VIDEO_ID",
  "items": [
    {
      "message_id": "xxx",
      "time_in_seconds": 100,
      "time_text": "00:01:40",
      "author_name": "user1",
      "message_type": "text_message",
      "text": "こんにちは",
      "jump_url": "https://www.youtube.com/watch?v=VIDEO_ID&t=100s"
    }
  ],
  "pagination": { "page": 1, "page_size": 50, "total": 12345 }
}
```

---

### GET `/api/v1/videos/{id}/export/{type}`

**Path `type`**: `json` | `csv` | `markdown-summary` | `markdown-clips` | `markdown-thanks`

**Query（任意）**

| param | 説明 |
|-------|------|
| `download` | `true` で `Content-Disposition: attachment` |

**Response**

| type | Content-Type |
|------|--------------|
| json / csv | `application/json` / `text/csv` |
| markdown-* | `text/markdown` |

第一弾: ファイルダウンロード + フロントでのコピー用に同一 body を返す。

**JSON (`export_version: 2`)**: 動画メタ、`density`, `authors`, `super_chats`, **全 `messages`**, 分析完了時は `highlights`, `topics`, `keywords`, `low_activity`, `stream_summary` を含む。

**CSV**: `messages` のチャットログのみ（集約データは含まない）。収益タブのスパチャ CSV は別途クライアント生成。フィルター適用時は messages のみフィルター済み行を出力。

---

### POST `/api/v1/videos/{id}/analysis/refilter`

表示フィルター変更時に段階 4, 5, 6a, 6b, 7, 8 を再実行（6c 省略）。

**Request**

```json
{
  "display_filter": {
    "exclude_stamp_only": true,
    "exclude_ng_keywords": false,
    "ng_keywords": [],
    "excluded_author_ids": []
  }
}
```

**Response**: `202 Accepted` — `{ video_id, analysis_status: "running", status_url }`

**Errors**: `409` — 初回分析未完了 / 更新中

**GET `/api/v1/videos/{id}`** に `display_filter` オブジェクトを追加。

---

## 6. FastAPI 実装メモ（POC）

```python
# CORS（開発）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター
api = APIRouter(prefix="/api/v1")
```

- 認証ミドルウェア: **第一弾なし**
- BackgroundTasks で Fetch + Pipeline（Celery は Phase B）
- Pydantic モデル = 本仕様の Request / Response

---

## 7. 画面 ↔ API 対応

| UI タブ | 主 API |
|---------|--------|
| トップ | POST `/videos` |
| 進捗 | GET `/videos/{id}/status` |
| サマリー | GET `/summary` |
| 話題 | GET `/topics`, `/topics/transitions`, `/keywords` |
| 盛り上がり | GET `/density`, `/highlights`, `/low-activity` |
| 収益 | GET `/super-chats`, `/super-chats/summary`, `/density` |
| コミュニティ | GET `/authors`, `/authors/by-topic/{block_id}` |
| 詳細検索 | GET `/messages` |
| エクスポート | GET `/export/{type}` |

---

## 8. 完了条件（D-2）

- [x] `/api/v1` プレフィックス確定
- [x] 認証なし POC 明記
- [x] CORS・別ポート開発（3000 / 8000）
- [x] 全エンドポイント一覧
- [x] リクエスト / レスポンス JSON スキーマ
- [x] エラー形式・ジョブ状態遷移
- [x] UI 対応表
