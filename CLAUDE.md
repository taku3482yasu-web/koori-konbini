# CLAUDE.md

このリポジトリで 作業する Claude への 約束です。

- 返事・コメント・書類は 日本語。ゲームの 中の 文字は こおりくんシリーズと 同じく ひらがな多め・分かち書き。
- これは 「こおりくんの コンビニ物語」(2026-11-17 ユーザー指定: こおりくんシリーズの コンビニ経営ゲーム。1 年 経営して おかおか (福岡) 1 の コンビニを めざす)。
- 素の HTML/JS (ビルド なし)。index.html を ひらけば 遊べる。
- 計算は `js/sim.js` (画面に ふれない・node でも うごく・乱数は `state.rs` に もつので セーブから 同じ 続きに なる)。数値は ぜんぶ `js/config.js`。画面は `js/ui.js`、お店の 絵は `js/scene.js`。
- キャラの 絵は koori-pachinko-gaiden の `js/art-legacy.js`・`js/pixel-hd.js` を 写した。店長は こおりくん、ライバル店の 店長は おにおに・ハリージェネラル・おかがっぱ・ヒョウガリュウ・ひびきまくり (Claude が きめた)。
- 1 回の えいぎょう = 1 週間。4 月 〜 3 月の 52 週。1 年の 売上の 合計が ライバル 5 店より 多ければ クリア。資金が `bankrupt` を 下回ると 閉店。
- 数値は Claude が きめた 仮の値。バランスは `node tools/test.js` (自動プレイ 4 種: 何もしない・おまかせ・じょうず・むちゃ) で たしかめる。目標: 何もしない = 1 位 0・おまかせ = 1 位 半分 以下・じょうず = 7 割 以上・むちゃ = ほぼ 閉店。`node tools/strategies.js` で 数字を 見られる。
- コミットの 前に `.githooks/pre-commit` が テストする (`git config core.hooksPath .githooks`)。
- 画面の 確認: `index.html?play=1&seed=5` (すぐ はじめる)・`&tab=shop|staff|rank`・`&report=1` (1 週 すすめて 報告を 出す)・`&cash=数`・`&fast=1` (営業の 演出を とばす)。
