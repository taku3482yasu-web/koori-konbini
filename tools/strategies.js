// バランスを たしかめる ための 自動プレイ (tools/test.js から つかう)
const Sim = require('../js/sim.js');
const C = Sim.C;

// 人が ほしい ときは 募集 → 来た 応募者から やとう (prefer の 順)
function staffUp(s, want, prefer) {
    if (!want || s.staff.length >= C.maxStaff) return;
    const apps = s.applicants || [];
    const pick = prefer ? prefer.find(id => apps.includes(id)) || apps[0] : apps[0];
    if (pick) Sim.hire(s, pick);
    else Sim.recruit(s);
}
function autoOrder(s, mul = 1) {
    for (const p of C.products) if (Sim.available(s, p.id)) s.orders[p.id] = Math.round(Sim.suggest(s, p.id) * mul);
}
// 持ち場: いちばん 足りない ところが よく なる ように 1 人ずつ えらびなおす (レジ・品出し・検品・調理)
function assignRoles(s) {
    const shop = Sim.inShop(s);
    const need = Sim.estSlots(s);
    const sell = C.products.reduce((a, p) => a + (Sim.available(s, p.id) && !p.cook && !p.self ? Sim.dailyNeed(s, p.id) : 0), 0) * 1.1;
    const arrive = C.products.reduce((a, p) => a + (Sim.available(s, p.id) ? s.orders[p.id] || 0 : 0), 0);
    const cookNeed = C.products.reduce((a, p) => a + (Sim.available(s, p.id) && p.cook ? s.orders[p.id] || 0 : 0), 0);
    const tot = role => [0, 1, 2].reduce((a, t) => a + Sim.rolePower(s, t, role), 0);
    const score = () => Math.min(...[0, 1, 2].map(t => Sim.rolePower(s, t, 'register') / Math.max(1, need[t] * 1.05)),
        tot('stock') / Math.max(1, sell), tot('check') / Math.max(1, arrive), cookNeed ? tot('cook') / cookNeed : 9);
    for (let pass = 0; pass < 2; pass++) for (const m of shop) {
        let best = m.role, bs = -1;
        for (const role of Object.keys(C.roles)) { m.role = role; const v = score(); if (v > bs + 1e-9) { bs = v; best = role; } }
        m.role = best;
    }
}
// 手うすな コマに 人を 入れる (やる気が 下がりすぎない ように 2 コマ まで)
function coverSlots(s, slack) {
    const need = Sim.estSlots(s);
    for (const m of Sim.inShop(s)) m.slots = [0, 0, 0];
    for (let round = 0; round < 2; round++) {
        for (const m of Sim.inShop(s).sort((a, b) => b.mood - a.mood)) {
            if (m.slots.filter(Boolean).length > round) continue;
            const t = [0, 1, 2].filter(k => !m.slots[k]).sort((a, b) => Sim.slotCap(s, a) / need[a] - Sim.slotCap(s, b) / need[b])[0];
            if (Sim.slotCap(s, t) < need[t] * slack || round === 0) m.slots[t] = 1;
        }
    }
}

// 仕入れ値が 動いたら その ぶん 売り値も 動かす (2026-11-17: 自動プレイも 仕入れ値を 見て 売り値を 合わせる)
function followCost(s, base) {
    for (const p of C.products) Sim.setPrice(s, p.id, base(p) + (Sim.costOf(s, p.id) - p.cost));
}

// 何も しない
function idle() {}

// おまかせ: 毎週 目安で 発注・安い 施設から・足りない コマに 人を やとう
function normal(s) {
    followCost(s, p => p.price);
    autoOrder(s);
    // 目安プレイは よく ある 施設を 安い 順に (新しい 施設は つかわない)
    for (const f of C.facilities.filter(x => ['oden', 'wifi', 'fryer', 'coffee', 'atm', 'smoke', 'eatin', 'parking'].includes(x.id)).sort((a, b) => a.cost - b.cost)) if (s.cash > Sim.facCost(s, f.id) + 300000) Sim.buyFacility(s, f.id);
    const need = Sim.estSlots(s);
    staffUp(s, s.cash > 150000 && (s.staff.length < 3 || [0, 1, 2].some(t => Sim.slotCap(s, t) < need[t])));
    assignRoles(s);
    coverSlots(s, 1.0);
}

