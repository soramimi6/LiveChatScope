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
| [docs/概要.md](docs/概要.md) | プロダクト概要・フェーズ |
| [docs/要件定義.md](docs/要件定義.md) | 要件定義 |
| [docs/アーキテクチャ.md](docs/アーキテクチャ.md) | 技術アーキテクチャ・分析 Pipeline |
| [docs/開発プロセス.md](docs/開発プロセス.md) | 開発プロセス・ブランチ戦略 |
| [docs/UI仕様.md](docs/UI仕様.md) | 画面仕様・UI 設計 |
| [docs/API仕様.md](docs/API仕様.md) | API 詳細仕様（`/api/v1`） |
| [docs/DBスキーマ.md](docs/DBスキーマ.md) | DB スキーマ・DDL |
| [docs/分析パラメータ.md](docs/分析パラメータ.md) | 分析パラメータ既定値 |
| [docs/テスト受入基準.md](docs/テスト受入基準.md) | テスト / 受入基準 |
| [docs/第一弾チェックリスト.md](docs/第一弾チェックリスト.md) | 第一弾チェックリスト |
| [docs/引き継ぎ現状.md](docs/引き継ぎ現状.md) | **作業引き継ぎ・現在地**（別 PC 移行用） |
| [docs/E2E手順書.md](docs/E2E手順書.md) | E2E 手動テスト手順 |
| [docs/工程進捗.md](docs/工程進捗.md) | **全体進捗・完了整理・次工程** |
| [docs/UX改修メモ.md](docs/UX改修メモ.md) | UI/UX 改修 backlog（方針 Q1〜Q8） |
| [docs/UX実施計画.md](docs/UX実施計画.md) | 改修の実施計画（フェーズ・並行レーン） |

## 開発

| ブランチ | 用途 |
|----------|------|
| `master` | 第一弾完成版 |
| `dev` | 日常の統合ブランチ |

### AI エージェントとのやり取り

**原則 caveman モード（コンテキスト圧縮）** で進める。  
実装タスクは **メインチャットが Task サブエージェントで実行**（別 Agent の手動起動・コピペ不要）。

| レイヤ | 内容 |
|--------|------|
| **グローバル** | Cursor ルール `multi-agent-development.mdc` — マネージャー/ワーカー基本ルール（全プロジェクト） |
| **プロジェクト** | [開発プロセス.md](docs/開発プロセス.md) — ブランチ・タスク ID・LiveChatScope 固有の指示例 |

| 項目 | 方針 |
|------|------|
| 文体 | 短文・箇条書き・結論先出し |
| 説明 | 必要最小限。冗長な前置き・総括・丁寧語の繰り返しは避ける |
| 報告 | 変更点・結果・次アクションのみ |
| 質問 | 選択肢付きで簡潔に |
| 例外 | 設計判断・トレードオフ・ユーザー確認が必要な論点は、要点を残して詳述可 |

実装・レビュー・タスク引き継ぎすべて、この方針を徹底する。

### クイックスタート（POC）

> 詳細・別 PC セットアップ: [引き継ぎ現状.md](docs/引き継ぎ現状.md) §7

```powershell
# Backend（Python 3.11+ — Windows Store スタブ不可）
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# Frontend（別ターミナル）
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Linux / macOS では `source backend/.venv/bin/activate` で venv を有効化。E2E: `./scripts/e2e-api.sh "https://www.youtube.com/watch?v=VIDEO_ID"`

- Frontend: http://localhost:3000
- API: http://localhost:8000/docs

## ステータス

✅ **第一弾完成** — Phase A + A+ プロトタイプ（`master` @ `25b2d20`）。E2E PASS（`8ZaCtuVdWYc`）、性能 P-02〜P-05 PASS（2k 規模）  
✅ **POC 改善案整理完了** — UX改修メモ・実施計画・工程進捗  
→ **次**: UX 改修 Phase 0（基盤修正）。詳細: [docs/工程進捗.md](docs/工程進捗.md)

## 既知の制限

| 制限 | 説明 |
|------|------|
| 非公式取得 | [Indigo128/chat-downloader](https://github.com/Indigo128/chat-downloader) fork 固定。YouTube 仕様変更で突然動作しなくなる可能性 |
| 推定話題 | 配信内容とチャット話題は一致しない場合がある |
| 認証なし POC | 公開ネットワークへの無防備デプロイ不可 |
| スマホ | 閲覧程度。最適化なし |
| 英語 UI | 第一弾対象外 |
| Analytics | 同時視聴者数等は提供しない |
| 大規模性能 | 50k+ コメント規模の P-01（全パイプライン ≤30 分）は未検証。Phase B で実施 |

（[テスト受入基準.md §8](docs/テスト受入基準.md) 要約 + fork 固定・性能未検証）

