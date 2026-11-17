// こおりくんの コンビニ（仮） — 数値は ぜんぶ ここ
// 企画書 (2026-11-17 ユーザー: こおりくんのコンビニ（仮）企画書.docx) に 合わせた。
// 企画書で「未定」「案」の ところの 数値・名前は Claude が きめた 仮の値 (★ の しるし)。tools/test.js で バランスを たしかめる。
(function (root) {
    const CONFIG = {
        weeks: 52,                 // 1 年 = 52 ターン (1 ターン = 1 週間)
        startMonth: 4,             // ★ 4 月 1 日 から
        monthDays: [30, 31, 30, 31, 31, 30, 31, 30, 31, 31, 28, 31],
        dayNames: ['月', '火', '水', '木', '金', '土', '日'],
        dayTraffic: [0.95, 0.95, 0.97, 0.98, 1.05, 1.12, 1.08],
        slotNames: ['朝', '昼', '夜'],

        start: { cash: 400000, rep: 40, regulars: 0 },
        // 難易度 (2026-11-17 ユーザー指定: 難易度を えらべる ように) ★ 数値は Claude
        // rival = ライバル店の 売上の 倍率、cash = はじめの 手持ち、rate = おにおにバンクの 利息 (月)、traffic = 客の 倍率
        difficulties: {
            easy: { name: 'やさしい', text: 'はじめての 人に。ライバルが 弱く、手持ちが 多く、利息が 安い', rival: 0.95, cash: 600000, rate: 0.01, traffic: 1.02 },
            normal: { name: 'ふつう', text: '発注と 持ち場を 工夫すれば 1 位に とどく', rival: 1.06, cash: 400000, rate: 0.02, traffic: 1 },
            hard: { name: 'むずかしい', text: 'ライバルが 強く、手持ちが 少なく、利息が 高い', rival: 1.12, cash: 250000, rate: 0.03, traffic: 0.98 }
        },
        royalty: 0.04,             // ★ 本部への 支払い (売上の 割合。Mr.SASAKI は 本部の スーパーバイザー)

        // ----- おにおにバンク (企画書: 借金 100 万円・最初の 1 か月は つけ・毎月 返す・利息・追加の 借金は 利息が 上がる) -----
        bank: {
            debt: 1000000,
            rate: 0.02,            // ★ 月の 利息
            pay: 100000,           // ★ 毎月の 返済 (利息は べつ)
            graceMonths: 1,        // 最初の 1 か月は つけ
            borrow: 500000,        // ★ 追加で 借りる 額
            borrowRate: 0.01,      // ★ 追加で 借りる たびに 利息 +1%
            maxBorrow: 3,
            occupyWeeks: 4,        // ★ 払えないと おにおにが 居座る 週
            occupyTraffic: 0.75,   // ★ 居座られて いる あいだの 来店
            lateFee: 20000
        },

        // ----- 地域 (企画書: 地域で 売れる 商品・来る 人・特産品が ちがう。好みは 最初 かくして おく。地名は シリーズから) -----
        // ★ 3 か所・客の 数・特産品・好みは Claude が きめた。base = 1 日の 客 (客層ごと)。line = 「高いと 買わない」 ライン (ふつうの 値段の 何倍 まで)
        regions: [
            {
                id: 'tsugaku', name: '通学路', icon: '🎒', text: '学生の 通り道。安い ものと お菓子が 売れる。家賃は 安め',
                base: { student: 290, worker: 45, family: 50, driver: 25 }, line: 1.0, rent: 40000,
                local: { name: '通学路の 畑の いちご', icon: '🍓' },
                pref: { snack: 1.35, hotsnack: 1.3, ice: 1.2, bento: 0.8, coffee: 0.8, daily: 0.9 }, parkingMul: 1
            },
            {
                id: 'onga', name: '遠賀川', icon: '🏞', text: '川ぞいの 道。家族連れと 車の 客が 多い。駐車場が 安い',
                base: { student: 45, worker: 50, family: 130, driver: 95 }, line: 1.0, rent: 40000,
                local: { name: '遠賀川の 川えび', icon: '🦐' },
                pref: { oden: 1.25, daily: 1.25, onigiri: 1.15, coffee: 0.85, snack: 0.9 }, parkingMul: 0.6
            },
            {
                id: 'kokura', name: '小倉駅前', icon: '🚉', text: 'サラリーマンが 多い。高くても 買って くれるが 家賃が 高い。駐車場は 高い',
                base: { student: 50, worker: 190, family: 25, driver: 25 }, line: 1.1, rent: 60000,
                local: { name: '小倉の 焼うどん', icon: '🍜' },
                pref: { coffee: 1.3, bento: 1.2, bread: 1.1, snack: 0.8, ice: 0.85 }, parkingMul: 3
            }
        ],
        moveCost: 400000,          // ★ 移転の 費用
        moveKeepRegulars: 0.2,     // ★ 移転で のこる 常連 (施設と 地域の 知識は のこる。駐車場は 置けない 地域で なくなる)
        knowWeeks: 3,              // ★ この 週数 売ると その 地域の 好み (↑↓) が 分かる

        // ----- 客層 ★ -----
        // sense = 値段への きびしさ・slot = 朝/昼/夜 に 来る 割合・rate = 1 人が 買う 数
        segments: {
            student: { name: '学生', icon: '🎒', sense: 2.2, slot: [0.3, 0.2, 0.5], rate: { onigiri: 0.35, bento: 0.1, bread: 0.25, drink: 0.6, snack: 0.5, daily: 0.05, ice: 0.2, coffee: 0.05, hotsnack: 0.35, oden: 0.15 } },
            worker: { name: 'サラリーマン', icon: '💼', sense: 0.9, slot: [0.4, 0.4, 0.2], rate: { onigiri: 0.4, bento: 0.3, bread: 0.2, drink: 0.5, snack: 0.1, daily: 0.1, ice: 0.05, coffee: 0.45, hotsnack: 0.2, oden: 0.15 } },
            family: { name: '家族連れ', icon: '👪', sense: 1.5, slot: [0.15, 0.6, 0.25], rate: { onigiri: 0.3, bento: 0.2, bread: 0.25, drink: 0.5, snack: 0.4, daily: 0.3, ice: 0.25, coffee: 0.1, hotsnack: 0.2, oden: 0.2 } },
            driver: { name: 'ドライバー', icon: '🚚', sense: 1.2, slot: [0.3, 0.25, 0.45], rate: { onigiri: 0.45, bento: 0.35, bread: 0.15, drink: 0.7, snack: 0.15, daily: 0.1, ice: 0.05, coffee: 0.4, hotsnack: 0.3, oden: 0.1 } }
        },

        // ----- 商品 (企画書: 値段は 自分で きめる・消費期限で 値下げ) -----
        // price = ふつうの 値段、shelf = 何日で 期限切れか (0 = 日持ちする)、cap = 売り場の 棚に ならべられる 数 (のこりは 倉庫)、
        // cook = 調理の 持ち場が 作って ケースへ (うでで 売れかたも かわる)、self = コーヒーマシン (倉庫の 豆から その場で いれる。品出し いらない)
        products: [
            { id: 'onigiri', name: 'おにぎり', icon: '🍙', price: 150, cost: 95, shelf: 2, cap: 120 },
            { id: 'bento', name: 'お弁当', icon: '🍱', price: 520, cost: 360, shelf: 2, cap: 70 },
            { id: 'bread', name: 'パン', icon: '🥐', price: 170, cost: 110, shelf: 3, cap: 90 },
            { id: 'drink', name: 'ドリンク', icon: '🥤', price: 150, cost: 85, shelf: 0, cap: 300, temp: [0.7, 0.017] },
            { id: 'snack', name: 'お菓子', icon: '🍫', price: 150, cost: 95, shelf: 0, cap: 160 },
            { id: 'daily', name: '日用品・雑誌', icon: '🧴', price: 350, cost: 250, shelf: 0, cap: 90 },
            { id: 'ice', name: 'アイス', icon: '🍦', price: 180, cost: 105, shelf: 0, cap: 90, iceCurve: true },
            { id: 'coffee', name: 'いれたてコーヒー', icon: '☕', price: 150, cost: 45, shelf: 0, cap: 9999, self: true, needs: 'coffee' },
            { id: 'hotsnack', name: 'ホットスナック', icon: '🍗', price: 220, cost: 95, shelf: 1, cap: 60, temp: [1.2, -0.012], needs: 'fryer', cook: true },
            { id: 'oden', name: 'おでん', icon: '🍢', price: 130, cost: 60, shelf: 1, cap: 80, odenCurve: true, needs: 'oden', cook: true }
        ],
        priceStep: 10,
        priceRange: [0.6, 1.6],    // 値段を つけられる はば (ふつうの 何倍)
        cheapLine: 0.88,           // ★ これより 安いと「安っ！」・平均が これより 安いと「安いだけの 店」
        markdowns: [0, 0.2, 0.4],  // 期限 今日までの 商品の 値下げ
        hunterRate: 0.002,         // ★ 常連 1 人あたりの 値下げハンターの 割合 (上限 0.3)
        kidsRep: 0.02,             // ★ 子ども食堂に 回した 1 こあたりの 評判 (1 週 最大 4)

        // ----- 限定商品 (企画書: 特産品や ダンジョンの 報酬で 弁当・おにぎりを 作る) ★ -----
        // 材料 1 つで make こ 作れる。rate = 1 人の 客が 買う 数 (どの 客層も)
        materials: {
            local: { name: '特産品', icon: '🧺' },
            kinoko: { name: '森の きのこ', icon: '🍄' },
            umi: { name: '海の さち', icon: '🐟' },
            maboroshi: { name: '幻の 食材', icon: '🌟' }
        },
        recipes: [
            { id: 'localBento', name: '特産弁当', icon: '🍱', use: { local: 1 }, make: 25, price: 600, cost: 150, rate: 0.06 },
            { id: 'kinokoOnigiri', name: 'きのこ おにぎり', icon: '🍙', use: { kinoko: 1 }, make: 30, price: 220, cost: 40, rate: 0.08 },
            { id: 'kaisenBento', name: '海鮮弁当', icon: '🍣', use: { umi: 1 }, make: 20, price: 750, cost: 150, rate: 0.05 },
            { id: 'maboroshiBento', name: '幻の 限定弁当', icon: '✨', use: { maboroshi: 1, local: 1 }, make: 20, price: 1200, cost: 200, rate: 0.08, rep: 2 }
        ],
        limitedShelf: 3,
        localPerWeek: 0.5,         // ★ 地域から 毎週 とどく 特産品 (0.5 = 2 週に 1 つ)

        // ----- 便利施設 (企画書: 店の 広さに 限り・施設ごとに 集まる 客が ちがう) -----
        slots: 4,                  // ★ 置ける 数
        facilities: [
            { id: 'eatin', name: 'イートインルーム', icon: '🪑', cost: 800000, upkeep: 15000, seg: { student: 1.25, worker: 1.1 }, capMul: 0.9, text: '学生・ひとり飯が 来る', warn: '長居で レジの 回転が 落ちる' },
            { id: 'smoke', name: 'たばこ室', icon: '🚬', cost: 600000, upkeep: 8000, seg: { worker: 1.2, driver: 1.3, family: 0.8 }, text: 'サラリーマン・トラック運転手が 来る', warn: '家族連れが へる' },
            { id: 'parking', name: '駐車場', icon: '🚗', cost: 1000000, upkeep: 10000, seg: { family: 1.35, driver: 1.4 }, text: '家族連れ・車の 客が 来る', warn: '駅前では 高い' },
            { id: 'wifi', name: 'Wi-Fi・充電', icon: '📶', cost: 300000, upkeep: 6000, seg: { student: 1.2, worker: 1.05, family: 1.05, driver: 1.05 }, spend: 0.92, text: '長居する 客が 来る', warn: '客単価が 低い' },
            { id: 'coffee', name: 'コーヒーマシン', icon: '☕', cost: 500000, upkeep: 12000, text: 'いれたてコーヒーを 売れる (もうけが 大きい)' },
            { id: 'fryer', name: 'ホットスナック什器', icon: '🍗', cost: 400000, upkeep: 10000, text: 'からあげ・コロッケを 売れる (寒いほど 売れる)' },
            { id: 'oden', name: 'おでん鍋', icon: '🍢', cost: 150000, upkeep: 5000, text: 'おでんを 売れる (秋〜冬の 主役)' },
            { id: 'atm', name: 'ATM', icon: '🏧', cost: 600000, upkeep: 6000, seg: { student: 1.06, worker: 1.06, family: 1.06, driver: 1.06 }, text: 'どの 客も 少し ふえる' },
            { id: 'fridge', name: '大型冷蔵ケース', icon: '🧊', cost: 400000, upkeep: 9000, boost: { drink: 1.1, ice: 1.15 }, capMul: { drink: 1.5, ice: 1.5 }, text: 'ドリンク・アイスが 売れる・棚 1.5 倍' }
        ],
        sellBack: 0.3,             // ★ 施設を はずすと 戻る お金
        // upkeep = 毎週の 設備代 (リース・電気代・手入れ。2026-11-17 ユーザー指定: 設備代も はらう) ★ 金額は Claude
        baseUpkeep: 30000,         // ★ 店の 基本の 設備 (レジ・冷蔵の 棚・照明) の 電気代・リース

        // ----- スタッフ (企画書: シリーズの キャラ・接客/品出し/調理/ダンジョンの 得意不得意・シフト・給料と やる気) ★ -----
        // st = [接客, 品出し, 検品, 調理, 探索] (1〜5)。pay = 時給 (2026-11-17 ユーザー: アルバイトを 募集・給料を 払う)。
        // 1 コマ = 1 日 hoursPerSlot 時間 × 7 日。給料は 毎週 はらう。ダンジョンの あいだも 2 コマぶん はらう
        staff: [
            { id: 'koori', name: 'こおりくん', art: 'koori', st: [3, 3, 3, 2, 2], pay: 0, boss: true, text: '店長。就活に 失敗した' },
            { id: 'yasu', name: 'やす', art: 'yasu', st: [3, 2, 2, 2, 4], pay: 1000, text: 'やすパンチで ダンジョンも こなす' },
            { id: 'tamu', name: 'たむ', art: 'tamu', st: [2, 4, 3, 3, 3], pay: 1000, text: '品出しが はやい' },
            { id: 'dake', name: 'だけ', art: 'dake', st: [2, 2, 2, 4, 4], pay: 1000, text: '調理と 探索が 得意' },
            { id: 'kotani', name: 'こたに', art: 'kotani', st: [5, 3, 2, 2, 1], pay: 1300, text: '接客の プロ。ダンジョンは にがて' },
            { id: 'yamamou', name: 'やまもぅ', art: 'yamamou', st: [2, 3, 2, 5, 2], pay: 1200, text: '料理が うまい' },
            { id: 'ishii', name: 'イシイー', art: 'ishii', st: [1, 2, 4, 2, 5], pay: 950, text: '遺跡の 達人。お店は にがて' },
            { id: 'ikekimu', name: 'いけきむ', art: 'ikekimu', st: [3, 4, 4, 2, 3], pay: 1100, text: 'なんでも そつなく' },
            { id: 'ueno', name: 'マッスルウエノーブル', art: 'ueno', st: [2, 5, 2, 1, 5], pay: 1400, text: '筋肉で 品出しも 探索も' }
        ],
        startStaff: ['koori', 'yasu'],
        hoursPerSlot: 5,
        // アルバイト募集 (2026-11-17 ユーザー指定): 求人を 出すと つぎの 週に 応募が 来る。その 週の うちに やとわないと ほかへ 行く
        recruit: { cost: 20000, min: 1, max: 3 },
        maxStaff: 6,               // こおりくんを ふくめて
        // ----- 持ち場 (2026-11-17 ユーザー指定: スタッフの 中でも 役割が ある。向き 不向きは スタッフで ちがうが、どこに 置くかは 自分で きめる) -----
        // stat = つかう 能力 (st の 番号)。ほかの 持ち場の 人も roleHelp だけ 手伝う ★
        roles: {
            register: { name: 'レジ', icon: '🧾', stat: 0, text: '接客。足りないと 客が 帰る' },
            stock: { name: '品出し', icon: '📦', stat: 1, text: '倉庫から 棚へ。足りないと 倉庫に あるのに 棚が 空' },
            check: { name: '検品', icon: '📋', stat: 2, text: 'とどいた 商品を 受け取って 倉庫へ。足りないと 品出し できない' },
            cook: { name: '調理', icon: '🍳', stat: 3, text: 'ホットスナック・おでんを 作る。うでで 売れかたも かわる' }
        },
        roleHelp: 0.3,
        spareWork: 0.8,            // ★ レジが ひまな 時間の この 割合で 検品・品出しも する
        serve: 60,                 // ★ 接客 1 で 1 コマに さばける 客
        stockPer: 130,             // ★ 品出し 1 で 1 コマに 棚へ 出せる 数
        checkPer: 220,             // ★ 検品 1 で 1 コマに 受け取れる 数
        cookPer: 40,               // ★ 調理 1 で 1 コマに 作れる 数
        // 倉庫 (2026-11-17 ユーザー指定: 倉庫に 入れて おける。商品は 発注しないと とどかない) ★ 数は Claude
        keepDays: 2,               // ★「目安」は 日持ちする 商品を 倉庫に この 日数ぶん のこす
        warehouse: { cap: 5000, add: 2500, cost: 300000, upkeep: 5000, max: 2 },
        trio: ['yasu', 'tamu', 'dake'], // 3 人 そろうと 連携ボーナス (店に いる 3 人の 能力 +1)
        mood: { start: 70, work: [12, 5, 0, -12], tired: 0.7, low: 30, lowMul: 0.75, quit: 8 }, // 0〜3 コマの やる気の 増減

        // ----- ダンジョン (企画書: 放置型・特産品と 便利アイテム・幻の 食材・深いほど 報酬が よく 帰りが おそい・帰ると 疲れる。場所は シリーズから) ★ -----
        dungeons: [
            { id: 'forest', name: 'ハリーの森', weeks: 1, rewards: { kinoko: [1, 2] }, items: 0.25, maboroshi: 0, danger: 1 },
            { id: 'coast', name: '浦の島の海岸どうくつ', weeks: 2, rewards: { umi: [1, 3], kinoko: [0, 1] }, items: 0.5, maboroshi: 0.15, danger: 2 },
            { id: 'moon', name: '月の迷宮', weeks: 3, rewards: { umi: [1, 2], kinoko: [1, 2] }, items: 0.9, maboroshi: 0.6, danger: 3 }
        ],
        items: {
            maneki: { name: 'まねきねこ', icon: '🐱', text: '4 週 来店 +10%', weeks: 4, traffic: 1.1 },
            hieishi: { name: 'ひえひえ石', icon: '🧊', text: '3 週 期限切れが 半分', weeks: 3 },
            genki: { name: 'げんきドリンク', icon: '⚡', text: 'スタッフ 全員の やる気 +30' }
        },

        // ----- 業務連携 (企画書: お金を 払って 連携・信頼度で 安く 強く・ライバルに 先に とられる) -----
        partners: [
            { id: 'farm', name: 'おかおか農場', boss: '★ 未定', art: null, fee: 30000, local: 2, text: '特産品 +2 / 週' },
            { id: 'field', name: 'はたけ', boss: '★ 未定', art: null, fee: 15000, local: 1, text: '特産品 +1 / 週' },
            { id: 'ad', name: 'ひびき広告', boss: 'ひびきまくり (声が でかい)', art: 'hibikimakuri', fee: 50000, traffic: 1.1, text: '来店 +10%' },
            { id: 'event', name: 'DJ かっぱ イベント', boss: 'おかがっぱ (DJ)', art: 'okagappa', fee: 120000, perUse: true, day: 2.2, text: 'えらんだ 1 日だけ 大混雑 (客 2.2 倍)' }
        ],
        trustFee: 0.02, trustPower: 0.01, trustMax: 15, // ★ 信頼度 1 ごとに 料金 −2%・効果 +1% (15 まで)
        steal: 0.03, stealWeeks: 8, // ★ ライバルに とられる 確率 / 週・とられる 週

        // ----- 天気 (おかおか市 = 福岡を もとに) -----
        temp: [16, 20, 23, 28, 29, 25, 20, 14, 9, 7, 8, 11],
        rain: [0.25, 0.25, 0.5, 0.35, 0.25, 0.3, 0.2, 0.2, 0.2, 0.22, 0.25, 0.3],
        typhoon: [0, 0, 0, 0.02, 0.05, 0.05, 0.01, 0, 0, 0, 0, 0],
        snow: [0, 0, 0, 0, 0, 0, 0, 0, 0.03, 0.08, 0.06, 0],
        weather: {
            sun: { name: '晴れ', icon: '☀️', traffic: 1.0 },
            cloud: { name: 'くもり', icon: '☁️', traffic: 0.98 },
            rain: { name: '雨', icon: '☔', traffic: 0.85 },
            typhoon: { name: '台風', icon: '🌀', traffic: 0.45 },
            snow: { name: '雪', icon: '⛄', traffic: 0.75 }
        },
        forecastMiss: 0.15,
        seasonTraffic: [1.0, 1.02, 0.97, 1.08, 1.1, 1.0, 1.0, 0.98, 1.04, 0.96, 0.95, 1.0],

        // ----- 季節と 行事 (企画書: 夏祭り・受験シーズン・年末年始 など) ★ -----
        events: [
            { week: 0, name: '新生活', traffic: 1.08, boost: { daily: 1.5 } },
            { week: 4, name: 'おかおか どんたく', traffic: 1.35, text: 'まちじゅう お祭り。ドリンクと おにぎりが 売れる', boost: { drink: 1.3, onigiri: 1.2 } },
            { week: 13, name: '山かさ', traffic: 1.2, text: '朝早くから 人が 集まる。お弁当・おにぎりが 売れる', boost: { bento: 1.2, onigiri: 1.2 } },
            { week: 14, name: '山かさ (追い山)', traffic: 1.25, boost: { bento: 1.2, onigiri: 1.3, drink: 1.2 } },
            { week: 17, name: '夏休み', traffic: 1.0, seg: { student: 1.15, worker: 0.9 }, boost: { ice: 1.2, snack: 1.15 } },
            { week: 18, name: '夏祭り・花火大会', traffic: 1.35, text: '夜の 客が どっと くる。ドリンク・アイス 大人気', boost: { drink: 1.4, ice: 1.4, hotsnack: 1.2 } },
            { week: 19, name: 'お盆', traffic: 0.92, text: '帰省で まちの 人が へる' },
            { week: 23, name: 'ほうじょうや (秋祭り)', traffic: 1.2, boost: { drink: 1.2, snack: 1.2 } },
            { week: 38, name: 'クリスマス', traffic: 1.12, text: 'チキンが いちばん 売れる 週', boost: { hotsnack: 1.8, snack: 1.2 } },
            { week: 39, name: '年末年始', traffic: 1.1, boost: { daily: 1.3, oden: 1.2 } },
            { week: 41, name: '受験シーズン', traffic: 1.0, seg: { student: 1.25 }, text: '学生が 夜おそくまで 勉強。ごうかく祈願の お菓子が 売れる', boost: { snack: 1.3, coffee: 1.2 } },
            { week: 42, name: '受験シーズン', traffic: 1.0, seg: { student: 1.2 }, boost: { snack: 1.25, coffee: 1.2 } },
            { week: 45, name: 'バレンタイン', traffic: 1.05, boost: { snack: 1.5 } },
            { week: 50, name: '卒業・引っ越し', traffic: 1.05, boost: { daily: 1.3 } }
        ],

        // ----- キャラの できごと (企画書の キャラの 役割から) ★ -----
        tomoishi: { chance: 0.07, rep: 5 },     // ともいし: 抜き打ちで 店を チェック
        goldDog: { chance: 0.025, day: 1.8 },    // ゴールド金面犬: 伝説の 客。来たら 大入り
        shibata: { regulars: 60 },               // シバター: 常連が この 数を こえると 来る
        sasaki: { bonus: { S: 50000, A: 20000 } }, // Mr.SASAKI: 月末の 査定

        // ----- 評判と 常連 ★ -----
        rep: { base: 20, assort: 45, service: 25, move: 0.3, trafficMin: 0.75, trafficMax: 1.25 },
        regulars: { gain: 16, cheap: 6, visit: 1.0, max: 600, lose: 0.015 },

        // ----- コンビニランキング (企画書: 毎週 発表・最後の 壁は KING.ASAHARA の チェーン) -----
        // ★ 点 = 直近 4 週の 売上の 平均 (万円) + 評判 × 0.5。daily ではなく 1 週の 売上 (年の はじめ)、grow = 1 年で のびる 割合
        rankWeeks: 4,
        rivals: [
            { name: 'KING.ASAHARA チェーン 小倉本店', owner: 'asahara', boss: 'KING.ASAHARA', weekly: 1800000, grow: 0.3, rep: 85, line: 'おかおかの 王は この KING.ASAHARA だ！' },
            { name: 'ハリーストア', owner: 'harigeneral', boss: 'ハリージェネラル', weekly: 1650000, grow: 0.15, rep: 70, line: '森の 王が コンビニでも 天下を とる' },
            { name: 'リュウソン', owner: 'hyougaryu', boss: 'ヒョウガリュウ', weekly: 1350000, grow: 0.1, rep: 65, line: '氷の 竜の 店に かなう ものか' },
            { name: 'ネオンたぬき 24', owner: 'neontanuki', boss: 'ネオンたぬき', weekly: 1150000, grow: 0.12, rep: 55, line: '夜は ぜんぶ たぬきの もの' },
            { name: 'ゆきうさマート', owner: 'yukiusapon', boss: 'ゆきうさぽん', weekly: 1000000, grow: 0.15, rep: 60, line: 'ぴょん！ まけないぴょん' },
            { name: 'ペコリスストア', owner: 'pekorisu', boss: 'ペコリス', weekly: 850000, grow: 0.1, rep: 50, line: 'ぺこり。よろしく おねがいします' }
        ]
    };
    if (typeof module !== 'undefined') module.exports = CONFIG;
    else root.CONFIG = CONFIG;
})(this);
