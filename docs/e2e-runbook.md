# LiveChatScope — E2E 手動テスト Runbook

> 参照: [test-acceptance.md](test-acceptance.md) §5 E2E-01

## 前提

| 項目 | 値 |
|------|-----|
| Backend | `http://localhost:8000` |
| Frontend | `http://localhost:3000` |
| ブラウザ | Chrome または Edge（最新） |
| 画面幅 | 1280px 以上 |

サンプル URL はリポジトリに固定しない。テスト実行者が [test-acceptance.md §7](test-acceptance.md) の基準で都度選定する。

---

## E2E-01: 標準フロー（Must）

**合格条件**: 以下 8 ステップすべて成功。

- [ ] **1. トップで YouTube URL 入力** — 有効な watch URL を入力し「分析開始」をクリック。進捗画面へ遷移すること。
- [ ] **2. 進捗画面で取得・分析完了を待つ** — `fetch_status=fetched` かつ `analysis_status=complete`（または基本タブが利用可能な `partial` 以上）になるまで待機。エラー表示がないこと。
- [ ] **3. サマリータブ: KPI・話題 preview を確認** — メッセージ数・投稿者数・ピーク等の KPI が表示され、話題 preview（A+ 完了時）または Empty 状態が妥当であること。
- [ ] **4. 盛り上がりタブ: 候補 1 件のジャンプを YouTube で確認** — ハイライト候補のジャンプリンクが `watch?v=&t=Ns` 形式で、新規タブでおおむね該当秒付近から再生できること。
- [ ] **5. 収益タブ: スパチャ表示 or Empty** — スパチャがある配信なら一覧・合計が表示。ない配信なら Empty 状態が正しく表示されること。
- [ ] **6. 詳細検索: キーワード 1 件ヒット** — 既知の語で検索し、1 件以上ヒットすること。
- [ ] **7. JSON / CSV エクスポート成功** — 両形式でダウンロードまたはコピーができ、主要データ（messages 等）が含まれること。
- [ ] **8. 切り抜き Markdown / お礼 Markdown 取得** — スパチャあり配信で `markdown-clips` / `markdown-thanks` が取得できること（A+ 未完了時は stub でも可）。

---

## 自動 API テスト（補助）

```powershell
# スモークのみ（サーバー不要）
.\scripts\e2e-api.ps1

# フルフロー（Backend 起動済み + YouTube URL 指定）
.\scripts\e2e-api.ps1 -Url "https://www.youtube.com/watch?v=VIDEO_ID"
```

フルフローは `LIVECHATSCOPE_E2E_URL` 環境変数経由で POST → ポーリング → 分析 API → エクスポートを自動検証する（タイムアウト 30 分）。
