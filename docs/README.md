# LiveChatScope — ドキュメント

## 現在地

| 工程 | 状態 |
|------|:----:|
| POC（Phase A + A+） | ✅ 完了 — `master` @ `0335f0e` |
| UX 改修の整理 | ✅ 完了 — [UX改修.md](UX改修.md) |
| UX 改修の実装 | 📋 未着手（UX-21 ファイル名のみ完了） |
| Phase B（大規模性能・本番品質） | 📋 未着手 |

**日常作業は `dev` ブランチ。** 引き継ぎ・次タスク: [引き継ぎ.md](引き継ぎ.md) / 実装計画: [UX実施計画.md](UX実施計画.md)

---

## ドキュメント一覧

| ファイル | 内容 |
|----------|------|
| [工程進捗.md](工程進捗.md) | **全体進捗**（POC 完了〜UX 改修フェーズ） |
| [UX実施計画.md](UX実施計画.md) | UX 改修のフェーズ・並行レーン・工数 |
| [引き継ぎ.md](引き継ぎ.md) | 作業引き継ぎ・環境構築 |
| [UX改修.md](UX改修.md) | UI/UX 改修 backlog・方針決定（Q1–Q8） |

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

- Frontend: http://localhost:3000
- API: http://localhost:8000/docs
- E2E: `./scripts/e2e-api.sh "https://www.youtube.com/watch?v=VIDEO_ID"`

詳細は [引き継ぎ.md §7](引き継ぎ.md) および [開発プロセス.md](開発プロセス.md)。