// じょうず: 地域に 合う 施設・ダンジョン・限定商品・連携・値段・天気を 見た 発注・はやめの 返済
const PLAN = {
    tsugaku: ['fryer', 'wifi', 'copy', 'eatin'],
    onga: ['parking', 'oden', 'fryer', 'atm'],
    kokura: ['coffee', 'smoke', 'eatin', 'atm']
};
function good(s) {
    const r = Sim.regionOf(s);
    // 手もとに のこす お金 = 1 週の 出費 + 月末の 返済 (これを 切る 買い物は しない)
    const reserve = Sim.wages(s) + Sim.rentOf(s) + Sim.upkeep(s) + (s.debt > 0 ? C.bank.pay + s.debt * s.rate : 0) + 100000;
    const recent = s.history.filter(h => !h.moved).slice(-2);
    const lastP = recent.length ? recent.reduce((a, h) => a + h.profit, 0) / recent.length : 0;
    for (const id of PLAN[r.id]) if (s.cash > Sim.facCost(s, id) + reserve && (lastP > 0 || !s.facilities.length)) Sim.buyFacility(s, id);
    // 値段: 高いと 買わない ラインの すこし 下
    followCost(s, p => p.price * Math.min(1.1, r.line));
    // 予報で 見つもって 発注
    const info = Sim.weekInfo(s.week);
    for (const p of C.products) {
        if (!Sim.available(s, p.id)) continue;
        const base = Sim.dailyNeed(s, p.id);
        let f = 0;
        for (let d = 0; d < 7; d++) {
            const fc = s.forecast[d];
            f += C.dayTraffic[d] * C.weather[fc.w].traffic * Sim.productFactor(s, p, fc.temp, fc.w, info.event) / Sim.productFactor(s, p, C.temp[info.mi], 'sun', info.event);
        }
        const last = s.history.length ? s.history[s.history.length - 1].products[p.id] : null;
        const fix = last && last.open ? 1 : 1;
        const day = base * fix * (f / 7);
        s.orders[p.id] = p.shelf ? Math.round(day * 1.05) : Math.max(0, Math.round(day + (day * C.keepDays - Sim.stockOf(s, p.id)) / 7));
    }
    const cookCap = [0, 1, 2].reduce((x, t) => x + Sim.rolePower(s, t, 'cook'), 0);
    const cooked = C.products.filter(p => p.cook && Sim.available(s, p.id));
    const cookWant = cooked.reduce((x, p) => x + s.orders[p.id], 0);
    if (cookWant > cookCap) for (const p of cooked) s.orders[p.id] = Math.round(s.orders[p.id] * cookCap / cookWant);
    s.markdown = 0.2;
    // スタッフ: 3 人 そろえる → 足りなければ 接客の 強い 人
    const want = ['tamu', 'dake', 'kotani', 'yamamou', 'ueno'];
    const need = Sim.estSlots(s);
    staffUp(s, (s.staff.length < 3 && s.cash > 150000) || s.cash > reserve && (s.staff.length < 3 || ([0, 1, 2].some(t => Sim.slotCap(s, t) < need[t] * 1.05) && lastP > 0)), want);
    // ダンジョン: 探索の 得意な 人を 1 人 (やる気が ある とき)
    const diver = s.staff.find(m => ['dake', 'ueno', 'yasu'].includes(m.id) && m.job === 'shop' && m.mood > 45 && !m.tired);
    if (diver && s.staff.length >= 4) Sim.sendDungeon(s, diver.id, s.week > 20 ? 'moon' : 'coast');
    assignRoles(s);
    coverSlots(s, 1.1);
    // アイテム・限定商品
    for (const k of ['maneki', 'hieishi']) if (s.items[k] && !s.effects[k]) Sim.useItem(s, k);
    if (s.items.genki && s.staff.some(m => m.mood < 40)) Sim.useItem(s, 'genki');
    for (const rc of [...C.recipes].reverse()) while (Sim.craftable(s, rc.id) && (s.craft[rc.id] || 0) < 3) Sim.addCraft(s, rc.id, 1);
    // 連携と 返済
    Sim.setPartner(s, 'ad', s.cash > 600000 && s.facilities.length >= 3 && lastP > 100000);
    Sim.setPartner(s, 'farm', s.cash > 400000 && lastP > 50000);
    if (info.event && s.cash > reserve + 300000) Sim.bookEvent(s, 5);
    if (s.cash > reserve + 500000) Sim.repay(s, s.cash - reserve - 300000);
}

