// こおりくんのコンビニ（仮） — テスト (node tools/test.js)
const Sim = require('../js/sim.js');
const St = require('./strategies.js');
const C = Sim.C;
let ok = 0, ng = 0;
function check(name, cond, info = '') { if (cond) ok++; else { ng++; console.log(`✗ ${name} ${info}`); } }
const fresh = (region = 'onga', seed = 1) => Sim.newGame('t', seed, region);
const runN = (s, n, f) => { for (let i = 0; i < n && !s.over; i++) { if (f) f(s); Sim.runWeek(s); } };
const orderAll = s => { for (const p of C.products) if (Sim.available(s, p.id)) s.orders[p.id] = Sim.suggest(s, p.id); };
const freshO = (region, seed) => { const s = fresh(region, seed); orderAll(s); return s; };

// おなじ たねなら おなじ 結果・セーブから 続けても 同じ
{
    const a = St.play(St.good, 42, 'kokura').s, b = St.play(St.good, 42, 'kokura').s;
    check('おなじ たねで おなじ 結果', a.cash === b.cash && a.week === b.week);
    const s1 = fresh();
    runN(s1, 10, St.normal);
    const s2 = JSON.parse(JSON.stringify(s1));
    St.normal(s1); St.normal(s2);
    check('セーブして つづけても 同じ', Sim.runWeek(s1).sales === Sim.runWeek(s2).sales);
}
// 数が こわれない・52 週で おわる
for (const region of C.regions.map(r => r.id)) {
    const { s } = St.play(St.normal, 3, region);
    check(`${region}: 数が NaN に ならない`, s.history.every(h => h.moved || (Number.isFinite(h.sales) && Number.isFinite(h.profit) && Number.isFinite(h.rep))));
    check(`${region}: 52 週 か クリアで おわる`, (s.week === C.weeks && ['normal', 'bad'].includes(s.over)) || s.over === 'clear', `week=${s.week} over=${s.over}`);
}
// こよみ
check('第 1 週は 4/1', Sim.weekInfo(0).start.month === 4 && Sim.weekInfo(0).start.date === 1);
check('4/29〜5/5 の 週で 4 月が おわる', Sim.monthEnds(4) && !Sim.monthEnds(3));

