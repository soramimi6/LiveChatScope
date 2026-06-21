# LiveChatScope — ドキュメント

## 現在地（2026-06-21）

| 工程 | 状態 |
|------|:----:|
| POC（Phase A + A+） | ✅ 完了 — `master` @ `0335f0e` |
| UX 改修 Phase 0〜3 | ✅ 実装済 — **PR #6〜#12 マージ待ち** |
| **次工程** | **Phase 4 差別化 Must**（D2 → B1 → C1） |
| Phase B（50k+ 性能） | 📋 未着手 |

**入口**: 進捗・次タスク → [工程進捗.md](工程進捗.md) / 実装詳細 → [UX実施計画.md](UX実施計画.md) / 環境・PR 一覧 → [引き継ぎ.md](引き継ぎ.md)

日常作業ブランチ: **`dev`**（UX 改修 PR は `cursor/*-10cc` 系列を #6 から順にマージ）

---

## ドキュメント一覧

| ファイル | 内容 |
|----------|------|
| **[工程進捗.md](工程進捗.md)** | 全体進捗・完了整理・**Phase 4 作業予定** |
| [UX実施計画.md](UX実施計画.md) | フェーズ定義・項目別タスク・既知バグ |
| [UX改修.md](UX改修.md) | backlog 索引・方針 Q1–Q8・未解消ギャップ |
| [引き継ぎ.md](引き継ぎ.md) | 環境構築・PR スタック・コード構成 |

設計・仕様: [概要.md](概要.md) / [要件.md](要件.md) / [API仕様.md](API仕様.md) / [UI仕様.md](UI仕様.md) / [DBスキーマ.md](DBスキーマ.md)

---

## クイックスタート

```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# Frontend（別ターミナル）
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

- Frontend: http://localhost:3000 / API: http://localhost:8000/docs
- E2E: `./scripts/e2e-api.sh "https://www.youtube.com/watch?v=VIDEO_ID"`

詳細: [引き継ぎ.md §7](引き継ぎ.md)
