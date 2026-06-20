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

## ステータス

✅ **設計フェーズ完了** — 実装フェーズ（Phase A + A+ プロトタイプ）へ
