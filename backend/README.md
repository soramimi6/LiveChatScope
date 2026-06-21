# LiveChatScope Backend

FastAPI + chat-downloader（第一弾 POC）

## 要件

- Python 3.11+
- pip

## セットアップ

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

`chat-downloader` は YouTube 互換のため [Indigo128 fork](https://github.com/Indigo128/chat-downloader) を利用しています。

## 起動

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Health: http://localhost:8000/health

## 実装済み（W1）

- SQLite 初期化（`backend/db/schema.sql`）
- `POST /api/v1/videos` — URL から取得ジョブ開始
- `GET /api/v1/videos/{id}/status` — 進捗
- `GET /api/v1/videos/{id}` — メタ情報
- chat-downloader によるリプレイ取得（バックグラウンド）

## 未実装（後続タスク）

- Analysis Pipeline Stage 0–8
- 残り REST エンドポイント
