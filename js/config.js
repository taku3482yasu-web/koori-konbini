// こおりくんの コンビニ物語 (こおりくんシリーズ) — 数値は ぜんぶ ここ (2026-11-17 Claude が きめた 仮の値。tools/test.js で 調整)
(function (root) {
    const CONFIG = {
        weeks: 52,                 // 1 年 = 52 週 (4 月 1 日 から)
        startMonth: 4,
        monthDays: [30, 31, 30, 31, 31, 30, 31, 30, 31, 31, 28, 31], // 4 月 〜 3 月
        dayNames: ['月', '火', '水', '木', '金', '土', '日'],
        dayTraffic: [0.95, 0.95, 0.97, 0.98, 1.05, 1.12, 1.08],

        start: { cash: 5000000, rep: 45, staff: 2 },
        bankrupt: -1000000,        // 資金が これを 下回ったら 閉店 (ゲームオーバー)
        fixedCost: 260000,         // 毎週の 家賃・光熱費
        royalty: 0.10,             // 本部への 支払い (売上の 割合)

        store: { baseCustomers: 800 },
        staff: { wage: 70000, hireCost: 30000, perPerson: 260, max: 10 }, // 店長 (あなた) も 1 人分 はたらく

        // 1 日の 平均気温 (おかおか市 = 福岡を もとに) と 雨の 日の 割合
        temp: [16, 20, 23, 28, 29, 25, 20, 14, 9, 7, 8, 11],
        rain: [0.25, 0.25, 0.5, 0.35, 0.25, 0.3, 0.2, 0.2, 0.2, 0.22, 0.25, 0.3],
        typhoon: [0, 0, 0, 0.02, 0.05, 0.05, 0.01, 0, 0, 0, 0, 0],
        snow: [0, 0, 0, 0, 0, 0, 0, 0, 0.03, 0.08, 0.06, 0],
        weather: {
            sun:     { name: '晴れ', icon: '☀️', traffic: 1.0 },
            cloud:   { name: 'くもり', icon: '☁️', traffic: 0.98 },
            rain:    { name: '雨', icon: '☔', traffic: 0.85 },
            typhoon: { name: '台風', icon: '🌀', traffic: 0.45 },
            snow:    { name: '雪', icon: '⛄', traffic: 0.75 }
        },
        forecastMiss: 0.15,        // 天気予報が はずれる 割合

        // 商品。rate = 1 人の お客さんが 買う 数、shelf = 何日で 廃棄か (0 = 日持ちする)、cap = 棚に おける 数
        products: [
            { id: 'onigiri', name: 'おにぎり', icon: '🍙', price: 150, cost: 95, rate: 0.45, shelf: 1, cap: 900 },
            { id: 'bento', name: 'お弁当', icon: '🍱', price: 520, cost: 360, rate: 0.22, shelf: 1, cap: 450 },
            { id: 'bread', name: 'パン', icon: '🥐', price: 170, cost: 110, rate: 0.25, shelf: 2, cap: 600 },
            { id: 'drink', name: 'ドリンク', icon: '🥤', price: 150, cost: 85, rate: 0.6, shelf: 0, cap: 1600, temp: [0.7, 0.017] },
            { id: 'snack', name: 'お菓子', icon: '🍫', price: 150, cost: 95, rate: 0.3, shelf: 0, cap: 900 },
            { id: 'daily', name: '日用品・雑誌', icon: '🧴', price: 350, cost: 250, rate: 0.14, shelf: 0, cap: 450 },
            { id: 'ice', name: 'アイス', icon: '🍦', price: 180, cost: 105, rate: 0.1, shelf: 0, cap: 500, iceCurve: true },
            { id: 'hotsnack', name: 'ホットスナック', icon: '🍗', price: 220, cost: 95, rate: 0.18, shelf: 1, cap: 350, temp: [1.2, -0.012], needs: 'fryer' },
            { id: 'coffee', name: 'いれたてコーヒー', icon: '☕', price: 150, cost: 45, rate: 0.2, shelf: 0, cap: 1000, needs: 'coffee' },
            { id: 'oden', name: 'おでん', icon: '🍢', price: 130, cost: 60, rate: 0.22, shelf: 1, cap: 450, odenCurve: true, needs: 'oden' }
        ],
        prices: {
            cheap:  { name: '安め', mul: 0.9, demand: 1.15, rep: 2 },
            normal: { name: 'ふつう', mul: 1.0, demand: 1.0, rep: 0 },
            high:   { name: '高め', mul: 1.1, demand: 0.85, rep: -2 }
        },

        // 設備 (いちど 買えば ずっと)。traffic = 来店の 倍率、boost = 商品ごとの 倍率
        upgrades: [
            { id: 'kanban', name: '看板を LED に', icon: '💡', cost: 400000, traffic: 1.05, text: '夜でも 目立つ。来店 +5%' },
            { id: 'fryer', name: 'ホットスナック什器', icon: '🍗', cost: 600000, text: 'からあげ・コロッケを 売れる (寒いほど 売れる)' },
            { id: 'coffee', name: 'コーヒーマシン', icon: '☕', cost: 800000, text: 'いれたてコーヒーを 売れる (もうけが 大きい)' },
            { id: 'oden', name: 'おでん鍋', icon: '🍢', cost: 200000, text: 'おでんを 売れる (秋〜冬の 主役)' },
            { id: 'fridge', name: '大型冷蔵ケース', icon: '🧊', cost: 700000, boost: { drink: 1.1, ice: 1.1 }, capMul: { drink: 1.5, ice: 1.5 }, text: 'ドリンク・アイス +10%・棚 1.5 倍' },
            { id: 'camera', name: '防犯カメラ', icon: '📹', cost: 300000, rep: 3, text: '評判 +3・万引きを ふせぐ' },
            { id: 'toilet', name: 'トイレ改装', icon: '🚻', cost: 500000, rep: 5, text: 'きれいな トイレは 評判 +5' },
            { id: 'delivery', name: '宅配便・コピー機', icon: '📦', cost: 400000, traffic: 1.04, text: 'ついでの お客さん。来店 +4%' },
            { id: 'atm', name: 'ATM', icon: '🏧', cost: 1000000, traffic: 1.06, text: '来店 +6%' },
            { id: 'selfreg', name: 'セルフレジ', icon: '🧾', cost: 1200000, staffMul: 1.25, text: 'スタッフ 1 人で さばける 人数 +25%' },
            { id: 'eatin', name: 'イートイン', icon: '🪑', cost: 1500000, traffic: 1.06, boost: { bento: 1.15, hotsnack: 1.15, coffee: 1.15 }, text: '来店 +6%・お弁当・ホットスナック・コーヒー +15%' },
            { id: 'parking', name: '駐車場を 広げる', icon: '🚗', cost: 3000000, traffic: 1.12, text: '車の お客さん。来店 +12%' }
        ],

        // 宣伝 (その 週だけ)
        campaigns: [
            { id: 'none', name: 'なし', cost: 0, traffic: 1 },
            { id: 'sns', name: 'SNS に 投稿', cost: 30000, traffic: 1.04, buzz: 0.12, text: 'たまに バズる (来店 +20%)' },
            { id: 'flyer', name: 'チラシ', cost: 80000, traffic: 1.08, text: '来店 +8%' },
            { id: 'lottery', name: 'くじ引き フェア', cost: 200000, traffic: 1.12, rep: 1, text: '来店 +12%・評判 +1' }
        ],

        // カレンダーの 行事 (週は 0 = 4 月 第 1 週)
        events: [
            { week: 0, name: '新生活', traffic: 1.1, text: '引っ越しの 人で 日用品が 売れる', boost: { daily: 1.5 } },
            { week: 1, name: '新生活', traffic: 1.06, boost: { daily: 1.3 } },
            { week: 4, name: 'おかおか どんたく', traffic: 1.4, text: 'まちじゅう お祭り。ドリンクと おにぎりが 飛ぶように 売れる', boost: { drink: 1.3, onigiri: 1.2 } },
            { week: 9, name: '梅雨入り', traffic: 1.0, text: '雨が ふえる。客足が にぶる' },
            { week: 13, name: '山かさ (前半)', traffic: 1.2, text: '朝早くから 人が 集まる。お弁当・おにぎりが 売れる', boost: { bento: 1.2, onigiri: 1.2 } },
            { week: 14, name: '山かさ (追い山)', traffic: 1.3, boost: { bento: 1.2, onigiri: 1.3, drink: 1.2 } },
            { week: 17, name: '夏休み', traffic: 1.05, boost: { ice: 1.2, snack: 1.15 } },
            { week: 18, name: '海の 花火大会', traffic: 1.35, text: '夜の お客さんが どっと くる。ドリンク・アイス 大人気', boost: { drink: 1.4, ice: 1.4, hotsnack: 1.2 } },
            { week: 19, name: 'お盆', traffic: 0.92, text: '帰省で まちの 人が へる' },
            { week: 23, name: 'ほうじょうや (秋祭り)', traffic: 1.25, text: '屋台が ならぶ 秋の 祭り', boost: { drink: 1.2, snack: 1.2 } },
            { week: 38, name: 'クリスマス', traffic: 1.15, text: 'チキンが いちばん 売れる 週', boost: { hotsnack: 1.8, snack: 1.2 } },
            { week: 39, name: '年末年始', traffic: 1.1, text: 'お店が 休みの 日も コンビニは あいてる', boost: { daily: 1.3, oden: 1.2 } },
            { week: 45, name: 'バレンタイン', traffic: 1.05, boost: { snack: 1.5 } },
            { week: 50, name: '卒業・引っ越し', traffic: 1.06, boost: { daily: 1.3 } }
        ],

        // 週の 途中で おきる できごと (1 週に 1 つまで)
        random: [
            { id: 'tv', chance: 0.05, minRep: 60, name: 'テレビの 取材が きた！', traffic: 1.2, rep: 3 },
            { id: 'quit', chance: 0.05, name: 'スタッフが 1 人 急に やめた…', quit: 1 },
            { id: 'construct', chance: 0.05, name: '近くで 工事が 始まった。作業員さんが お弁当を 買いに くる', boost: { bento: 1.3, drink: 1.15 } },
            { id: 'theft', chance: 0.06, name: '万引きの 被害が あった…', loss: 120000, noCamera: true },
            { id: 'outage', chance: 0.02, name: '停電で 1 日 お店を 閉めた', closed: 1 },
            { id: 'flu', chance: 0.12, months: [12, 1, 2], name: 'インフルエンザが はやっている。日用品・ドリンクが 売れる', boost: { daily: 1.5, drink: 1.1 } }
        ],

        // ライバル店 (おかおか市の コンビニ ランキング)。daily = 1 日の 売上 (年の はじめ)、grow = 1 年で のびる 割合
        rivals: [
            // 店長は シリーズの キャラ (owner = js/art-legacy.js の 絵)
            { name: 'おにおにマート てんじん中央店', owner: 'onioni', boss: 'おにおに', daily: 600000, grow: 0.06, line: 'おかおか 1 は ずっと おにの もんだ！' },
            { name: 'ハリーストア はかた駅前店', owner: 'harigeneral', boss: 'ハリージェネラル', daily: 560000, grow: 0.10, line: '駅前の 人通りに かなう ものか' },
            { name: 'かっぱマート なかす通り店', owner: 'okagappa', boss: 'おかがっぱ', daily: 500000, grow: 0.05, line: '夜の なかすは かっぱの 庭や' },
            { name: 'リュウソン ももち海浜店', owner: 'hyougaryu', boss: 'ヒョウガリュウ', daily: 440000, grow: 0.04, line: '海の 風が 客を 運んで くる', renew: { week: 26, mul: 1.15, text: 'ヒョウガリュウの リュウソン ももち海浜店が 大改装！ 売上を のばして いる' } },
            { name: 'ひびきマート いとしま街道店', owner: 'hibikimakuri', boss: 'ひびきまくり', daily: 380000, grow: 0.08, line: 'ドライブの 客は ぜんぶ もらう' }
        ],
        // あなたの 店の 店長は こおりくん。お客さんとして 来る キャラ (絵の id)
        guests: ['yamamou', 'sasaki', 'kotani', 'asahara', 'shibata', 'ueno', 'ikekimu', 'furukawa', 'tomoishi', 'dake', 'ishii', 'goldDog'],
        defaultName: 'こおりマート おかおか本店',

        // 季節で 来店が かわる (4 月 〜 3 月。ライバルにも かかる)
        seasonTraffic: [1.0, 1.02, 0.97, 1.08, 1.1, 1.0, 1.0, 0.98, 1.04, 0.96, 0.95, 1.0],

        // 評判 (0〜100)。目標 = base + 品ぞろえ × assort + 接客 × service + 設備・値段。毎週 move の 割合 だけ 近づく
        rep: { base: 15, assort: 55, service: 25, move: 0.3 }
    };
    if (typeof module !== 'undefined') module.exports = CONFIG;
    else root.CONFIG = CONFIG;
})(this);
