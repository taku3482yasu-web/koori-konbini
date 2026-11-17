// こおりくんの コンビニ物語 — テスト (node tools/test.js)
const Sim = require('../js/sim.js');
const St = require('./strategies.js');
const C = Sim.C;
let ok = 0, ng = 0;
function check(name, cond, info = '') { if (cond) ok++; else { ng++; console.log(`✗ ${name} ${info}`); } }

// おなじ たねなら おなじ 結果 (セーブから つづけても かわらない)
{
    const a = St.play(St.good, 42).s, b = St.play(St.good, 42).s;
    check('おなじ たねで おなじ 結果', a.total === b.total && a.cash === b.cash);
    const s1 = Sim.newGame('x', 9);
    for (let i = 0; i < 10; i++) { St.normal(s1); Sim.runWeek(s1); }
    const s2 = JSON.parse(JSON.stringify(s1));
    St.normal(s1); St.normal(s2);
    check('セーブして つづけても 同じ', Sim.runWeek(s1).sales === Sim.runWeek(s2).sales);
}
// 数が こわれない
{
    const { s } = St.play(St.good, 3);
    const bad = s.history.find(h => !Number.isFinite(h.sales) || !Number.isFinite(h.profit) || !Number.isFinite(h.rep));
    check('数が NaN に ならない', !bad);
    check('52 週で おわる', s.week === C.weeks && s.over === 'end', `week=${s.week} over=${s.over}`);
    check('評判は 0〜100', s.history.every(h => h.rep >= 0 && h.rep <= 100));
}
// こよみ
{
    check('第 1 週は 4/1', Sim.weekInfo(0).start.month === 4 && Sim.weekInfo(0).start.date === 1);
    const last = Sim.weekInfo(51).end;
    check('第 52 週は 3 月末', last.month === 3 && last.date === 30, `${last.month}/${last.date}`);
}
// 廃棄: おにぎりを 多く 入れると 捨てる
{
    const s = Sim.newGame('x', 1);
    s.orders.onigiri = 5000;
    const r = Sim.runWeek(s);
    check('多すぎる おにぎりは 廃棄', r.products.onigiri.waste > 20000, r.products.onigiri.waste);
    const s2 = Sim.newGame('x', 1);
    s2.orders.onigiri = 0;
    check('おにぎり 0 なら 売り逃し', Sim.runWeek(s2).products.onigiri.lost > 1000);
}
// バランス (40 回 ずつ)
{
    const N = 40, res = {};
    for (const name of ['idle', 'normal', 'good', 'reckless']) {
        const r = { first: 0, bankrupt: 0, rank: 0 };
        for (let i = 1; i <= N; i++) { const { s, rank } = St.play(St[name], i * 7919); if (rank === 1) r.first++; if (s.over === 'bankrupt') r.bankrupt++; r.rank += rank / N; }
        res[name] = r;
    }
    console.log(Object.entries(res).map(([k, v]) => `${k}: 1位 ${v.first}/${N} 平均 ${v.rank.toFixed(1)} 位 閉店 ${v.bankrupt}`).join('\n'));
    check('何も しないと 1 位に なれない', res.idle.first === 0);
    check('おまかせ だけでは 1 位は むずかしい (半分 以下)', res.normal.first <= N / 2, res.normal.first);
    check('天気と 行事を 見て がんばれば 1 位に なれる (7 割 以上)', res.good.first >= N * 0.7, res.good.first);
    check('むちゃな 買いかたは 閉店', res.reckless.bankrupt >= N * 0.8, res.reckless.bankrupt);
}
console.log(`${ok} / ${ok + ng} 成功`);
process.exit(ng ? 1 : 0);
