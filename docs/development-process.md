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
- 各エージェント完了時: マネージャーがレビュー → `dev` へマージ → 次タスク起票

## エージェントへの引き継ぎ形式

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
| 2 | D-2 | `docs/api-spec` | [api-spec.md](api-spec.md) | ⬜ 未着手 |
| 3 | D-3 | `docs/db-schema` | [db-schema.md](db-schema.md) | ⬜ 未着手 |
| 4 | D-4 | `docs/analysis-params` | [analysis-params.md](analysis-params.md) | ⬜ 未着手 |
| 5 | D-5 | `docs/development-process` | 本ドキュメント + [phase-1-checklist.md](phase-1-checklist.md) | 🔄 進行中 |
| 6 | D-6 | `docs/test-acceptance` | [test-acceptance.md](test-acceptance.md) | ⬜ 未着手 |

詳細チェックリスト: [phase-1-checklist.md](phase-1-checklist.md)

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

マネージャーは依存関係を見て **同時起動可能なタスクを束ねて** エージェントに割り当てる。

## マネージャーの責務

1. タスク分解・ブランチ起票・エージェント割当
2. 着手前の **ユーザー確認事項の洗い出しと質問**
3. マージレビュー・`dev` 統合
4. [phase-1-checklist.md](phase-1-checklist.md) の更新
5. 第一弾完成判定 → `dev` → `master` マージ

## ユーザー確認が必須なタイミング

- 新タスク着手前（仕様の曖昧さ・トレードオフ）
- 削除・縮小提案時（「盛る」方針から外れる場合）
- 外部依存（YouTube 仕様・ライブラリ選定の変更）
- セキュリティ・公開範囲に関わる決定
