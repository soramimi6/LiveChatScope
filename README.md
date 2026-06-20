# LiveChatScope

YouTube ライブ配信のチャットリプレイを取得・分析し、配信後の振り返りと任意時刻へのジャンプを支援する Web ツール。

## 概要

- **対象**: ライブチャット（コメント欄ではない）
- **主ターゲット**: 個人配信者（配信後の改善・スパチャお礼・切り抜き候補）
- **主用途**: 配信終了後、URL からチャットリプレイを取得し、話題俯瞰・盛り上がり分析（Phase A / A+）
- **将来**: 安定稼働後に公開サービスを検討（Phase D）

## 主な機能（予定）

1. URL 入力によるチャットリプレイ取得
2. 検索・フィルタ・時系列分析
3. コメント密度・スパイク検出・投稿者ランキング等
4. `watch?v=...&t=...s` 形式での任意時刻ジャンプリンク生成
5. JSON / CSV エクスポート

## ドキュメント

| ファイル | 内容 |
|----------|------|
| [docs/overview.md](docs/overview.md) | プロダクト概要・フェーズ |
| [docs/requirements.md](docs/requirements.md) | 要件定義 |
| [docs/architecture.md](docs/architecture.md) | 技術アーキテクチャ・分析 Pipeline |
| [docs/development-process.md](docs/development-process.md) | 開発プロセス・ブランチ戦略 |
| [docs/ui-spec.md](docs/ui-spec.md) | 画面仕様・UI 設計 |
| [docs/api-spec.md](docs/api-spec.md) | API 詳細仕様（`/api/v1`） |
| [docs/db-schema.md](docs/db-schema.md) | DB スキーマ・DDL |
| [docs/analysis-params.md](docs/analysis-params.md) | 分析パラメータ既定値 |
| [docs/test-acceptance.md](docs/test-acceptance.md) | テスト / 受入基準 |
| [docs/phase-1-checklist.md](docs/phase-1-checklist.md) | 第一弾チェックリスト |

## 開発

| ブランチ | 用途 |
|----------|------|
| `master` | 第一弾完成版 |
| `dev` | 日常の統合ブランチ |

### AI エージェントとのやり取り

**原則 caveman モード（コンテキスト圧縮）** で進める。

| 項目 | 方針 |
|------|------|
| 文体 | 短文・箇条書き・結論先出し |
| 説明 | 必要最小限。冗長な前置き・総括・丁寧語の繰り返しは避ける |
| 報告 | 変更点・結果・次アクションのみ |
| 質問 | 選択肢付きで簡潔に |
| 例外 | 設計判断・トレードオフ・ユーザー確認が必要な論点は、要点を残して詳述可 |

実装・レビュー・タスク引き継ぎすべて、この方針を徹底する。

### クイックスタート（POC）

```powershell
# Backend（Python 3.11+ 要インストール）
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend（別ターミナル）
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:8000/docs

## ステータス

🚧 **実装中** — W2 Pipeline / W-F1 サマリー UI / W5 シェル完了（`dev`）。W4 API 実行中
