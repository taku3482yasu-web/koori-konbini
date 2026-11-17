# CLAUDE.md

このリポジトリで 作業する Claude への 約束です。

- 返事・コメント・書類は 日本語。ゲームの 中の 文字は こおりくんシリーズと 同じく ひらがな多め・分かち書き。
- これは「こおりくんのコンビニ（仮）」。もとは ユーザーの 企画書 `../こおりくんのコンビニ（仮）企画書.docx` (2026-11-17)。仕様は 企画書が いちばん。企画書の「案」「未定」で Claude が きめた 数値・名前は `js/config.js` に ★ の しるし。ユーザーが きめたら 書きかえる。
- 素の HTML/JS (ビルド なし)。index.html を ひらけば 遊べる。
- 計算は `js/sim.js` (画面に ふれない・node でも うごく・乱数は `state.rs` に もつので セーブから 同じ 続きに なる)。数値は ぜんぶ `js/config.js`。画面は `js/ui.js`、お店を 見下ろす 絵は `js/scene.js`。
- キャラの 絵: `js/art-legacy.js`・`js/pixel-hd.js` は koori-pachinko-gaiden から、`js/art-extra.js` (やす・たむ・ライバル店長) は koori-card の src/art/legacy-art.js から 写した。
- 企画書に ある しくみ: 出店地 (3 か所) と 移転・値段を 自分で きめる (地域ごとの「高いと 買わない」ライン・客の ひとこと)・消費期限と 値下げ (値下げハンター)・子ども食堂・施設 4 マス (客層が かわる)・地域の 好みは 売ると 分かる・スタッフ (シリーズの キャラ・接客/品出し/調理/探索・朝昼夜の シフト・やる気・やす たむ だけ の 連携)・放置型ダンジョン (特産品・便利アイテム・幻の 食材・帰ると つかれる)・限定商品・業務連携 (信頼度・ライバルに とられる)・おにおにバンク (100 万円・最初の 1 か月 つけ・月末 返済・利息・追加の 借金・払えないと 居座り)・毎週の コンビニランキング (1 位で クリア)・エンディング 3 つ・ふるカワ / Mr.SASAKI / ともいし / シバター / ゴールド金面犬 / KING.ASAHARA の 役。
- アルバイトと お金 (2026-11-17 ユーザー指定): スタッフは アルバイト募集 (`recruit`。つぎの 週に 応募が 来て、その 週の うちに やとう) で ふやす。給料は 時給 (`pay`) × `hoursPerSlot` 時間 × 7 日 × コマの 数を 毎週 はらう (ダンジョン中も)。施設は 買う お金の ほかに 毎週の 設備代 (`upkeep`・店の 基本 `baseUpkeep`)。
- 発注・倉庫・持ち場 (2026-11-17 ユーザー指定): 商品は 発注しないと とどかない (はじめは 発注 0・在庫 0)。毎朝 とどいた 商品は 荷受け場 (`back`) → 検品 → 倉庫 (`ware`・`warehouse.cap`。いっぱいだと 受け取れない) → 品出し → 棚 (`stock`・商品の `cap`)。客が 買えるのは 棚だけ (コーヒーは `self` で 倉庫の 豆から)。ホットスナック・おでんは 調理の 持ち場が 作る。スタッフは 持ち場 (`roles`: レジ・品出し・検品・調理) を 自分で きめる。能力 `st` = [接客, 品出し, 検品, 調理, 探索]。ほかの 持ち場は `roleHelp` だけ 手伝い、レジが ひまな ときは `spareWork` で 検品・品出しも する。
- ランキングの 点 (企画書で 未定) は ★ 直近 4 週の 売上の 平均 (万円) + 評判 × 0.5。
- やりこみ (2026-11-17 ユーザー指定): 季節の レアスタッフ 8 人 (`staff` の `rare`: months = 応募が 来る 月・perk = 店に いると 売れる 商品・dungeon = ダンジョンの 報酬 倍率。給料は 高め・能力も 高め)。募集した 週の つぎの 週の 月で `recruit.rareChance` の 確率で 応募に まざる。図鑑は localStorage `koori-konbini-zukan` (何回 遊んでも のこる)。絵は `js/art-rare.js` (koori-card から)。
- 棚と 床 (2026-11-17 ユーザー指定: 棚や 施設の 撤去): 床 `floor` マスを 棚 (`s.shelves`。商品の `cap` は 棚 1 台ぶん) と 施設 (最大 `maxFacilities`) で わける。棚 0 台の 商品は 売れない。棚・施設は 撤去できる (お金が 少し もどる)。スタッフは「解雇」できる。
- エンドレス (2026-11-17 ユーザー指定): `s.mode` = year / endless。エンドレスは おわらない (こよみ・行事は 52 週で くり返す・`yearOf`)。はじめて 1 位の 週は `s.clearedWeek`。
- 店を 大きく (2026-11-17 ユーザー指定: お金と 評判が いる): `storeLevels` (床・施設の 数・客・家賃)。`expandStore`。
- 棚の 種類と 商品 (2026-11-17 ユーザー指定): 商品は 28 品 (`type` = 置ける 棚: チルド・飲料・冷凍・常温・雑貨・ラック。`cat` = 発注の まとまり)。あとから ふえた 商品の 客層ごとの 買う 数は `rates`。棚は 種類で 値段と 電気代 (`shelfTypes`) が ちがう。施設 (中華まん・コピー機・宅配ロッカー・トイレ・ベーカリー・EV・キッズ・チケット) と 連携 (漁協・運輸・忍者便・清掃・人材派遣・ガチャポン) も ふやした。古い セーブは `migrate` で そろえる。
- 難易度 (2026-11-17 ユーザー指定: えらべる ように): `difficulties` (やさしい・ふつう・むずかしい。ライバルの 強さ・はじめの 手持ち・利息・客)。タイトルで えらぶ。`s.difficulty`。
- バランスは `node tools/test.js` (しくみの テストと 自動プレイ を 難易度ごとに)。目標 (ふつう): 何もしない = 借金が 返せない・目安だけ = クリア 1 割 以下で 借金は 9 割 以上 返せる・工夫 = クリア 3〜6 割 で 平均 第 24 週 より あと、どの 地域でも クリア できる・むちゃ = 返せない。やさしい = 目安だけでも 2 割 以上・工夫で 6 割 以上。むずかしい = 目安だけでは 0・工夫でも ふつうより 少ない。地域ごとの 数字は scratchpad の probe か `node tools/strategies.js`。
- 仕入れ値 (2026-11-17 ユーザー指定・決定): 発注の 表に 仕入れ・1こ の もうけ (`marginOf`)。仕入れ値は 週ごとに 動く (`costMove`・`prepareWeek` の `moveCosts`。`s.costNow` = 今週・`s.costPrev` = 先週・`s.costWhy` = わけ)。連携の 割引は `partners[].costDown` × 信頼度 (`costOf`)。仕入れ値は 発注した 週の 値。売り値は 自動で 変わらない。自動プレイ (`followCost`) は 仕入れの 差額ぶん 売り値を 動かす。
- 営業 (2026-11-17 ユーザー決定: 指示書 10-2 案B): `beginWeek` → `runSlot` (21 コマ。朝の 入荷は `startDay`、夜の 期限は `endDay`) → `finishWeek`。`runDay` = 1 日、`runWeek` = ぜんぶ。途中は `s.wk` (セーブすると その コマから)。営業中の 手は `midStock`・`midRush`・`midShift`・`midCook`・`midCallout` (`midweek` の 数値)。`shelfInfo` = 棚を 調べる、`alerts` = 早送りが 止まる わけ。ともいしの 来る 日は `beginWeek` で きまる (`tomoDay`)。自動プレイの `midweek` は すぐ品出し だけ (呼びこみ・緊急発注は 評判が 下がる ことが 多い)。
- 画面 (2026-11-17 ユーザー指定): 営業の 早送りは ui.js の `playWeek` (1 日 `playback.dayMs`)。`#live` パネル・棚を 調べる `#inspect`。設定は localStorage `koori-konbini-pref` (autoStop・skipAll)。scene.js は 床の マス (`cells`) に 棚・施設、`playSlot` で コマの 客、`hit` で タップ。画面確認: `&live=8` (8 コマ 進めた ところ)・`&inspect=onigiri`。
- 音 (2026-11-17 ユーザー指定): `js/audio.js` の `Sound` (`play(場面)`・`se(名前)`)。BGM は `sounds/bgm/<day|night|report|bank|ending>.mp3` が あれば それ (ない ときは 合成)。設定は localStorage `koori-konbini-sound`。ユーザーの 効果音ファイルは GitHub に 上げない。
- 案内 (2026-11-17 ユーザー指定): ui.js の `TUT` (1 週目に ふるカワが 順に)・`#tut`・「❓ 遊び方」(`howto-button`)。画面確認: `&tut=1`。
- 種類 (2026-11-17 ユーザー指定: 指示書 9 章): `products` は グループ、`varieties` に 種類 (`C.skus` = 種類の 一覧。種類を もたない グループは グループ id そのまま・`single`)。値段・発注・在庫・仕入れ・`history.products`・`lastPs` は 種類 (sku) の id (例 `onigiri.sake`)。棚・`capOf`・客層の `rate`・地域の 好み (`know`)・`productFactor` は グループ。需要は グループの 客 × `shareOf` (人気 `weightOf` = pop・季節・地域・新発売・ブーム)。品切れの 代わりは `substitute` (置いて いない 種類は `substituteMissing`)。棚 1 台 `varietyPerShelf` 種類 (指示書は 4 だが 5: 4 だと 目安プレイが きびしすぎた)。`pickSkus` = 人気の じゅんに 棚に のる 種類、`dailyNeed` は それらに グループの 客を 人気で 分ける (先週の 品切れで ふらつかない ように)。`splitOrder` = おまかせ 配分。新商品 `launch` (`s.offer`→`acceptOffer`)・ブーム `s.boom`・図鑑 `soldSkus` (localStorage の zukan.sold)。週の まとめは `report.groups` (left = 帰った 客)。古い セーブは `migrate` で いちばん 人気の 種類へ (`skuVer`)。
- 公開: https://taku3482yasu-web.github.io/koori-konbini/ (main に push すると 公開)。ゲーム大全に No.08 で ならべた。テストが 通ったら 聞かずに commit して push する (2026-11-17 ユーザー指定)。
- コミットの 前に `.githooks/pre-commit` が テストする (`git config core.hooksPath .githooks`)。
- 画面の 確認: `index.html?play=onga&weeks=6` (地域を えらんで 6 週 すすめた ところ)・`&tab=staff|shop|partner|bank|area|rank`・`&report=1` (1 週 営業して まとめ)・`&end=clear|normal|bad`・`?story=1` (オープニング)・`?region=1` (出店地)。
