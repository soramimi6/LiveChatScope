# LiveChatScope Frontend

Next.js App Router + shadcn/ui + Tailwind CSS

## セットアップ

```powershell
cd frontend
copy .env.example .env.local
npm install
```

## 開発

```powershell
npm run dev
```

http://localhost:3000 （API は http://localhost:8000 が必要）

## ルート

| パス | 画面 |
|------|------|
| `/` | URL 入力 |
| `/analyze/[videoId]` | 取得進捗 |
| `/videos/[videoId]?tab=` | ダッシュボード（6 タブ・プレースホルダ） |

## 実装済み（W5）

- shadcn/ui（Button, Input, Card, Tabs, Progress, Alert 等）
- API クライアント（`lib/api.ts`）
- ダークテーマ（日本語 UI）

## 未実装（W6–W11）

- 各タブのデータ表示・グラフ（Recharts）
