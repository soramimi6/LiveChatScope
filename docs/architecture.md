# LiveChatScope — 技術アーキテクチャ（たたき台）

## 全体構成

```
[Web UI]
   │  URL入力 / 検索 / グラフ / ジャンプリンク
   ▼
[API Server]
   │
   ├─ Fetch Worker   … chat-downloader でリプレイ取得
   ├─ Analyzer       … 集計・検索インデックス
   └─ Storage        … DB + 生 JSON（任意）
```

## 推奨スタック（案）

| レイヤ | 技術 | 備考 |
|--------|------|------|
| 取得 Worker | Python + chat-downloader | リプレイ取得の実績 |
| API | FastAPI | Worker 連携が容易 |
| DB | SQLite（MVP）→ PostgreSQL | 全文検索・集計 |
| ジョブ | 同期（MVP）→ Redis + Celery | 長時間取得用 |
| フロント | Next.js または SvelteKit | 検索 UI・グラフ |
| グラフ | Chart.js / Recharts | 時系列密度 |

## 取得フロー

1. ユーザーが URL を送信
2. API が `video_id` を抽出
3. Worker が chat-downloader でリプレイをイテレート
4. メッセージを正規化して DB に INSERT
5. 集計テーブル・全文検索インデックスを更新
6. UI に完了通知

## ジャンプ URL 生成

```
https://www.youtube.com/watch?v={video_id}&t={floor(time_in_seconds)}s
```

- ソース: chat-downloader の `time_in_seconds`（リプレイ/VOD で付与）
- 表示用: `time_text` または `HH:MM:SS` 変換

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

## Phase D で追加する要素

- 認証（OAuth）
- ユーザー/IP レート制限
- `video_id` 単位の取得キャッシュ
- ジョブキュー・同時実行上限
- 監視（取得失敗率・仕様変更検知）

## リスク

- 公式 API では終了後取得不可 → 非公式手段に依存
- YouTube 内部 API 変更で Worker が停止する可能性
- 公開サービス時は ToS・再配布範囲・データ保持期間の整理が必要
