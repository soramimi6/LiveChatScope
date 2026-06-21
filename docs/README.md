# LiveChatScope — ドキュメント

## 入口

| 読むもの | いつ |
|----------|------|
| **[進捗.md](進捗.md)** | 現在地・環境構築・テスト・backlog |
| [概要.md](概要.md) | プロダクトの目的・フェーズ |
| [要件.md](要件.md) | 機能要件 |

## 設計仕様

| ファイル | 内容 |
|----------|------|
| [アーキテクチャ.md](アーキテクチャ.md) | 取得フロー・Pipeline |
| [API仕様.md](API仕様.md) | REST API |
| [UI仕様.md](UI仕様.md) | 画面・コンポーネント |
| [DBスキーマ.md](DBスキーマ.md) | テーブル・DDL |
| [分析パラメータ.md](分析パラメータ.md) | 既定値 |
| [テスト受入.md](テスト受入.md) | 受入基準・E2E・性能 |

## クイックスタート

```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

cd frontend && cp .env.example .env.local && npm install && npm run dev
```

詳細: [進捗.md §3](進捗.md)

## 運用ルール

- docs は **この 9 ファイル構成を維持**。新規ファイル追加はユーザー確認後のみ
- 完了した改修メモ・PR 履歴は **git 履歴に任せ、docs に残さない**
