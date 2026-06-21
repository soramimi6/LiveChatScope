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
- Health: http://localhost:8000/health（API サーバー生死のみ。chat-downloader の死活は下記手動チェック）

## chat-downloader 監視（v1）

非公式取得依存のため、**バージョン固定**と**手動の軽量チェック**で運用する。

| 項目 | 値 |
|------|-----|
| fork | [Indigo128/chat-downloader](https://github.com/Indigo128/chat-downloader) |
| pin commit | `aed69e336fed4f587d7d0dea90a0b3c4732dd776`（`requirements.txt` と `app/monitor_config.py`） |
| 固定テスト動画 | https://www.youtube.com/watch?v=HFRMcvNxyH0 |
| 合格条件 | 固定動画から **1 件以上**メッセージが読める |
| タイムアウト | **60 秒**（`MONITOR_CHECK_TIMEOUT_SEC`） |

### いつ実行するか

- **リリース前**
- **`chat-downloader` の pin を更新した直後**
- **YouTube 取得が突然失敗する**と疑われるとき

### 手動チェック（軽量）

DB / API は使わず、`ChatDownloader.get_chat` で固定動画から 1 件読む。

```powershell
cd backend
$env:PYTHONPATH = "."
python -c @"
import time
from chat_downloader import ChatDownloader
from app.monitor_config import MONITOR_CHECK_TIMEOUT_SEC, MONITOR_TEST_VIDEO_URL
from app.services.chat_message_types import CHAT_MESSAGE_GROUPS

start = time.monotonic()
chat = ChatDownloader().get_chat(MONITOR_TEST_VIDEO_URL, message_groups=CHAT_MESSAGE_GROUPS)
for item in chat:
    elapsed = time.monotonic() - start
    if elapsed > MONITOR_CHECK_TIMEOUT_SEC:
        raise SystemExit(f'FAIL: timeout after {elapsed:.1f}s')
    print(f'OK: message_id={item.get(\"message_id\")} elapsed={elapsed:.1f}s')
    break
else:
    raise SystemExit('FAIL: no messages')
"@
```

Linux/macOS:

```bash
cd backend
PYTHONPATH=. python -c "
import time
from chat_downloader import ChatDownloader
from app.monitor_config import MONITOR_CHECK_TIMEOUT_SEC, MONITOR_TEST_VIDEO_URL
from app.services.chat_message_types import CHAT_MESSAGE_GROUPS

start = time.monotonic()
chat = ChatDownloader().get_chat(MONITOR_TEST_VIDEO_URL, message_groups=CHAT_MESSAGE_GROUPS)
for item in chat:
    elapsed = time.monotonic() - start
    if elapsed > MONITOR_CHECK_TIMEOUT_SEC:
        raise SystemExit(f'FAIL: timeout after {elapsed:.1f}s')
    print(f'OK: message_id={item.get(\"message_id\")} elapsed={elapsed:.1f}s')
    break
else:
    raise SystemExit('FAIL: no messages')
"
```

成功時: `OK: message_id=... elapsed=...s` が表示される。  
失敗時: 非ゼロ終了。ログを残し、必要なら GitHub Issue を手動で起票する。

### 失敗時（Issue 手動起票）

```powershell
gh issue create --title "chat-downloader 監視チェック失敗" --body @"
固定動画: https://www.youtube.com/watch?v=HFRMcvNxyH0
pin: aed69e336fed4f587d7d0dea90a0b3c4732dd776
手順: backend/README.md chat-downloader 監視
エラー: （ここに python -c の出力を貼る）
"@
```

### pin の更新手順

1. [Indigo128/chat-downloader](https://github.com/Indigo128/chat-downloader) の変更を確認
2. `requirements.txt` の commit hash を更新
3. `app/monitor_config.py` の `CHAT_DOWNLOADER_PINNED_COMMIT` を同じ hash に更新
4. `pip install -r requirements.txt`
5. 上記 **手動チェック** を実行
6. 取得・正規化の挙動が変わった場合は `FETCH_SPEC_VERSION` を bump（`.cursor/rules/fetch-spec-reset.mdc`）

## 実装済み（W1）

- SQLite 初期化（`backend/db/schema.sql`）
- `POST /api/v1/videos` — URL から取得ジョブ開始
- `GET /api/v1/videos/{id}/status` — 進捗
- `GET /api/v1/videos/{id}` — メタ情報
- chat-downloader によるリプレイ取得（バックグラウンド）

## 未実装（後続タスク）

- Analysis Pipeline Stage 0–8
- 残り REST エンドポイント