// 消費期限・値下げ・子ども食堂
{
    const s = freshO(); s.orders.onigiri = 2000;
    const r = Sim.runWeek(s);
    check('多すぎる おにぎりは 廃棄', r.products.onigiri.waste > 5000, r.products.onigiri.waste);
    const k = freshO(); k.orders.onigiri = 2000; k.kids = true;
    const rk = Sim.runWeek(k);
    check('子ども食堂に 回すと 廃棄 0', rk.products.onigiri.waste === 0 && rk.products.onigiri.kids > 5000);
    check('子ども食堂で 評判が 上がる', rk.repAfter > r.repAfter);
    const m = freshO(); m.orders.onigiri = 2000; m.markdown = 0.4;
    check('値下げで 期限 今日までの 商品が 売れる', Sim.runWeek(m).products.onigiri.marked > 1000);
    const z = freshO(); z.orders.onigiri = 0;
    check('おにぎり 0 なら 品切れ', Sim.runWeek(z).products.onigiri.lost > 300);
}
// 値段: 高いと 売れない・地域で ラインが ちがう
{
    const a = freshO('tsugaku'), b = freshO('tsugaku');
    b.prices.drink = 220; a.orders.drink = b.orders.drink = 900;
    check('高いと 売れない', Sim.runWeek(b).products.drink.sold < Sim.runWeek(a).products.drink.sold * 0.6);
    const k1 = fresh('kokura'), t1 = fresh('tsugaku');
    check('小倉駅前は 高くても 買う', Sim.priceF('worker', 1.15, Sim.regionOf(k1).line) > Sim.priceF('worker', 1.15, Sim.regionOf(t1).line));
}
// 地域の 好みは 売ると 分かる
{
    const s = fresh('kokura');
    check('はじめは 好みが 分からない', Sim.knownPref(s, 'bento') === null);
    runN(s, C.knowWeeks, orderAll);
    check(`${C.knowWeeks} 週 売ると 分かる`, Sim.knownPref(s, 'bento') === 'up', Sim.knownPref(s, 'bento'));
}
// 施設は 4 つ まで
{
    const s = fresh(); s.cash = 1e8;
    for (const f of C.facilities) Sim.buyFacility(s, f.id);
    check('施設は 床の あいて いる マス まで', s.facilities.length === Sim.floorCap(s) - 8 && Sim.floorUsed(s) === Sim.floorCap(s));
    check('駐車場は 駅前で 高い', Sim.facCost(fresh('kokura'), 'parking') > Sim.facCost(fresh('onga'), 'parking') * 3);
    const n = fresh(); n.cash = 1e8; Sim.buyFacility(n, 'coffee'); orderAll(n);
    check('コーヒーマシンで コーヒーが 売れる', Sim.available(n, 'coffee') && Sim.runWeek(n).products.coffee.sold > 0);
}
// おにおにバンク
{
    const s = fresh();
    let first = null;
    for (let i = 0; i < 5; i++) { orderAll(s); const r = Sim.runWeek(s); if (r.month) first = r.month; }
    check('最初の 1 か月は つけ', first && first.grace && s.debt === C.bank.debt);
    const p = fresh(); p.cash = 1e7;
    let second = null;
    for (let i = 0; i < 9; i++) { const r = Sim.runWeek(p); if (r.month && !r.month.grace) { second = r.month; break; } }
    check('2 か月目から 返す (利息つき)', second && second.paid === C.bank.pay + second.interest && second.interest > 0, JSON.stringify(second));
    const q = fresh();
    let miss = null;
    for (let i = 0; i < 10 && !miss; i++) { q.cash = -1e6; const r = Sim.runWeek(q); if (r.month && r.month.missed) miss = r.month; }
    check('払えないと おにおにが 居座る', miss && q.occupy > 0);
    const b = fresh(); const r0 = b.rate; Sim.borrow(b);
    check('追加で 借りると 利息が 上がる', b.rate > r0 && b.debt === C.bank.debt + C.bank.borrow);
}
// 棚の 追加・撤去 (2026-11-17 ユーザー指定)
{
    const s = fresh(); s.cash = 1e7;
    const cap0 = Sim.capOf(s, Sim.product('onigiri'));
    check('棚を ふやすと ならべられる 数が ふえる', Sim.addShelf(s, 'onigiri') && Sim.capOf(s, Sim.product('onigiri')) === cap0 * 2 && Sim.floorUsed(s) === 9);
    s.stock.snack = [{ q: 150, age: 0 }];
    const cash0 = s.cash;
    check('棚を 撤去すると お金が 少し もどり、商品は 倉庫へ', Sim.removeShelf(s, 'snack') && s.cash > cash0 && s.ware.snack.reduce((a, b) => a + b.q, 0) === 150 && !Sim.available(s, 'snack'));
    check('棚が ない 商品は 発注できない', s.orders.snack === 0);
    for (const id of ['bread', 'daily']) Sim.removeShelf(s, id);
    for (const f of C.facilities) Sim.buyFacility(s, f.id);
    check('棚を 撤去すると 施設を 多く 置ける', s.facilities.length === Sim.facCap(s), s.facilities.length);
    check('コーヒーは 棚が いらない', Sim.available(s, 'coffee') || !Sim.hasFac(s, 'coffee'));
}
// 季節の レアスタッフ (2026-11-17 ユーザー指定)
{
    const rares = C.staff.filter(d => d.rare);
    check('レアスタッフが いる', rares.length >= 6);
    check('レアは 給料が 高く 能力も 高い', rares.every(d => d.pay > Math.max(...C.staff.filter(x => !x.rare).map(x => x.pay)) && d.st.reduce((a, b) => a + b, 0) > 18));
    // 7 月に 募集すると (たまに) カキゴーラが 来る・ほかの 季節の レアは 来ない
    let met = 0, wrong = 0;
    for (let seed = 1; seed <= 30; seed++) {
        const s = fresh('onga', seed); s.cash = 1e7; s.week = 13; Sim.prepareWeek(s);
        Sim.recruit(s); Sim.runWeek(s);
        const month = Sim.weekInfo(s.week).start.month;
        if (s.applicants.includes('kakigoora')) met++;
        if (s.applicants.some(id => { const d = Sim.staffDef(id); return d.rare && !d.rare.months.includes(month); })) wrong++;
    }
    check('夏に 募集すると カキゴーラが 来る ことが ある', met > 5, met);
    check('季節が ちがう レアは 来ない', wrong === 0, wrong);
    const s = freshO('onga', 2); s.cash = 1e7; s.applicants = ['kakigoora'];
    const base = Sim.productFactor(s, Sim.product('ice'), 28, 'sun', null);
    Sim.hire(s, 'kakigoora');
    check('レアが 店に いると 得意な 商品が 売れる', Sim.productFactor(s, Sim.product('ice'), 28, 'sun', null) > base * 1.3);
    check('やとった レアは 記録に のこる', s.everHired.includes('kakigoora'));
    check('スタッフを 解雇できる (店長は できない)', Sim.fire(s, 'kakigoora') && !s.staff.some(m => m.id === 'kakigoora') && !Sim.fire(s, 'koori'));
}
// エンドレス・店を 大きく・棚の 種類・商品と 施設と 連携 (2026-11-17 ユーザー指定)
{
    const { s } = St.play(St.normal, 11, 'onga', 'normal', 'endless', 120);
    check('エンドレスは 52 週を こえて つづく', s.week === 120 && !s.over, `week=${s.week} over=${s.over}`);
    check('エンドレスの こよみは 1 年で もどる', Sim.weekInfo(52).start.month === 4 && Sim.weekInfo(52).start.date === 1 && Sim.yearOf(52) === 2);
    check('エンドレスでも 行事は 毎年 ある', Sim.weekInfo(52 + 4).event && Sim.weekInfo(52 + 4).event.name === Sim.weekInfo(4).event.name);
    check('エンドレスでも 数が こわれない', s.history.every(h => h.moved || Number.isFinite(h.sales)));
    const c = St.play(St.good, 3, 'kokura', 'normal', 'endless', 60).s;
    check('エンドレスは 1 位に なっても おわらない', !c.over);
    const top = w => { const x = Sim.newGame('t', 1, 'onga', 'normal', 'endless'); x.week = w; Sim.runWeek(x); return x.rivals[0].sales[0]; };
    check('エンドレスの 2 年目 から ライバルの のびは ゆっくり', (top(156) - top(52)) < (top(52) - top(0)));

    const e = fresh(); e.cash = 1e8; e.rep = 30;
    check('評判が 足りないと 店を 大きく できない', !Sim.expandStore(e));
    e.rep = 95; e.cash = 100000;
    check('お金が 足りないと 店を 大きく できない', !Sim.expandStore(e));
    e.cash = 1e8; const f0 = Sim.floorCap(e), r0 = Sim.rentOf(e);
    check('お金と 評判が あれば 店を 大きく できる', Sim.expandStore(e) && Sim.floorCap(e) > f0 && Sim.rentOf(e) > r0 && Sim.levelOf(e).traffic > 1);
    while (Sim.expandStore(e));
    check(`店は ${C.storeLevels.length} だんかいまで`, e.storeLv === C.storeLevels.length - 1);

    check('棚の 種類が 分かれて いる (アイスは 冷凍・ドリンクは 飲料ケース)', Sim.product('ice').type === 'freezer' && Sim.product('drink').type === 'drinkcase' && Sim.product('frozen').type === 'freezer');
    const t = fresh(); t.cash = 1e7; const c0 = t.cash;
    Sim.addShelf(t, 'magazine');
    const rackCost = c0 - t.cash; const c1 = t.cash;
    Sim.addShelf(t, 'frozen');
    check('棚の 種類で 値段が ちがう', rackCost === C.shelfTypes.rack.cost && c1 - t.cash === C.shelfTypes.freezer.cost);
    check('冷蔵・冷凍の 棚は 電気代が かかる', Sim.shelfUpkeep(t) > Sim.shelfUpkeep(fresh()));
    check('コンビニの 商品が ひと通り ある', ['newspaper', 'magazine', 'clothing', 'cosme', 'stationery', 'frozen', 'sweets', 'cupnoodle', 'nikuman', 'giftcard'].every(id => Sim.product(id)) && C.products.length >= 25);
    const n = freshO('onga', 4); n.cash = 1e7;
    for (const id of ['bread', 'daily']) Sim.removeShelf(n, id);
    Sim.addShelf(n, 'newspaper'); Sim.addShelf(n, 'cosme'); orderAll(n);
    const rn = Sim.runWeek(n);
    check('新しい 商品も 棚を 置けば 売れる', rn.products.newspaper.sold > 0 && rn.products.cosme.sold > 0);
    check('施設が ふえた', ['steamer', 'copy', 'locker', 'toilet', 'bakery', 'ev', 'kids', 'ticket'].every(id => Sim.facility(id)));
    const k = fresh(); k.cash = 1e7; Sim.buyFacility(k, 'steamer');
    check('中華まんスチーマーで 中華まんが 売れる', Sim.available(k, 'nikuman'));
    check('業務連携の 会社が ふえた', ['fishery', 'logistics', 'delivery', 'cleaning', 'staffing', 'gacha'].every(id => Sim.partner(id)));
    const l = freshO('onga', 5), l2 = freshO('onga', 5);
    Sim.setPartner(l2, 'logistics', true); Sim.setPartner(l2, 'staffing', true);
    check('運輸と 連携すると 検品が はやい', Sim.runWeek(l2).work.checkCap[0] > Sim.runWeek(l).work.checkCap[0]);
    check('人材派遣で レジが ふえる', Sim.slotCap(l2, 0) > Sim.slotCap(l, 0));
    const u = fresh(); Sim.setPartner(u, 'fishery', true); runN(u, 2);
    check('漁協と 連携すると 海の さちが とどく', u.mats.umi >= 2);
    const old = JSON.parse(JSON.stringify(fresh())); delete old.storeLv; delete old.mode; delete old.stock.cosme; delete old.shelves;
    Sim.migrate(old);
    check('古い セーブも 読める', old.storeLv === 0 && old.mode === 'year' && Array.isArray(old.stock.cosme) && old.shelves.onigiri === 1);
}
// 難易度
{
    const e = Sim.newGame('t', 1, 'onga', 'easy'), h = Sim.newGame('t', 1, 'onga', 'hard'), x = Sim.newGame('t', 1, 'onga');
    check('難易度で はじめの 手持ちと 利息が かわる', e.cash > x.cash && x.cash > h.cash && e.rate < h.rate);
    check('難易度で ライバルの 強さが かわる', Sim.ranking(e).find(r => !r.me).score < Sim.ranking(h).find(r => !r.me).score);
    check('難易度を 指定しないと ふつう', x.difficulty === 'normal');
}
// 発注・倉庫・持ち場 (2026-11-17 ユーザー指定)
{
    const s = fresh();
    const r = Sim.runWeek(s);
    check('発注しないと 何も とどかない', Object.values(r.products).every(x => x.ordered === 0 && x.sold === 0));
    const f = fresh(); f.orders.drink = 3000;
    const rf = Sim.runWeek(f);
    check('倉庫が いっぱいだと 受け取れない', rf.products.drink.refused > 0 && Sim.wareUse(f) <= Sim.wareCap(f));
    const e = fresh(); e.cash = 1e7; const c0 = Sim.wareCap(e), u0 = Sim.upkeep(e);
    check('倉庫を 広げられる (設備代も ふえる)', Sim.expandWare(e) && Sim.wareCap(e) === c0 + C.warehouse.add && Sim.upkeep(e) === u0 + C.warehouse.upkeep);
    // 品出し 係が いると 棚に たくさん 出せる
    const mk = role => { const x = freshO('onga', 3); x.staff.forEach(m => { m.slots = [1, 1, 0]; m.role = 'register'; }); x.staff[1].role = role; return x; };
    const st1 = Sim.runWeek(mk('stock')).work, st0 = Sim.runWeek(mk('register')).work;
    check('品出しの 持ち場に 置くと 品出しの 量が ふえる', st1.stockCap[0] > st0.stockCap[0]);
    const cap1 = Sim.slotCap(mk('register'), 0), cap0 = Sim.slotCap(mk('stock'), 0);
    check('レジの 持ち場に 置くと さばける 客が ふえる', cap1 > cap0);
    const t = fresh(); check('持ち場は 自分で きめられる', Sim.setRole(t, 'yasu', 'check') && t.staff[1].role === 'check');
    check('はじめの 持ち場は 得意な ところ', Sim.bestRole('ishii') === 'check' && Sim.bestRole('kotani') === 'register');
    const n = freshO(); n.staff.forEach(m => { m.slots = [1, 0, 0]; });
    const rn = Sim.runWeek(n);
    check('人が いない コマは 品出し できない', rn.work.stock[1] === 0 && rn.work.stock[2] === 0);
}
// スタッフと ダンジョン
{
    const r0 = fresh(); r0.cash = 1e7;
    check('応募が ないと やとえない', !Sim.hire(r0, 'dake'));
    check('アルバイトを 募集できる', Sim.recruit(r0) && r0.cash === 1e7 - C.recruit.cost);
    Sim.runWeek(r0);
    check('募集の つぎの 週に 応募が 来る', r0.applicants.length >= C.recruit.min && r0.applicants.every(id => !Sim.staffDef(id).boss));
    const app = r0.applicants[0];
    check('応募者を やとえる', Sim.hire(r0, app) && r0.staff.some(m => m.id === app));
    const rest = [...r0.applicants];
    Sim.runWeek(r0);
    check('やとわなかった 応募者は いなくなる', rest.every(id => !r0.applicants.includes(id)));
    const pw = fresh();
    const rp = Sim.runWeek(pw);
    check('給料 = 時給 × 時間', rp.wages === Sim.staffDef('yasu').pay * C.hoursPerSlot * 7 * 2, rp.wages);
    const up = fresh(); up.cash = 1e7; Sim.buyFacility(up, 'coffee');
    const ru = Sim.runWeek(up);
    check('設備代を 毎週 はらう', ru.upkeep === C.baseUpkeep + Sim.shelfUpkeep(up) + Sim.facility('coffee').upkeep && ru.profit === ru.sales - ru.buy - ru.limitedCost - ru.wages - ru.rent - ru.upkeep - ru.royalty - ru.fees);
    const s = fresh(); s.cash = 1e7; s.applicants = ['dake'];
    Sim.hire(s, 'dake');
    check('やとえる', s.staff.length === 3);
    Sim.sendDungeon(s, 'dake', 'coast');
    Sim.runWeek(s);
    check('ダンジョンの あいだは 店に いない', s.staff.find(m => m.id === 'dake').job === 'dungeon');
    const before = s.mats.umi + s.mats.kinoko;
    Sim.runWeek(s);
    const dake = s.staff.find(m => m.id === 'dake');
    check('2 週で 帰って 報酬を 持って くる', dake.job === 'shop' && s.mats.umi + s.mats.kinoko > before);
    check('帰ると つかれて いる', dake.tired && Sim.stats(s, dake)[0] < Sim.staffDef('dake').st[0]);
    check('店長は ダンジョンに 行かない', !Sim.sendDungeon(s, 'koori', 'forest'));
    const w = fresh(); w.staff.forEach(m => { m.slots = [1, 1, 1]; });
    const m0 = w.staff[1].mood; Sim.runWeek(w);
    check('3 コマは 働きすぎで やる気が 下がる', w.staff[1].mood < m0);
    const t = fresh(); t.cash = 1e7; t.applicants = ['tamu', 'dake']; ['tamu', 'dake'].forEach(id => Sim.hire(t, id));
    check('やす・たむ・だけ が そろうと 連携ボーナス', Sim.trioOn(t) && Sim.stats(t, t.staff.find(m => m.id === 'tamu'))[1] === Sim.staffDef('tamu').st[1] + 1);
}
// 限定商品・連携・移転
{
    const s = fresh(); s.mats.local = 2;
    Sim.addCraft(s, 'localBento', 1);
    const r = Sim.runWeek(s);
    check('特産品で 限定弁当を 作って 売れる', r.limited.localBento && r.limited.localBento.sold > 0 && s.mats.local >= 1);
    check('材料が ないと 作れない', !Sim.addCraft(fresh(), 'kaisenBento', 1));
    const p = fresh(); Sim.setPartner(p, 'farm', true);
    const l0 = p.mats.local; runN(p, 2);
    check('農場と 連携すると 特産品が ふえる', p.mats.local - l0 >= 4);
    const m = fresh(); m.cash = 1e7; m.regulars = 100;
    check('移転できる (常連は へる)', Sim.relocate(m, 'kokura') && m.region === 'kokura' && m.regulars === 20);
}
// バランス (自動プレイ・難易度ごと)
{
    const N = 20, all = {};
    for (const diff of Object.keys(C.difficulties)) {
        const res = all[diff] = {};
        for (const name of diff === 'normal' ? ['idle', 'normal', 'good', 'reckless'] : ['normal', 'good']) {
            const r = { clear: 0, normal: 0, bad: 0, n: 0, weeks: [], regions: {} };
            for (const region of C.regions.map(x => x.id)) for (let i = 1; i <= N; i++) {
                const { s } = St.play(St[name], i * 7919, region, diff);
                r[s.over]++; r.n++;
                if (s.over === 'clear') { r.weeks.push(s.week); r.regions[region] = (r.regions[region] || 0) + 1; }
            }
            res[name] = r;
        }
        console.log(`[${C.difficulties[diff].name}] ` + Object.entries(res).map(([k, v]) => `${k}: クリア ${v.clear}/${v.n}${v.weeks.length ? ` (平均 第${Math.round(v.weeks.reduce((a, b) => a + b, 0) / v.weeks.length)}週)` : ''} 返済 ${v.normal} 返せず ${v.bad}`).join(' / '));
    }
    const avgW = r => r.weeks.reduce((a, b) => a + b, 0) / Math.max(1, r.weeks.length);
    const n = all.normal, e = all.easy, h = all.hard;
    // ふつう
    check('ふつう: 何も しないと クリア できない', n.idle.clear === 0 && n.idle.bad === n.idle.n);
    check('ふつう: 目安 だけでは クリアは むずかしい (1 割 以下)', n.normal.clear <= n.normal.n * 0.1, n.normal.clear);
    check('ふつう: 目安 だけでも 借金は 返せる (9 割 以上)', n.normal.normal + n.normal.clear >= n.normal.n * 0.9, n.normal.normal);
    check('ふつう: 工夫すれば クリア できる (3〜6 割)', n.good.clear >= n.good.n * 0.3 && n.good.clear <= n.good.n * 0.6, n.good.clear);
    check('ふつう: クリアは 後半 (平均 第 24 週 より あと)', avgW(n.good) > 24, avgW(n.good));
    check('ふつう: どの 地域でも 工夫すれば クリア できる', C.regions.every(r => (n.good.regions[r.id] || 0) >= 3), JSON.stringify(n.good.regions));
    check('ふつう: むちゃな 借金は 返せない', n.reckless.bad >= n.reckless.n * 0.8, n.reckless.bad);
    // やさしい・むずかしい
    check('やさしい: 目安 だけでも ときどき クリア できる', e.normal.clear >= e.normal.n * 0.2, e.normal.clear);
    check('やさしい: 工夫すれば たいてい クリア (6 割 以上)', e.good.clear >= e.good.n * 0.6, e.good.clear);
    check('むずかしい: 目安 だけでは クリア できない', h.normal.clear === 0, h.normal.clear);
    check('むずかしい: 工夫しても ふつうより クリアしにくい', h.good.clear < n.good.clear && h.good.clear > 0, h.good.clear);
}
console.log(`${ok} / ${ok + ng} 成功`);
process.exit(ng ? 1 : 0);
