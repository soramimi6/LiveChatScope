# LiveChatScope — ドキュメント

## 現在地

| 工程 | 状態 |
|------|:----:|
| POC（Phase A + A+） | ✅ 完了 — `master` |
| UX 改修の整理 | ✅ 完了 |
| UX 改修の実装 | 📋 未着手（UX-21 ファイル名のみ完了） |
| Phase B（大規模性能・本番品質） | 📋 未着手 |

**次の作業**: [UX改修.md](UX改修.md) Phase 0（基盤修正）から実装着手。

---

## ドキュメント一覧

| ファイル | 内容 |
|----------|------|
| [概要.md](概要.md) | プロダクト定位・フェーズ・機能要件 |
| [アーキテクチャ.md](アーキテクチャ.md) | 技術構成・分析 Pipeline |
| [UI仕様.md](UI仕様.md) | 画面・コンポーネント |
| [API仕様.md](API仕様.md) | REST API（`/api/v1`） |
| [DBスキーマ.md](DBスキーマ.md) | テーブル・ERD |
| [開発.md](開発.md) | ブランチ戦略・環境構築・運用 |
| [テスト.md](テスト.md) | E2E 手順・性能目標 |
| [UX改修.md](UX改修.md) | 改修 backlog・方針・実施計画 |

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

詳細は [開発.md](開発.md)。
