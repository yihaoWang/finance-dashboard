# Lessons（永久防線清單）

由 `/harness-promote-lesson` 維護。每條規則包含：

- 規則描述
- 強制方式（lint / test / pre-commit / docs）
- 強制位置（檔案 + 行號）
- 來源（哪個錯誤啟發的）
- 歷史違規數

## 範例條目

```markdown
## 2026-05-08: 不要在 service layer 轉換 API response data
- **強制方式**: docs (CLAUDE.md 硬約束第 N 條)
- **位置**: `~/.claude/CLAUDE.md` Code Structure 區
- **來源**: 既有規範
- **歷史違規數**: 0
```

## 2026-05-08: web 改動完成後必須 deploy 到 Cloudflare Pages，git push 不會自動部署
- **規則**: 任何 `web/` 內的 UI/邏輯改動 commit + push 後，必須額外執行 build + `wrangler pages deploy` 才會反映在 production，使用者看到的是 Pages 版本，不是 GitHub。
- **強制方式**: docs (CLAUDE.md / harness lessons) + 工作流程
- **流程**:
  ```bash
  pnpm --filter web build
  cd worker && pnpm exec wrangler pages deploy ../web/dist --project-name=finance-dashboard --branch=main
  ```
- **來源**: 使用者回報「改了但沒 push 到 cloudflare」，誤以為 git push 即上線
- **歷史違規數**: 1
