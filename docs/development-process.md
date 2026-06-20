# LiveChatScope — 開発プロセス

> マネージャー: メインエージェント（全体統括）  
> 更新: 方針確定後

## 第一弾の目標

**Phase A + Phase A+ の動くプロトタイプ**を、仮仕様・仮 UI で先行完成させる。  
その後、機能・画面 UI を段階的に整える。

| 方針 | 内容 |
|------|------|
| 設計 | 判断に迷ったら **盛る方向** で仮決めし、後から削る |
| 言語 | UI は **日本語のみ**（完成後に英語対応） |
| 実装範囲 | **Phase A + A+**（取得・基本分析・差別化分析・配信者向け出力） |
| 技術 | FastAPI + Python / Next.js / SQLite / Janome |

## ブランチ戦略

```
master   … リリース相当（第一弾完成時に dev からマージ）
  ↑
  dev    … 日常の統合ブランチ（設計・実装のマージ先）
  ↑
  docs/* / feat/* / fix/* … 作業ブランチ
```

| 種別 | 命名 | マージ先 | 進行 |
|------|------|----------|------|
| 設計（実装前） | `docs/<topic>` | `dev` | **シリアル**（1 タスクずつ） |
| 実装 | `feat/<area>-<task>` | `dev` | **パラレル**（独立タスクは並行可） |
| 第一弾完成 | `dev` → `master` | `master` | 一括マージ |

### ルール

- 作業ブランチは **必ず `dev` から切る**
- `master` への直接 push は第一弾完成時のみ
- マージ前: 疑問・要検討・要確認は **作業開始前にユーザーへ全件確認**
- 各サブタスク完了時: マネージャーがレビュー → `dev` へマージ → 次タスク起票

## タスク実行方式（Task サブエージェント）

**基本ルール（全プロジェクト共通）**: Cursor グローバルルール `multi-agent-development.mdc`（`alwaysApply: true`）  
— 役割分担、Task 指示形式、ワーカー責務、結果報告、通信フロー、並列の鉄則

**本プロジェクト固有**（以下）: ブランチ名、リポジトリパス、参照 doc、チェックリスト、ユーザー確認タイミング

| 項目 | LiveChatScope での適用 |
|------|------------------------|
| 統合ブランチ | `dev` |
| リリースブランチ | `master`（第一弾完成時のみ merge） |
| 作業ブランチ | `docs/*` / `feat/*` / `fix/*` |
| リポジトリ | `c:\Users\soram\OneDrive\Documents\LiveChatScope` |
| 進捗 | [phase-1-checklist.md](phase-1-checklist.md) |
| 判断方針 | 迷ったら **盛る** → 後で削る |
| UI 言語 | 日本語のみ |

---

## マネージャーからの指示形式（LiveChatScope 版）

グローバルルールの Task prompt テンプレートに、次の **プロジェクト固定値** を埋める。

```markdown
## タスク: <ID> — <タイトル>

### メタ
- **タスク ID**: W6 / D-3 など（phase-1-checklist と一致）
- **ブランチ**: `dev` から `feat/<area>-<task>` を作成
- **並列**: 単独 | 同時起動可（相手タスク ID: W5, W7）
- **依存**: なし | W4 が `dev` マージ済み

### 成果物
- <ファイルパス>

### 完了条件
- [ ] ui-spec / api-spec 等の **具体名**（コンポーネント・エンドポイント）で記述
- [ ] 検証コマンド成功

### 参照（読む順）
1. docs/ui-spec.md — §...
2. docs/api-spec.md — §...

### スコープ
- **触ってよい**: 例 `frontend/src/app/...`
- **触らない**: 例 `backend/`、他ワーカー担当、`dev` / `master`
- **判断**: 盛る方針で仮決め可

### 検証
- 例: `cd frontend && npm run build`
- 期待: ビルド成功

### 報告
- グローバルルール「ワーカー結果報告形式」に従う
- `dev` への merge / push **禁止**

### リポジトリ
- 絶対パス: c:\Users\soram\OneDrive\Documents\LiveChatScope
```

### 並列起動の例（W7–W11）

Frontend タブは互いにファイルが分離されていれば **1 応答で W7, W8, W9… を並列 Task 起動** 可。  
共通ファイル（ルーティング・レイアウト）を触る場合は **シリアル**。

