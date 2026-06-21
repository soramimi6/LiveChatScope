# LiveChatScope — 作業引き継ぎ（現在地スナップショット）

> **更新日**: 2026-06-21  
> **目的**: 別 PC へ移行して開発を継続するための状態記録  
> **統合ブランチ**: `dev`（`origin/dev` と同期済み想定）

---

## 1. リポジトリ

| 項目 | 値 |
|------|-----|
| GitHub | https://github.com/soramimi6/LiveChatScope |
| 作業ディレクトリ（旧 PC） | `c:\Users\soram\OneDrive\Documents\LiveChatScope` |
| 統合ブランチ | `dev` |
| リリースブランチ | `master`（第一弾完成時のみ merge） |
| 最新 `dev` commit | `759b950` — test: extend E2E-01, fix markdown export API, add perf tests |

### 別 PC での開始手順

```powershell
git clone https://github.com/soramimi6/LiveChatScope.git
cd LiveChatScope
git checkout dev
git pull origin dev
```

---

## 2. 第一弾の位置づけ

| 項目 | 状態 |
|------|------|
| 目標 | Phase A + A+ の **動くプロトタイプ** |
| 設計ドキュメント | **完了**（D-0〜D-6） |
| Backend 実装 | **完了**（W1〜W4, W3 Pipeline A+） |
| Frontend 実装 | **完了**（W5, W-F1/W6, W7〜W11, W12 ExportMenu） |
| E2E 統合 | **完了**（スモーク + フルフロー PASS — §6） |
| 性能テスト | **2k 規模 PASS**（P-02〜P-05）。50k+ P-01 は Phase B |
| `dev` → `master` | **ready**（マージ待ち） |

---

## 3. 実装タスク完了一覧

| ID | ブランチ | 内容 | dev マージ |
|:--:|----------|------|:----------:|
| W1 | `feat/backend-fetch` | Fetch Worker + messages 保存 | ✅ |
| W2 | `feat/backend-pipeline-basic` | Pipeline Stage 0–1, 3 | ✅ |
| W3 | `feat/backend-pipeline-advanced` | Pipeline Stage 2, 4–8 → `complete` | ✅ |
| W4 | `feat/backend-api` | REST API 全エンドポイント | ✅ |
| W5 | `feat/frontend-shell` | Next.js シェル・ルーティング | ✅ |
| W-F1 / W6 | `feat/frontend-foundation-summary` | サマリータブ + 共有 UI + mock | ✅ |
| W7 | `feat/frontend-topics` | 話題分析タブ | ✅ |
| W8 | `feat/frontend-highlights` | 盛り上がりタブ | ✅ |
| W9 | `feat/frontend-revenue` | 収益タブ | ✅ |
| W10 | `feat/frontend-community` | コミュニティタブ | ✅ |
| W11 | `feat/frontend-search` | 詳細検索タブ | ✅ |
| W12 | `feat/frontend-export` | ExportMenu | ✅ |
| E2E | `feat/e2e-api-tests` | pytest スモーク + フロー + runbook | ✅ |

ローカルに残る作業ブランチ（マージ済み・削除任意）: 上表の `feat/*` 一式。

---

## 4. コード構成（実装後）

### Backend（`backend/`）

```
app/
  main.py              # FastAPI + CORS + lifespan DB init
  api/
    videos.py          # POST/GET videos, status
    analysis.py        # summary, density, highlights, topics, ...
    messages_api.py    # GET /messages（FTS5）
    export.py          # GET /export/{type}
    common.py          # jump_url, time_text, 409 制御
  services/
    fetch_worker.py    # chat-downloader 取得
    analysis/          # pipeline.py, stage0–8, params.py, utils.py
db/schema.sql
config/analysis_defaults.json
tests/                 # test_e2e_smoke.py, test_e2e_flow.py, conftest.py
```

### Frontend（`frontend/`）

```
app/                   # /, /analyze/[id], /videos/[id]
components/
  tabs/                # summary, topics, highlights, revenue, community, search
  export-menu.tsx
  jump-link-button.tsx, kpi-card.tsx, topic-timeline-bar.tsx, ...
lib/
  api.ts               # コア API（videos, summary）
  api/highlights.ts, revenue.ts, community.ts, search.ts, export.ts
  mocks/               # summary, topics, highlights, revenue, ...
```

---

## 5. 開発プロセス（現在の運用）

| 項目 | 方針 |
|------|------|
| タスク実行 | **Cursor メインチャット → Task サブエージェント**（手動別 Agent 起動は廃止） |
| グローバルルール | `~/.cursor/rules/multi-agent-development.mdc` |
| プロジェクト手順 | [development-process.md](development-process.md) |
| マージ | サブエージェントは commit のみ。マネージャーが `dev` に merge |

---

## 6. E2E・性能テスト結果（2026-06-21）

### 6.1 自動テスト

| テスト | URL | 結果 |
|--------|-----|------|
| `test_e2e_smoke.py`（2件） | — | ✅ PASS |
| `test_e2e_flow.py`（フルフロー） | `8ZaCtuVdWYc` | ✅ PASS |
| `test_perf_api.py`（P-02〜P-06） | `8ZaCtuVdWYc` | ✅ PASS（2k 規模） |

**実行コマンド**:

```powershell
cd LiveChatScope
.\scripts\e2e-api.ps1 -Url "https://www.youtube.com/watch?v=8ZaCtuVdWYc"
```

```bash
cd LiveChatScope
./scripts/e2e-api.sh "https://www.youtube.com/watch?v=8ZaCtuVdWYc"
```

**フルフロー結果**（`8ZaCtuVdWYc`）:

