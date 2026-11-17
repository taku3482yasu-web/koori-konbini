// バランスを たしかめる ための 自動プレイ (tools/test.js から つかう)
const Sim = require('../js/sim.js');
const C = Sim.C;

// 何も しない: 発注は はじめの まま
function idle() {}

// ふつう: 毎週 おまかせ発注・スタッフは 足りる くらい・設備は 安い 順に 余裕が あれば
function normal(s) {
    for (const p of C.products) if (Sim.available(s, p.id)) s.orders[p.id] = Sim.suggest(s, p.id);
    const info = Sim.weekInfo(s.week);
    const need = Math.ceil(Sim.estTraffic(s, info) * 1.05 / (Sim.capacity({ ...s, staff: 0 }))) - 1;
    Sim.setStaff(s, Math.max(1, need));
    for (const u of [...C.upgrades].sort((a, b) => a.cost - b.cost)) if (!s.upgrades[u.id] && s.cash > u.cost + 1500000) Sim.buyUpgrade(s, u.id);
}

// じょうず: 天気予報と 行事を 見て 発注・スタッフは 多め・来店の ふえる 設備から 買う・宣伝も する
function good(s) {
    const order = ['fryer', 'coffee', 'oden', 'kanban', 'toilet', 'camera', 'parking', 'atm', 'eatin', 'delivery', 'fridge', 'selfreg'];
    for (const id of order) if (!s.upgrades[id] && s.cash > Sim.upgrade(id).cost + 600000) Sim.buyUpgrade(s, id);
    const info = Sim.weekInfo(s.week);
    let maxT = 0;
    for (const p of C.products) {
        if (!Sim.available(s, p.id)) continue;
        // 予報の 天気で 1 日ずつ 見つもって 平均 (発注は 1 日 同じ 数) の 1.05 倍
        let sum = 0;
        for (let d = 0; d < 7; d++) {
            const f = s.forecast[d];
            const t = Sim.estTraffic(s, info) * C.dayTraffic[d] * C.weather[f.w].traffic;
            maxT = Math.max(maxT, t);
            sum += t * p.rate * Sim.productFactor(s, p, f.temp, f.w, info.mi, info.event, null);
        }
        s.orders[p.id] = Math.round(sum / 7 * (p.shelf ? 1.08 : 1.25));
    }
    const per = Sim.capacity({ ...s, staff: 0 });
    Sim.setStaff(s, Math.max(1, Math.ceil(maxT * 1.15 / per) - 1));
    if (s.cash > 3000000) s.campaign = s.week > 20 ? 'lottery' : 'flyer';
}

// むちゃ: 高い 設備を すぐ 買う・発注は 2 倍
function reckless(s) {
    for (const u of [...C.upgrades].sort((a, b) => b.cost - a.cost)) Sim.buyUpgrade(s, u.id);
    for (const p of C.products) if (Sim.available(s, p.id)) s.orders[p.id] = Sim.suggest(s, p.id) * 2;
    Sim.setStaff(s, 8);
    s.campaign = 'lottery';
}

function play(strategy, seed) {
    const s = Sim.newGame('テスト', seed);
    while (!s.over) { strategy(s); Sim.runWeek(s); }
    const rank = Sim.ranking(s).findIndex(x => x.me) + 1;
    return { s, rank };
}

module.exports = { idle, normal, good, reckless, play };

if (require.main === module) {
    for (const name of ['idle', 'normal', 'good', 'reckless']) {
        const ranks = [], totals = [], cash = [], reps = [];
        let bankrupt = 0;
        for (let i = 1; i <= 40; i++) {
            const { s, rank } = play(module.exports[name], i * 7919);
            ranks.push(rank); totals.push(s.total); cash.push(s.cash); reps.push(s.rep);
            if (s.over === 'bankrupt') bankrupt++;
        }
        const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
        const first = ranks.filter(r => r === 1).length;
        console.log(`${name.padEnd(9)} 1位 ${first}/40  平均順位 ${avg(ranks).toFixed(1)}  年間売上 ${(avg(totals) / 1e6).toFixed(0)}百万  資金 ${(avg(cash) / 1e6).toFixed(1)}百万  評判 ${avg(reps).toFixed(0)}  閉店 ${bankrupt}`);
    }
    const s = Sim.newGame('x', 1);
    while (!s.over) Sim.runWeek(s);
    console.log('ライバル', s.rivals.map(r => `${r.name} ${(r.total / 1e6).toFixed(0)}`).join(' / '));
}