| 悪い例 | 良い例 |
|--------|--------|
| 「話題タブを実装して」 | 完了条件に ui-spec §3.2 と `GET /api/v1/.../topics` |
| 「必要なら API も直して」 | frontend のみ触可。API 不足は BLOCKED |

## エージェントへの引き継ぎ形式（レガシー・参照用）

旧方式（別 Agent チャット）用。新規タスクでは使用しない。

各タスクは次の 3 点セットで渡す。

```markdown
## タスク: <タイトル>
- **ブランチ**: docs/ui-spec （例）
- **成果物**: docs/ui-spec.md
- **完了条件**:
  - [ ] 条件1
  - [ ] 条件2
- **参照**: docs/requirements.md, docs/architecture.md
- **制約**: 判断に迷ったら盛る / 日本語 UI / ユーザー確認事項があれば着手前に質問
```

## 第一弾：設計ドキュメント（シリアル）

設計は **1 ブランチ・1 エージェント・順番実行**。  
前タスクが `dev` にマージされてから次を開始する。

| 順 | ID | ブランチ | 成果物 | 状態 |
|:--:|----|----------|--------|------|
| 0 | — | — | overview / requirements / architecture | ✅ 完了 |
| 1 | D-1 | `docs/ui-spec` | [ui-spec.md](ui-spec.md) | ✅ 完了 |
| 2 | D-2 | `docs/api-spec` | [api-spec.md](api-spec.md) | ✅ 完了 |
| 3 | D-3 | `docs/db-schema` | [db-schema.md](db-schema.md) | ✅ 完了 |
| 4 | D-4 | `docs/analysis-params` | [analysis-params.md](analysis-params.md) | ✅ 完了 |
| 5 | D-5 | `docs/development-process` | 本ドキュメント + [phase-1-checklist.md](phase-1-checklist.md) | ✅ 完了 |
| 6 | D-6 | `docs/test-acceptance` | [test-acceptance.md](test-acceptance.md) | ✅ 完了 |

詳細チェックリスト: [phase-1-checklist.md](phase-1-checklist.md)  
**別 PC 移行・現在地**: [handoff-current-state.md](handoff-current-state.md)

## 第一弾：実装（パラレル）

設計 D-1〜D-6 完了後、実装タスクを **独立単位で並行** する。

### 想定ワークストリーム（案）

| ストリーム | ブランチ例 | 内容 | 依存 |
|------------|------------|------|------|
| W1 | `feat/backend-fetch` | 取得 Worker + messages 保存 | D-2, D-3 |
| W2 | `feat/backend-pipeline-basic` | Stage 0–1, 3（基本分析） | W1 |
| W3 | `feat/backend-pipeline-advanced` | Stage 2, 4–8（A+ 分析） | W2 |
| W4 | `feat/backend-api` | REST API 全体 | D-2, W2 |
| W5 | `feat/frontend-shell` | Next.js シェル・ルーティング | D-1 |
| W6 | `feat/frontend-summary` | サマリータブ | W4, W5 |
| W7 | `feat/frontend-topics` | 話題分析タブ | W4, W5 |
| W8 | `feat/frontend-highlights` | 盛り上がりタブ | W4, W5 |
| W9 | `feat/frontend-revenue` | 収益タブ | W4, W5 |
| W10 | `feat/frontend-community` | コミュニティタブ | W4, W5 |
| W11 | `feat/frontend-search` | 詳細検索タブ | W4, W5 |
| W12 | `feat/export` | エクスポート | W3, W4 |

マネージャーは依存関係を見て **同時起動可能なタスクを Task で束ねて** サブエージェントに割り当てる。

## マネージャーの責務（LiveChatScope）

共通手順はグローバルルール `multi-agent-development.mdc` に従う。本プロジェクトで追加する点:

1. **計画**: [phase-1-checklist.md](phase-1-checklist.md) のタスク ID（W1–W12, D-1–D-6）と整合
2. **割当**: 上記 [LiveChatScope 版指示形式](#マネージャーからの指示形式livechatscope-版) で Task 起動
3. **統合**: レビュー後 `dev` へ merge（`master` は第一弾完成時のみ）
4. **記録**: phase-1-checklist 更新 → 第一弾完成判定

## ユーザー確認が必須なタイミング

- 新タスク着手前（仕様の曖昧さ・トレードオフ）
- 削除・縮小提案時（「盛る」方針から外れる場合）
- 外部依存（YouTube 仕様・ライブラリ選定の変更）
- セキュリティ・公開範囲に関わる決定
