# UI Rubric (starter)

Evaluator 用此 rubric 評分。每維度 1–5 分，**每分必附證據**（檔名:行號 或 圖片區塊）。結論三選一：Accept / Revise / Block。

## 維度

1. **視覺一致**：色彩、間距、字級是否與既有 design system / token 一致
2. **對比度（WCAG）**：文字對比 ≥ 4.5:1，互動元素 ≥ 3:1
3. **響應式**：常見斷點（mobile / tablet / desktop）無破版、無溢出
4. **互動回饋**：hover / focus / loading / error / disabled 狀態完整
5. **資料邊界**：空狀態、超長文字、零筆資料、錯誤態都有處理
6. **排版精緻**：對齊、節奏、留白、層級分明，無「AI 樣板感」

## 結論判準

- **Accept**：所有維度 ≥ 4，無 critical 問題
- **Revise**：任一維度 ≤ 3 或有列出可修的具體問題
- **Block**：對比度不過 / 響應式破版 / 資料邊界沒處理 → 必須改

## 反模式（直接 Block）

- 主 generator agent 自評（必須是獨立 sub-agent）
- 評語籠統（「看起來不錯」「可以改進」）
- 無 file:line 證據