// むちゃ: 借りられる だけ 借りて ぜんぶ 買う・やとう
function reckless(s) {
    while (Sim.borrow(s));
    for (const f of [...C.facilities].sort((a, b) => b.cost - a.cost)) Sim.buyFacility(s, f.id);
    for (const id of [...(s.applicants || [])]) Sim.hire(s, id);
    Sim.recruit(s);
    for (const m of Sim.inShop(s)) m.slots = [1, 1, 1];
    autoOrder(s, 2);
    for (const p of C.products) s.prices[p.id] = Math.round(p.price * 0.7 / 10) * 10;
}

function play(strategy, seed, region, diff, mode, weeks) {
    const s = Sim.newGame('テスト', seed, region, diff, mode);
    let reports = 0;
    while (!s.over && !(weeks && s.week >= weeks)) { strategy(s); Sim.runWeek(s); reports++; }
    const rank = Sim.ranking(s).findIndex(x => x.me) + 1;
    return { s, rank, clearWeek: s.over === 'clear' ? s.week : null };
}

module.exports = { idle, normal, good, reckless, play };

if (require.main === module) {
    const N = Number(process.argv[2]) || 30;
    for (const region of C.regions.map(r => r.id)) {
        for (const name of ['idle', 'normal', 'good', 'reckless']) {
            const res = { clear: 0, normal: 0, bad: 0, weeks: [], rank: 0, debt: 0, cash: 0, rep: 0, sales: 0 };
            for (let i = 1; i <= N; i++) {
                const { s, rank, clearWeek } = play(module.exports[name], i * 7919, region);
                res[s.over]++;
                if (clearWeek) res.weeks.push(clearWeek);
                res.rank += rank / N; res.debt += s.debt / N; res.cash += s.cash / N; res.rep += s.rep / N;
                res.sales += s.history.filter(h => !h.moved).slice(-4).reduce((a, h) => a + h.sales, 0) / 4 / N;
            }
            const wk = res.weeks.length ? `第${Math.round(res.weeks.reduce((a, b) => a + b, 0) / res.weeks.length)}週` : '-';
            console.log(`${region.padEnd(8)}${name.padEnd(9)} クリア ${res.clear}/${N} (平均 ${wk}) ふつう ${res.normal} 借金のこり ${res.bad}  順位 ${res.rank.toFixed(1)}  最後の週売上 ${(res.sales / 1e4).toFixed(0)}万  借金 ${(res.debt / 1e4).toFixed(0)}万  資金 ${(res.cash / 1e4).toFixed(0)}万  評判 ${res.rep.toFixed(0)}`);
        }
    }
    const s = Sim.newGame('x', 1, 'tsugaku');
    while (!s.over) Sim.runWeek(s);
    console.log('ライバル 最後の 点', Sim.ranking(s).map(r => `${r.name} ${r.score}`).join(' / '));
}