- ~1,960 messages 取得・分析完了（`analysis_status=complete`）
- 分析 API（summary / density / highlights / topics / revenue / community / search）検証 PASS
- JSON / CSV / Markdown エクスポート検証 PASS

**性能結果**（2k msg 規模、`test_perf_api.py`）:

| ID | 結果 |
|----|------|
| P-01 全パイプライン | ~15s |
| P-02 サマリー API | 0.003s |
| P-03 密度 API | 0.003s |
| P-04 メッセージ検索 | 0.015s |
| P-05 サマリータブ初期表示 | API 応答内で検証（PASS） |
| P-06 DB サイズ | 1.66 MB |

**修正済み**: 負タイムスタンプ問題、`chat-downloader` は [Indigo128 fork](https://github.com/Indigo128/chat-downloader) に固定。

### 6.2 手動 E2E

- [e2e-runbook.md](e2e-runbook.md) — E2E-01 の 8 ステップチェックリスト
- **API 自動テストで代替検証済み**（`test_e2e_flow.py` が E2E-01 主要路径をカバー）

### 6.3 未実施（Phase B へ）

1. **50k+ msg 規模の P-01** — 10 万コメント級の性能目標（[test-acceptance.md §6](test-acceptance.md)）
2. 手動ブラウザ E2E-01（任意・UI 確認用）

---

## 7. 開発環境（旧 PC で構築済み）

### 7.1 必要ソフト

| ソフト | バージョン（旧 PC） | 備考 |
|--------|---------------------|------|
| Python | 3.12.10 | `C:\Users\soram\AppData\Local\Programs\Python\Python312\python.exe` |
| Node.js | v24.14.0 | |
| Git / gh | 利用可（`soramimi6`） | |

**注意**: Windows Store の `python` スタブのみだと動かない。別 PC では Python 3.11+ を PATH 通しでインストールすること。

### 7.2 Backend セットアップ

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r requirements-dev.txt   # pytest, httpx（E2E 用）
uvicorn app.main:app --reload --port 8000
```

- DB: `data/livechatscope.db`（gitignore。初回起動で自動作成）
- エクスポート: `data/exports/{video_id}/`（Stage 8）

### 7.3 Frontend セットアップ

```powershell
cd frontend
copy .env.example .env.local    # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm install
npm run dev
```

- http://localhost:3000
- `npm run build` — 旧 PC で成功確認済み

### 7.4 `.venv` / `node_modules`

**git に含まれない**。別 PC では上記コマンドで再生成。

---

## 8. 既知の制限・未実装

| 項目 | 状態 |
|------|------|
| 話題タブ: キーワード時間帯ヒートマップ | 第二優先・**未実装** |
| chat-downloader | [Indigo128 fork](https://github.com/Indigo128/chat-downloader) 固定。YouTube 仕様変更で取得失敗しうる（[test-acceptance §8](test-acceptance.md)） |
| 50k+ 性能検証 | **未実施** — P-01 は ~2k msg で ~15s のみ確認。10 万コメント級は Phase B |
| 認証・本番デプロイ | POC スコープ外 |
| 英語 UI | 第一弾対象外 |

---

## 9. 主要ドキュメント索引

| ファイル | 用途 |
|----------|------|
| [phase-1-checklist.md](phase-1-checklist.md) | 進捗チェックリスト |
| [development-process.md](development-process.md) | ブランチ・Task 割当 |
| [test-acceptance.md](test-acceptance.md) | 受入基準・第一弾完成定義 |
| [e2e-runbook.md](e2e-runbook.md) | E2E-01 手動手順 |
| [architecture.md](architecture.md) | Pipeline Stage 0–8 |
| [api-spec.md](api-spec.md) | REST API |
| [ui-spec.md](ui-spec.md) | 全タブ UI |

---

## 10. 別 PC 移行チェックリスト

- [ ] `git clone` + `git checkout dev` + `git pull`
- [ ] Python 3.11+ インストール（PATH 確認: `python --version`）
- [ ] Node.js インストール
- [ ] `backend/.venv` 作成 + `pip install -r requirements.txt -r requirements-dev.txt`
- [ ] `frontend/npm install` + `.env.local`
- [ ] Cursor グローバルルール `multi-agent-development.mdc` を同期（Cursor 設定 or 手動コピー）
- [ ] Backend / Frontend 起動確認
- [x] E2E 自動テスト PASS（`8ZaCtuVdWYc` — `./scripts/e2e-api.sh` または `e2e-api.ps1`）
- [x] 性能テスト PASS（2k 規模 — `test_perf_api.py`）
- [ ] `dev` → `master` マージ（第一弾完成）
- [ ] 本ファイルを読んで「§11」から Phase B へ

---

## 11. 推奨次タスク（第一弾完成後 → Phase B）

1. **`dev` → `master` マージ** — 第一弾完成リリース
2. **50k+ 性能テスト** — 5万〜10万コメント配信で P-01 検証（test-acceptance §6）
3. **chat-downloader 監視** — Indigo128 fork の upstream 追従・取得失敗時のフォールバック
4. **Phase B 着手** — 中断再開・本番品質（[overview.md](overview.md)）
5. **任意**: 話題タブヒートマップ、UI polish、手動ブラウザ E2E-01

---

## 12. 連絡・判断メモ

- ユーザー確認: 仕様トレードオフはマネージャーがエスカレーション
- W4 確定方針: 分析未完了 → 409 `ANALYSIS_NOT_READY`；messages は fetch 完了後 200
- 第一弾 UI: 日本語のみ、ダーク基調、mock fallback あり（API 未接続時も画面表示可）
