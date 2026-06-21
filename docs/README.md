# LiveChatScope — ドキュメント

## 現在地

| 工程 | 状態 |
|------|:----:|
| POC（Phase A + A+） | ✅ 完了 — `master` @ `0335f0e` |
| UX 改修の整理 | ✅ 完了 — [UX改修.md](UX改修.md) |
| UX 改修の実装 | 📋 未着手（UX-21 ファイル名のみ完了） |
| Phase B（大規模性能・本番品質） | 📋 未着手 |

**日常作業は `dev` ブランチ。** 引き継ぎ・次タスク: [引き継ぎ.md](引き継ぎ.md)

---

## ドキュメント一覧

| ファイル | 内容 |
|----------|------|
| [概要.md](概要.md) | プロダクト定位・フェーズ |
| [要件.md](要件.md) | 機能要件・優先順位 |
| [アーキテクチャ.md](アーキテクチャ.md) | 技術構成・分析 Pipeline |
| [UI仕様.md](UI仕様.md) | 画面・コンポーネント |
| [API仕様.md](API仕様.md) | REST API（`/api/v1`） |
| [DBスキーマ.md](DBスキーマ.md) | テーブル・ERD |
| [分析パラメータ.md](分析パラメータ.md) | Pipeline 既定値 |
| [開発プロセス.md](開発プロセス.md) | ブランチ戦略・Task 割当 |
| [第一弾チェックリスト.md](第一弾チェックリスト.md) | 第一弾進捗 |
| [テスト受入.md](テスト受入.md) | 受入基準・性能目標 |
| [E2E手順.md](E2E手順.md) | 手動 E2E チェックリスト |
| [引き継ぎ.md](引き継ぎ.md) | **作業引き継ぎ・現在地** |
| [UX改修.md](UX改修.md) | UI/UX 改修 backlog・方針決定 |

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
