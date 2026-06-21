# LiveChatScope

YouTube ライブ配信のチャットリプレイを取得・分析し、配信後の振り返りと任意時刻へのジャンプを支援する Web ツール。

## 概要

- **対象**: ライブチャット（コメント欄ではない）
- **主ターゲット**: 個人配信者（配信後の改善・スーパーチャットお礼・切り抜き候補）
- **主用途**: 配信終了後、URL からチャットリプレイを取得し、話題俯瞰・盛り上がり分析（Phase A / A+）
- **将来**: 安定稼働後に公開サービスを検討（Phase D）

## ドキュメント

**入口**: [docs/README.md](docs/README.md)

| ファイル | 内容 |
|----------|------|
| [docs/概要.md](docs/概要.md) | プロダクト概要・フェーズ・機能要件 |
| [docs/アーキテクチャ.md](docs/アーキテクチャ.md) | 技術構成・分析 Pipeline |
| [docs/UI仕様.md](docs/UI仕様.md) | 画面仕様 |
| [docs/API仕様.md](docs/API仕様.md) | REST API |
| [docs/DBスキーマ.md](docs/DBスキーマ.md) | DB スキーマ |
| [docs/開発.md](docs/開発.md) | 環境構築・ブランチ戦略 |
| [docs/テスト.md](docs/テスト.md) | E2E・性能目標 |
| [docs/UX改修.md](docs/UX改修.md) | 改修 backlog・実施計画 |

## 開発

| ブランチ | 用途 |
|----------|------|
| `master` | リリース相当 |
| `dev` | 日常の統合ブランチ |

### クイックスタート

```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

cd frontend && cp .env.example .env.local && npm install && npm run dev
```

E2E: `./scripts/e2e-api.sh "https://www.youtube.com/watch?v=VIDEO_ID"`

## ステータス

✅ **POC 完了** — Phase A + A+（`master`）。E2E・性能（2k 規模）PASS  
✅ **UX 改修整理完了** — [docs/UX改修.md](docs/UX改修.md)  
→ **次**: UX 改修 Phase 0（基盤修正）

## 既知の制限

| 制限 | 説明 |
|------|------|
| 非公式取得 | [Indigo128/chat-downloader](https://github.com/Indigo128/chat-downloader) fork 固定 |
| 推定話題 | 配信内容とチャット話題は一致しない場合がある |
| 大規模性能 | 50k+ コメント規模は未検証（Phase B） |
| 認証なし POC | 公開ネットワークへの無防備デプロイ不可 |
