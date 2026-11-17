// こおりくんのコンビニ（仮） — テスト (node tools/test.js)
const Sim = require('../js/sim.js');
const St = require('./strategies.js');
const C = Sim.C;
let ok = 0, ng = 0;
function check(name, cond, info = '') { if (cond) ok++; else { ng++; console.log(`✗ ${name} ${info}`); } }
const fresh = (region = 'onga', seed = 1) => Sim.newGame('t', seed, region);
const runN = (s, n, f) => { for (let i = 0; i < n && !s.over; i++) { if (f) f(s); Sim.runWeek(s); } };
const orderAll = s => { for (const p of C.products) if (Sim.available(s, p.id)) for (const k of Sim.pickSkus(s, p.id)) s.orders[k.id] = Sim.suggest(s, k.id); };
const SAKE = 'onigiri.sake', TEA = 'drink.tea', KARA = 'bento.karaage';
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
    const s = freshO(); s.orders[SAKE] = 2000;
    const r = Sim.runWeek(s);
    check('多すぎる おにぎりは 廃棄', r.products[SAKE].waste > 5000, r.products[SAKE].waste);
    const k = freshO(); k.orders[SAKE] = 2000; k.kids = true;
    const rk = Sim.runWeek(k);
    check('子ども食堂に 回すと 廃棄 0', rk.products[SAKE].waste === 0 && rk.products[SAKE].kids > 5000);
    check('子ども食堂で 評判が 上がる', rk.repAfter > r.repAfter);
    const m = freshO(); m.orders[SAKE] = 2000; m.markdown = 0.4;
    check('値下げで 期限 今日までの 商品が 売れる', Sim.runWeek(m).products[SAKE].marked > 1000);
    const z = freshO(); for (const x of Sim.skusOf('onigiri')) z.orders[x.id] = 0;
    check('おにぎり 0 なら 品切れ', Sim.runWeek(z).groups.onigiri.lost > 300);
}
// 値段: 高いと 売れない・地域で ラインが ちがう
{
    const a = freshO('tsugaku'), b = freshO('tsugaku');
    b.prices[TEA] = 220; a.orders[TEA] = b.orders[TEA] = 900;
    check('高いと 売れない', Sim.runWeek(b).products[TEA].sold < Sim.runWeek(a).products[TEA].sold * 0.6);
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
    s.stock['snack.potechi'] = [{ q: 150, age: 0 }];
    const cash0 = s.cash;
    check('棚を 撤去すると お金が 少し もどり、商品は 倉庫へ', Sim.removeShelf(s, 'snack') && s.cash > cash0 && s.ware['snack.potechi'].reduce((a, b) => a + b.q, 0) === 150 && !Sim.available(s, 'snack'));
    check('棚が ない 商品は 発注できない', Sim.skusOf('snack').every(x => s.orders[x.id] === 0) && !Sim.available(s, 'snack.potechi'));
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
// 仕入れ値の 変動 (2026-11-17 ユーザー決定)
{
    const s = fresh('onga', 3);
    check('はじめの 週は 元の 仕入れ値 (季節・行事の ぶん だけ)', C.skus.every(p => s.costWhy[p.id] || Sim.costOf(s, p.id) === p.cost));
    let moved = 0, inside = true, summerIce = 0, springIce = 0;
    for (let w = 0; w < 52; w++) {
        orderAll(s); Sim.runWeek(s);
        if (s.over) break;
        for (const p of C.skus) { const c = s.costNow[p.id]; if (c !== p.cost) moved++; if (c > p.cost * 1.25 + 1 || c < p.cost * 0.75 - 1) inside = false; }
        const m = Sim.weekInfo(s.week).start.month;
        if (m === 8) summerIce += s.costNow['ice.vanilla'] / Sim.sku('ice.vanilla').cost; if (m === 5) springIce += s.costNow['ice.vanilla'] / Sim.sku('ice.vanilla').cost;
    }
    check('仕入れ値は 週ごとに 動く', moved > 100, moved);
    check('仕入れ値は 元から ±25% の 中', inside);
    check('夏は アイスの 仕入れが 上がる', summerIce / 4 > springIce / 4, `${summerIce} ${springIce}`);
    const a = fresh('onga', 5), b = fresh('onga', 5);
    Sim.setPartner(b, 'farm', true);
    check('農場と 組むと お米と 野菜の 仕入れが 下がる', Sim.costOf(b, 'salad') < Sim.costOf(a, 'salad') && Sim.costOf(b, TEA) === Sim.costOf(a, TEA));
    b.partners.farm.trust = 10;
    check('信頼度で もっと 下がる', Sim.costOf(b, 'salad') <= Math.round(Sim.costOf(a, 'salad') * (1 - 0.1 * 1.1)) + 1);
    const o = freshO('onga', 6); const c0 = Sim.costOf(o, SAKE); const r = Sim.runWeek(o);
    check('仕入れ値は 発注した 週の 値で きまる', r.products[SAKE].cost === r.products[SAKE].ordered * c0);
    const p0 = o.prices[SAKE]; o.costNow[SAKE] = 200;
    check('仕入れが 上がっても 売り値は 自動で 変わらない', o.prices[SAKE] === p0 && Sim.marginOf(o, SAKE).yen < 0);
    Sim.setPrice(o, KARA, Sim.priceForMargin(o, KARA, 0.4));
    check('もうけ ○% の 売り値', Math.abs(Sim.marginOf(o, KARA).rate - 0.4) < 0.03, Sim.marginOf(o, KARA).rate);
    const old = JSON.parse(JSON.stringify(fresh())); delete old.costNow;
    check('古い セーブにも 仕入れ値が 入る', Sim.migrate(old).costNow[SAKE] === Sim.sku(SAKE).cost);
}
// 1 日ずつ・コマずつ 進める (2026-11-17 ユーザー決定: 指示書 10-2 案B)
{
    const a = freshO('kokura', 8), b = JSON.parse(JSON.stringify(a));
    const ra = Sim.runWeek(a);
    Sim.beginWeek(b);
    let days = 0;
    while (b.wk.d < 7) { Sim.runDay(b); days++; }
    const rb = Sim.finishWeek(b);
    check('1 日ずつ 進めても 1 週間 まとめて と 同じ', days === 7 && ra.sales === rb.sales && a.cash === b.cash && a.rs === b.rs);
    check('コマは 21', rb.slots.length === Sim.SLOTS && rb.slots.every((x, i) => x.k === i));
    const c = freshO('kokura', 8);
    Sim.beginWeek(c); for (let i = 0; i < 10; i++) Sim.runSlot(c);
    const c2 = JSON.parse(JSON.stringify(c));
    check('営業の 途中で セーブしても 同じ 続き', Sim.runWeek(c).sales === Sim.runWeek(c2).sales && c.cash === c2.cash);
    // 営業中の 手
    const m = freshO('onga', 9); m.orders[SAKE] = 400; m.staff.forEach(x => { x.role = 'register'; });
    Sim.beginWeek(m); Sim.runSlot(m); Sim.runSlot(m);
    const gq = () => Sim.groupStock(m, 'onigiri').reduce((x, y) => x + y.q, 0), before = gq();
    const n = Sim.midStock(m, 'onigiri');
    check('すぐ 品出しで 倉庫から 棚へ', n > 0 && gq() === before + n, n);
    const r0 = freshO('onga', 9), r1 = JSON.parse(JSON.stringify(r0));
    Sim.beginWeek(r1); Sim.runSlot(r1);
    check('緊急発注は 最後の 日は できない', Sim.midRush(r1, SAKE, 100) && (() => { const x = JSON.parse(JSON.stringify(r0)); Sim.beginWeek(x); while (x.wk.d < 6) Sim.runSlot(x); return !Sim.midRush(x, SAKE, 10); })());
    const rr0 = Sim.runWeek(r0), rr1 = Sim.runWeek(r1);
    check('緊急発注は つぎの 日に とどいて 高く つく', rr1.products[SAKE].ordered === rr0.products[SAKE].ordered + 100 && rr1.fees === rr0.fees + C.midweek.rushFee && rr1.products[SAKE].cost > rr0.products[SAKE].cost + 100 * Sim.costOf(r0, SAKE));
    const k0 = freshO('onga', 10), k1 = JSON.parse(JSON.stringify(k0));
    Sim.beginWeek(k1); Sim.midCallout(k1);
    Sim.beginWeek(k0);
    const s0 = Sim.runSlot(k0), s1 = Sim.runSlot(k1);
    check('呼びこみで その コマの 客が ふえる', s1.want > s0.want && s1.callout);
    const sh = freshO('onga', 11); Sim.beginWeek(sh); const mood0 = sh.staff[1].mood;
    check('営業中の シフト入れ替えで やる気が 下がる', Sim.midShift(sh, sh.staff[1].id, 2) && sh.staff[1].mood === mood0 - C.midweek.shiftMood && sh.staff[1].slots[2] === 0);
    const info = Sim.shelfInfo(Sim.runWeek(freshO('onga', 12)) && (() => { const x = freshO('onga', 12); Sim.runWeek(x); return x; })(), 'onigiri');
    check('棚を 調べると 先週の 数字が 出る', info && !info.live && info.weekSold > 0 && info.cap > 0);
}
// 商品の 種類 (2026-11-17 ユーザー指定: 指示書 9 章)
{
    check('おにぎりには 種類が ある', Sim.skusOf('onigiri').length >= 6 && Sim.hasVariety('onigiri') && !Sim.hasVariety('daily'));
    const s = fresh('onga', 21);
    check('期間限定は その 月 だけ (4 月に 栗おこわは ない)', !Sim.available(s, 'onigiri.kuri'));
    const sw = fresh('onga', 21); sw.cash = 1e7; Sim.addShelf(sw, 'sweets');
    check('棚を 置くと 期間限定の 種類も 発注できる (4 月の いちごの ケーキ)', Sim.available(sw, 'sweets.ichigo') && !Sim.available(sw, 'sweets.montblanc'));
    check(`棚 1 台に 置ける 種類は ${C.varietyPerShelf} つ まで`, Sim.facingsOf(s, 'onigiri') === C.varietyPerShelf && Sim.pickSkus(s, 'onigiri').length === C.varietyPerShelf);
    // 欲しい 種類が ない とき: 6 割は 別の 種類を 買う
    const one = fresh('onga', 22), all = fresh('onga', 22);
    one.orders[SAKE] = 1500;
    for (const k of Sim.pickSkus(all, 'onigiri')) all.orders[k.id] = Math.round(1500 / C.varietyPerShelf);
    const r1 = Sim.runWeek(one), r4 = Sim.runWeek(all);
    check('品切れの 代わりに 同じ グループの 別の 種類を 買う', r1.products[SAKE].subIn > 0 && r1.groups.onigiri.left > 0);
    check('種類を そろえると 帰る 客が へる', r4.groups.onigiri.left < r1.groups.onigiri.left, `${r4.groups.onigiri.left} < ${r1.groups.onigiri.left}`);
    check('種類ごとの 売上は グループの 合計', Math.abs(r4.groups.onigiri.sales - Sim.skusOf('onigiri').reduce((a, k) => a + (r4.products[k.id] ? r4.products[k.id].sales : 0), 0)) < 1);
    // 新商品
    const n = fresh('onga', 23); n.offer = 'onigiri.ebimayo';
    check('新商品は 置くと きめるまで 発注できない', !Sim.available(n, 'onigiri.ebimayo'));
    Sim.acceptOffer(n, true);
    check('新商品を 置くと 発注できて しばらく 人気', Sim.available(n, 'onigiri.ebimayo') && Sim.weightOf(n, Sim.sku('onigiri.ebimayo')) > Sim.sku('onigiri.ebimayo').pop);
    let offers = 0, booms = 0;
    const watch = s2 => { if (s2.offer) offers++; if (s2.boom && s2.boom.until > s2.week) booms++; St.normal(s2); };
    St.play(watch, 31, 'onga');
    check('本部が 新商品を すすめて くる・ブームが ある', offers > 3 && booms > 0, `${offers} ${booms}`);
    // おまかせ 配分
    const sp = freshO('onga', 24); Sim.runWeek(sp); Sim.splitOrder(sp, 'onigiri', 400);
    check('おまかせ 配分で グループの 発注が 種類に 分かれる', Sim.groupOrder(sp, 'onigiri') === 400 && Sim.pickSkus(sp, 'onigiri').every(k => sp.orders[k.id] > 0));
    // 古い セーブ (種類の 前)
    const old = JSON.parse(JSON.stringify(fresh('onga', 25))); delete old.skuVer;
    old.stock.onigiri = [{ q: 50, age: 0 }]; old.orders.onigiri = 120; old.prices.onigiri = 150;
    Sim.migrate(old);
    const top = Sim.skusOf('onigiri').filter(k => !k.months && !k.launch).sort((a, b) => b.pop - a.pop)[0].id;
    check('種類の 前の セーブも 読める (いちばん 人気の 種類へ)', old.stock[top].length === 1 && old.stock.onigiri === undefined && Array.isArray(old.launched));
    // 棚を 調べると 種類ごとに 1 行
    const si = freshO('onga', 26); Sim.runWeek(si);
    const inf = Sim.shelfInfo(si, 'onigiri');
    check('棚を 調べると 種類ごとに 行が ある', inf.rows.length >= 4 && inf.rows.some(r => r.weekSold > 0));
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
    const f = fresh(); f.orders[TEA] = 3000;
    const rf = Sim.runWeek(f);
    check('倉庫が いっぱいだと 受け取れない', rf.products[TEA].refused > 0 && Sim.wareUse(f) <= Sim.wareCap(f));
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
        for (const name of diff === 'normal' ? ['idle', 'normal', 'good', 'midweek', 'reckless'] : ['normal', 'good']) {
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
    check('ふつう: 営業中も 手を 打つと 少し 有利 (工夫より 1 割 くらい 上まで。20 回 ずつ なので ばらつきの ぶん 2 割まで。60 回 ずつ だと +8% くらい)', n.midweek.clear >= n.good.clear - 2 && n.midweek.clear <= n.good.clear + n.good.n * 0.2, `${n.midweek.clear} / ${n.good.clear}`);
    check('ふつう: むちゃな 借金は 返せない', n.reckless.bad >= n.reckless.n * 0.8, n.reckless.bad);
    // やさしい・むずかしい
    check('やさしい: 目安 だけでも ときどき クリア できる', e.normal.clear >= e.normal.n * 0.2, e.normal.clear);
    check('やさしい: 工夫すれば たいてい クリア (6 割 以上)', e.good.clear >= e.good.n * 0.6, e.good.clear);
    check('むずかしい: 目安 だけでは クリア できない', h.normal.clear === 0, h.normal.clear);
    check('むずかしい: 工夫しても ふつうより クリアしにくい', h.good.clear < n.good.clear && h.good.clear > 0, h.good.clear);
}
console.log(`${ok} / ${ok + ng} 成功`);
process.exit(ng ? 1 : 0);
