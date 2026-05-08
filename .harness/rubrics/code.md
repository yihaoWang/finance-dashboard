# Code Rubric

Evaluator 用此 rubric 評 code diff。每維度 1–5 分，**每分必附證據**（檔名:行號）。結論三選一：Accept / Revise / Block。

## 維度

1. **正確性**：邏輯正確、無明顯 bug、邊界條件處理（null / 空陣列 / 0 / 超大值）
2. **既有 pattern 吻合度**：與 `worker/src/sources/` adapter 風格一致；route 沿用 KV→D1→fetch 三層 cache；shared types 集中在 `@fd/shared`
3. **錯誤處理**：外部 API 失敗 fallback（`Promise.allSettled` / 回 null / warning），不要靜默吞錯（`catch {}` 違反全域規範）
4. **TypeScript 安全**：無 `any` / `@ts-ignore` / `as` 強轉；catch 用 `unknown`；arrow function；async 回 `Promise<T>`
5. **測試覆蓋**：sources 必須有 vitest 單元測試（mock fetcher）；route 用 hono test client
6. **命名與重複**：descriptive name；不重複 service/API call logic；不在 service layer 轉換 response data
7. **安全**：第三方 URL 走 `fetchWithRetry`；無 hardcoded token；Bearer auth 走 secret binding

## 結論判準

- **Accept**：所有維度 ≥ 4，現有測試 pass
- **Revise**：任一維度 ≤ 3 或測試未補
- **Block**：正確性 ≤ 2 / 用 `any` 或 `@ts-ignore` / 靜默吞錯 / 無測試但屬可測範圍

## 反模式（直接 Block）

- 主 generator agent 自評（必須是獨立 sub-agent）
- 評語籠統（「看起來不錯」）
- 無 file:line 證據
