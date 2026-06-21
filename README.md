# LiveChatScope

YouTube ライブ配信のチャットリプレイを取得・分析し、配信後の振り返りと任意時刻へのジャンプを支援する Web ツール。

## ステータス

| ブランチ | 内容 |
|----------|------|
| `master` @ `0335f0e` | 第一弾（Phase A + A+） |
| `dev` @ `0c862db` | Phase 0〜4 統合済。第二弾リリース待ち（[PR #17](https://github.com/soramimi6/LiveChatScope/pull/17)） |

**次**: PR #17 マージ → Phase 5 / Phase B

## クイックスタート

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

cd frontend
copy .env.example .env.local
npm install
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:8000/docs

詳細: [docs/進捗.md](docs/進捗.md)

## ドキュメント

**入口**: [docs/README.md](docs/README.md)

| 種別 | ファイル |
|------|----------|
| 進捗・環境 | [docs/進捗.md](docs/進捗.md) |
| 設計 | [概要](docs/概要.md) / [要件](docs/要件.md) / [アーキテクチャ](docs/アーキテクチャ.md) |
| 仕様 | [API](docs/API仕様.md) / [UI](docs/UI仕様.md) / [DB](docs/DBスキーマ.md) / [分析パラメータ](docs/分析パラメータ.md) |
| テスト | [テスト受入](docs/テスト受入.md) |

## 開発

| ブランチ | 用途 |
|----------|------|
| `master` | リリース |
| `dev` | 日常統合 |

Task サブエージェント + Cursor グローバルルール `multi-agent-development.mdc`。詳細: [docs/進捗.md §4](docs/進捗.md)

## 既知の制限

- [Indigo128/chat-downloader](https://github.com/Indigo128/chat-downloader) fork 固定 — YouTube 仕様変更リスク
- 推定話題は配信内容と一致しない場合あり
- 50k+ 性能未検証（2k のみ PASS）
- 認証なし POC / 日本語 UI のみ
