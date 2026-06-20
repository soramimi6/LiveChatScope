# LiveChatScope — 第一弾チェックリスト

> **第一弾の定義**: Phase A + A+ の **動くプロトタイプ**（仮仕様・仮 UI 可）  
> 完成後: 機能・画面 UI の改善 → 英語対応 → Phase D 検討

## 確定事項（2025-06）

| 項目 | 決定 |
|------|------|
| ターゲット | 個人配信者 |
| 実装 Phase | A + A+ |
| UI 言語 | 日本語のみ（後日 i18n） |
| Backend | FastAPI + Python + chat-downloader |
| Frontend | Next.js |
| DB (MVP) | SQLite |
| 形態素解析 | Janome（精度不足時 SudachiPy 検討） |
| 統合ブランチ | `dev` |
| リリースブランチ | `master`（第一弾完成時に dev からマージ） |
| 設計方針 | 迷ったら盛る → 後で削る |

---

## A. 設計ドキュメント（第一弾）

### 0. 骨格（完了）

- [x] [overview.md](overview.md) — 定位・ターゲット・フェーズ
- [x] [requirements.md](requirements.md) — FR・優先順位・UI タブ案
- [x] [architecture.md](architecture.md) — 取得フロー・分析 Pipeline・**技術選定根拠**・POC 開発環境

### 1. 画面仕様 / ワイヤー — `docs/ui-spec`

- [x] 全タブの画面一覧（サマリー / 話題 / 盛り上がり / 収益 / コミュニティ / 詳細検索）
- [x] URL 入力〜取得進捗〜分析完了フロー
- [x] 各画面の主要コンポーネント・データ表示項目
- [x] ワイヤー（ASCII / Mermaid）
- [x] 仮 UI の注記（後から整える箇所の明示）

### 2. API 詳細仕様 — `docs/api-spec`

- [x] エンドポイント一覧（`/api/v1`）
- [x] リクエスト / レスポンス JSON スキーマ
- [x] ステータスコード・エラー形式
- [x] ジョブ状態遷移（fetch / analysis）
- [x] POC: 認証なし、CORS、別ポート開発

### 3. DB スキーマ詳細 — `docs/db-schema`

- [x] DDL（SQLite）— `backend/db/schema.sql`
- [x] テーブル定義・インデックス・FTS5
- [x] ERD（Mermaid）
- [x] 派生テーブルと Pipeline Stage の対応

### 4. 分析パラメータ — `docs/analysis-params`

- [x] 全パラメータ一覧と既定値（`backend/config/analysis_defaults.json`）
- [x] チューニング方針・配信ジャンル差の注記
- [x] Stage ごとの入出力仕様へのリンク
- [x] ストップワード（`backend/config/stopwords_ja_chat.txt`）

### 5. 開発プロセス — `docs/development-process`

- [x] ブランチ戦略（dev / master）
- [x] 設計シリアル / 実装パラレル
- [x] エージェント引き継ぎ形式
- [x] ワーカー責務・報告ルール（グローバルルール `multi-agent-development.mdc` + 本 doc のプロジェクト固有追記）
- [x] 実装タスク分解の確定（[handoff-current-state.md](handoff-current-state.md) §3 参照）

### 6. テスト / 受入基準 — `docs/test-acceptance`

- [x] Phase A 受入テスト項目
- [x] Phase A+ 受入テスト項目
- [x] 性能目標（10 万コメント）の検証方法
- [x] 手動テスト用サンプル URL 方針
- [x] E2E シナリオ・第一弾完成定義

---

## B. 実装（第一弾プロトタイプ）

設計 D-1〜D-6 完了後に着手。

### Backend

- [x] プロジェクト雛形（FastAPI + chat-downloader）
- [x] Fetch Worker（messages 保存）
- [x] Analysis Pipeline Stage 0–1, 3（Phase A）
- [x] Analysis Pipeline Stage 2, 4–8（Phase A+）
- [x] REST API（残エンドポイント — analysis / messages / export）

### Frontend

- [x] Next.js 雛形・ルーティング（shadcn/ui）
- [x] URL 入力・進捗表示
- [x] サマリータブ（mock fallback 対応。W4 マージ後に本番 API 自動切替）
- [x] 話題分析タブ（キーワードヒートマップは第二優先・未実装）
- [x] 盛り上がりタブ
- [x] 収益タブ
- [x] コミュニティタブ
- [x] 詳細検索タブ
- [x] エクスポート UI（ExportMenu）

### 統合

- [ ] E2E: URL 入力 → 分析 → 各タブ表示 → ジャンプ URL 動作
  - スモーク API テスト: ✅ PASS（`test_e2e_smoke.py`）
  - フルフロー: ❌ FAIL — `LMXjIpjlCac` で chat-downloader 取得失敗（[handoff-current-state.md §6](handoff-current-state.md)）
  - 手動 E2E-01: 未実施（取得可能 URL 要）
- [ ] 10 万コメント級の動作確認
- [ ] `dev` → `master` マージ（第一弾完成）

---

## C. 第一弾完成後（スコープ外）

- [ ] UI / UX の本格改善
- [ ] 英語対応（i18n）
- [ ] Phase B（中断再開・本番品質）
- [ ] Phase D（公開サービス）

---

## 進捗サマリー

| 区分 | 完了 | 合計 | 備考 |
|------|:----:|:----:|------|
| 設計 0（骨格） | 3 | 3 | |
| 設計 1–6 | 6 | 6 | |
| Backend 実装 | 5 | 5 | W1–W4 + W3 |
| Frontend 実装 | 9 | 9 | W5 + 全タブ + Export |
| 統合・リリース | 0 | 3 | E2E / 性能 / master |

**次**: E2E 完走 → 性能 → 第一弾完成。詳細は [handoff-current-state.md](handoff-current-state.md)
