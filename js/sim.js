// こおりくんの コンビニ（仮） — 経営の 計算 (画面に ふれない。node でも うごく)
(function (root) {
    const C = typeof module !== 'undefined' ? require('./config.js') : root.CONFIG;

    // ----- 乱数 (状態は state.rs。セーブから 同じ 続きに なる) -----
    function rand(s) {
        s.rs = (s.rs + 0x6D2B79F5) | 0;
        let t = s.rs;
        t = Math.imul(t ^ (t >>> 15), 1 | t);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    const randInt = (s, a, b) => a + Math.floor(rand(s) * (b - a + 1));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const product = id => C.products.find(p => p.id === id);
    const facility = id => C.facilities.find(f => f.id === id);
    const staffDef = id => C.staff.find(x => x.id === id);
    const recipe = id => C.recipes.find(r => r.id === id);
    const partner = id => C.partners.find(p => p.id === id);
    const regionOf = s => C.regions.find(r => r.id === s.region);
    const SEGS = Object.keys(C.segments);

    // ----- こよみ -----
    function dateOf(day) {
        day = ((day % (C.weeks * 7)) + C.weeks * 7) % (C.weeks * 7); // エンドレスでは 52 週で くり返す
        let m = 0;
        while (day >= C.monthDays[m]) { day -= C.monthDays[m]; m = (m + 1) % 12; }
        return { mi: m, month: ((m + C.startMonth - 1) % 12) + 1, date: day + 1 };
    }
    function weekInfo(week) {
        const a = dateOf(week * 7), b = dateOf(week * 7 + 6);
        return { start: a, end: b, mi: dateOf(week * 7 + 3).mi, event: C.events.find(e => e.week === week % C.weeks) || null };
    }
    // この 週で 月が おわるか (つぎの 週の はじめが ちがう 月)
    const monthEnds = week => weekInfo(week + 1).start.month !== weekInfo(week).start.month;
    const yearOf = week => Math.floor(week / C.weeks) + 1;

    // 持ち場の はじめは いちばん 得意な ところ
    function bestRole(id) { const st = staffDef(id).st; return Object.keys(C.roles).sort((a, b) => st[C.roles[b].stat] - st[C.roles[a].stat])[0]; }
    function newMember(id) { return { id, slots: [1, 1, 0], role: bestRole(id), job: 'shop', dungeon: null, back: 0, mood: C.mood.start, tired: false }; }

    const diffOf = s => C.difficulties[s.difficulty] || C.difficulties.normal;
    function newGame(name, seed, region, difficulty, mode) {
        const df = C.difficulties[difficulty] || C.difficulties.normal;
        const s = {
            version: 2, name: name || 'こおりマート', seed: seed >>> 0, rs: seed | 0,
            region: region || C.regions[0].id, week: 0, months: 0,
            difficulty: C.difficulties[difficulty] ? difficulty : 'normal', mode: mode === 'endless' ? 'endless' : 'year', storeLv: 0, matAcc: {}, clearedWeek: null,
            cash: df.cash, debt: C.bank.debt, rate: df.rate, borrowed: 0, occupy: 0,
            rep: C.start.rep, regulars: C.start.regulars,
            prices: {}, orders: {}, stock: {}, ware: {}, back: {}, wareLv: 0, markdown: 0, kids: false,
            facilities: [], paid: {},
            staff: C.startStaff.map((id, i) => ({ ...newMember(id), slots: i % 2 ? [0, 1, 1] : [1, 1, 0] })),
            mats: { local: 1, kinoko: 0, umi: 0, maboroshi: 0 }, localAcc: 0, craft: {}, limited: {},
            items: { maneki: 0, hieishi: 0, genki: 0 }, effects: { maneki: 0, hieishi: 0 },
            partners: {}, eventDay: -1, recruiting: false, applicants: [],
            know: {}, history: [], log: [], over: null, flags: {},
            rivals: C.rivals.map(r => ({ name: r.name, owner: r.owner, sales: [], score: 0 }))
        };
        for (const p of C.partners) s.partners[p.id] = { on: false, trust: 0, taken: 0 };
        for (const p of C.products) { s.prices[p.id] = p.price; s.stock[p.id] = []; s.ware[p.id] = []; s.back[p.id] = []; }
        s.shelves = { ...C.startShelves };
        s.everHired = C.startStaff.slice();
        s.metRare = [];
        prepareWeek(s);
        // 発注しないと 何も とどかない (2026-11-17 ユーザー指定)。はじめは 発注 0・在庫 0
        for (const p of C.products) s.orders[p.id] = 0;
        updateScores(s);
        return s;
    }

    const hasFac = (s, id) => s.facilities.includes(id);
    // 売れる 商品 = 施設が ある (コーヒー・調理) か、棚が 1 台 以上 ある
    const shelfUnits = (s, id) => (s.shelves ? s.shelves[id] || 0 : C.startShelves[id] || 0);
    const needsShelf = p => !p.self && !p.cook;
    const available = (s, id) => { const p = product(id); return (!p.needs || hasFac(s, p.needs)) && (!needsShelf(p) || shelfUnits(s, id) > 0); };
    const floorUsed = s => C.products.reduce((a, p) => a + shelfUnits(s, p.id), 0) + s.facilities.length;
    // 倉庫 (2026-11-17 ユーザー指定: 倉庫に 入れて おける)
    const wareCap = s => C.warehouse.cap + C.warehouse.add * s.wareLv;
    function wareUse(s) { return C.products.reduce((a, p) => a + [...s.back[p.id], ...s.ware[p.id]].reduce((x, b) => x + b.q, 0), 0); }
    function expandWare(s) {
        if (s.wareLv >= C.warehouse.max || s.cash < C.warehouse.cost) return false;
        s.cash -= C.warehouse.cost;
        s.wareLv++;
        return true;
    }
    const capOf = (s, p) => Math.round(p.cap * (needsShelf(p) ? shelfUnits(s, p.id) : 1) * s.facilities.reduce((m, f) => m * (facility(f).capMul && facility(f).capMul[p.id] || 1), 1));

    // ----- スタッフ -----
    const inShop = s => s.staff.filter(m => m.job === 'shop');
    function trioOn(s) { return C.trio.every(id => inShop(s).some(m => m.id === id && m.slots.some(Boolean))); }
    // [接客, 品出し, 検品, 調理, 探索] (疲れ・やる気・3 人 連携を ふくむ)
    function stats(s, m) {
        const d = staffDef(m.id);
        let mul = 1;
        if (m.tired) mul *= C.mood.tired;
        if (m.mood < C.mood.low) mul *= C.mood.lowMul;
        const bonus = C.trio.includes(m.id) && trioOn(s) ? 1 : 0;
        return d.st.map(v => (v + bonus) * mul);
    }
    const slotCap = (s, t) => registerCap(s, t);
    // コマ t の 持ち場の 仕事量 (画面の 見こみ用)
    function rolePower(s, t, role) {
        if (role === 'register') return slotCap(s, t);
        const per = { stock: C.stockPer, check: C.checkPer, cook: C.cookPer }[role];
        return Math.round(inShop(s).filter(m => m.slots[t]).reduce((a, m) => a + stats(s, m)[C.roles[role].stat] * (m.role === role ? 1 : C.roleHelp), 0) * per);
    }
    function setRole(s, id, role) {
        const m = s.staff.find(x => x.id === id);
        if (!m || !C.roles[role]) return false;
        m.role = role;
        return true;
    }
    const workSlots = m => (m.job === 'shop' ? m.slots.filter(Boolean).length : 2);
    // 給料 = 時給 × 時間 (1 コマ = hoursPerSlot 時間 × 7 日)
    const slotWage = id => staffDef(id).pay * C.hoursPerSlot * 7;
    const wageOf = m => slotWage(m.id) * workSlots(m);
    const wages = s => s.staff.reduce((a, m) => a + wageOf(m), 0);

    // ----- 値段と 客 -----
    const ratioOf = (s, id) => s.prices[id] / product(id).price;
    function priceF(seg, ratio, line) {
        const sense = C.segments[seg].sense;
        return ratio <= line ? 1 + sense * 0.6 * (line - ratio) : Math.exp(-sense * (ratio - line) * 2.2);
    }
    function segFac(s, g) { return s.facilities.reduce((a, f) => a * (facility(f).seg && facility(f).seg[g] || 1), 1); }
    const repF = rep => C.rep.trafficMin + (C.rep.trafficMax - C.rep.trafficMin) * rep / 100;
    function partnerPower(s, id) { const p = s.partners[id]; return p && p.on ? 1 + Math.min(p.trust, C.trustMax) * C.trustPower : 0; }
    function partnerFee(s, id) { const p = s.partners[id]; return Math.round(partner(id).fee * (1 - Math.min(p.trust, C.trustMax) * C.trustFee)); }

    // 気温・天気・行事・設備で かわる 売れやすさ (値段と 客層 以外)
    function productFactor(s, p, temp, weather, event) {
        let f = 1;
        if (p.temp) f *= Math.max(0.2, p.temp[0] + p.temp[1] * temp);
        if (p.iceCurve) f *= Math.max(0.1, 1 + (temp - 22) * 0.12) * (weather === 'rain' ? 0.7 : 1);
        if (p.odenCurve) f *= Math.max(0, (22 - temp) * 0.08) * (weather === 'rain' || weather === 'snow' ? 1.15 : 1);
        if (event && event.boost && event.boost[p.id]) f *= event.boost[p.id];
        for (const id of s.facilities) { const fc = facility(id); if (fc.boost && fc.boost[p.id]) f *= fc.boost[p.id]; }
        f *= regionOf(s).pref[p.id] || 1;
        for (const pt of C.partners) if (pt.boost && pt.boost[p.id] && partnerPower(s, pt.id)) f *= 1 + (pt.boost[p.id] - 1) * partnerPower(s, pt.id);
        // レアスタッフの 得意 (店に いる とき)
        for (const m of s.staff) { const r = staffDef(m.id).rare; if (r && r.perk[p.id] && m.job === 'shop' && m.slots.some(Boolean)) f *= r.perk[p.id]; }
        f *= s.facilities.reduce((a, id) => a * (facility(id).spend || 1), 1);
        return f;
    }

    // 1 日の 客 (客層ごと)。mult = 天気・曜日など ぜんぶ
    function segTraffic(s, info, mult) {
        const r = regionOf(s), out = {};
        const total = SEGS.reduce((a, g) => a + r.base[g], 0);
        for (const g of SEGS) {
            const ev = info.event && info.event.seg && info.event.seg[g] || 1;
            const pseg = C.partners.reduce((a, p) => a * (p.seg && p.seg[g] && partnerPower(s, p.id) ? 1 + (p.seg[g] - 1) * partnerPower(s, p.id) : 1), 1);
            out[g] = (r.base[g] * segFac(s, g) * ev * pseg + s.regulars * C.regulars.visit * r.base[g] / total) * mult;
        }
        return out;
    }
    function baseMult(s, info) {
        return C.seasonTraffic[info.mi] * (info.event ? info.event.traffic : 1) * repF(s.rep) * diffOf(s).traffic * levelOf(s).traffic
            * (s.effects.maneki ? C.items.maneki.traffic : 1)
            * (partnerPower(s, 'ad') ? 1 + (partner('ad').traffic - 1) * partnerPower(s, 'ad') : 1)
            * (s.occupy ? C.bank.occupyTraffic : 1);
    }
    // 今週の 1 日 平均の 客の 見こみ
    function estTraffic(s) {
        const info = weekInfo(s.week);
        const t = segTraffic(s, info, baseMult(s, info));
        return SEGS.reduce((a, g) => a + t[g], 0);
    }
    function estSlots(s) {
        const info = weekInfo(s.week);
        const t = segTraffic(s, info, baseMult(s, info) * 1.12); // 土曜くらい
        return [0, 1, 2].map(k => Math.round(SEGS.reduce((a, g) => a + t[g] * C.segments[g].slot[k], 0)));
    }
    // 「目安」 = 先週の 1 日 平均の 需要。まだ 売って いない 商品は 見つもる
    // 1 日に 売れそうな 数 (店に 入れた 客の ぶん。レジで 帰った 客は 入れない。入れると 倉庫に たまる)
    function dailyNeed(s, id) {
        if (!available(s, id)) return 0;
        const h = s.history.filter(x => !x.moved);
        const lastH = h.length ? h[h.length - 1] : null, last = lastH && lastH.products[id];
        // 行事の 週の ぶんは ならして、今週の 行事を かける (どんたくの つぎの 週に 多く 入れすぎない)
        const evMul = w => { const e = weekInfo(w).event; return e ? e.traffic * (e.boost && e.boost[id] || 1) : 1; };
        if (last && last.open) return Math.round((last.need !== undefined ? last.need : last.demand) / last.open / evMul(lastH.week) * evMul(s.week));
        const p = product(id), info = weekInfo(s.week), r = regionOf(s);
        const t = segTraffic(s, info, baseMult(s, info));
        let d = 0;
        for (const g of SEGS) d += t[g] * C.segments[g].rate[id] * priceF(g, ratioOf(s, id), r.line);
        return Math.round(d * productFactor(s, p, C.temp[info.mi], 'sun', info.event));
    }
    const stockOf = (s, id) => ['back', 'ware', 'stock'].reduce((a, k) => a + (s[k][id] || []).reduce((x, b) => x + b.q, 0), 0);
    // 「目安」 = 1 日に 売れそうな 数。日持ちする 商品は 今 ある 在庫も 見る (倉庫に keepDays 日ぶん のこる ように)
    function suggest(s, id) {
        const d = dailyNeed(s, id), p = product(id);
        if (p.shelf || !d) return d;
        return Math.max(0, Math.round(d + (d * C.keepDays - stockOf(s, id)) / 7));
    }

    // ----- 天気 -----
    function rollWeather(s, mi) {
        const r = rand(s);
        if (r < C.typhoon[mi]) return 'typhoon';
        if (r < C.typhoon[mi] + C.snow[mi]) return 'snow';
        if (r < C.typhoon[mi] + C.snow[mi] + C.rain[mi]) return 'rain';
        return rand(s) < 0.6 ? 'sun' : 'cloud';
    }
    function prepareWeek(s) {
        s.weather = [];
        s.forecast = [];
        for (let i = 0; i < 7; i++) {
            const { mi } = dateOf(s.week * 7 + i);
            let w = rollWeather(s, mi);
            if (w === 'typhoon' && i > 0 && s.weather[i - 1].w !== 'typhoon' && rand(s) < 0.5) w = 'rain';
            const temp = Math.round(C.temp[mi] + (rand(s) - 0.5) * 6 + (w === 'rain' ? -1 : w === 'sun' ? 1 : 0));
            s.weather.push({ w, temp });
            const miss = rand(s) < C.forecastMiss;
            s.forecast.push({ w: miss ? rollWeather(s, mi) : w, temp: temp + Math.round((rand(s) - 0.5) * 4) });
        }
        moveCosts(s);
    }

    // ----- 仕入れ値 (2026-11-17 ユーザー決定: 週ごとに 変わる。発注した 週の 値で きまる) -----
    // costNow = 今週の 仕入れ値 (連携の 割引の 前)、costPrev = 先週の、costWhy = 動いた わけ
    function costTarget(s, p) {
        const M = C.costMove, info = weekInfo(s.week), month = info.start.month;
        let mul = 1;
        const why = [];
        for (const x of M.season) if (x.ids.includes(p.id) && x.months.includes(month)) { mul *= x.mul; why.push(x.why); }
        const ws = (s.weather || []).map(x => x.w);
        if (ws.includes('typhoon') && M.typhoon.ids.includes(p.id)) { mul *= M.typhoon.mul; why.push(M.typhoon.why); }
        if (ws.includes('snow') && M.snow.ids.includes(p.id)) { mul *= M.snow.mul; why.push(M.snow.why); }
        if (info.event && info.event.boost && (info.event.boost[p.id] || 1) >= M.event.boost) { mul *= M.event.mul; why.push(M.event.why); }
        return { mul, why };
    }
    function moveCosts(s) {
        const M = C.costMove;
        s.costDrift = s.costDrift || {};
        s.costPrev = s.costNow ? { ...s.costNow } : null;
        s.costNow = {}; s.costWhy = {};
        for (const p of C.products) {
            const d = s.week === 0 ? 0 : (s.costDrift[p.id] || 0) * M.keep + (rand(s) - 0.5) * 2 * M.drift;
            s.costDrift[p.id] = clamp(d, -M.max, M.max);
            const t = costTarget(s, p);
            s.costNow[p.id] = Math.round(p.cost * clamp(t.mul * (1 + s.costDrift[p.id]), 1 - M.max, 1 + M.max));
            if (t.why.length) s.costWhy[p.id] = t.why;
        }
    }
    // 連携の 割引 (信頼度で もっと 下がる)
    function costDownOf(s, id) {
        let f = 1;
        for (const pt of C.partners) if (pt.costDown && pt.costDown[id] && partnerPower(s, pt.id)) f *= 1 - pt.costDown[id] * partnerPower(s, pt.id);
        return f;
    }
    const costOf = (s, id) => Math.round((s.costNow && s.costNow[id] || product(id).cost) * costDownOf(s, id));
    // 先週から 変わった 額 (連携の 割引は 入れない)
    const costChange = (s, id) => (s.costPrev && s.costNow ? (s.costNow[id] || 0) - (s.costPrev[id] || 0) : 0);
    // 1 こ の もうけ (円・率)
    function marginOf(s, id) {
        const c = costOf(s, id), pr = s.prices[id];
        return { yen: pr - c, rate: pr ? (pr - c) / pr : 0, cost: c };
    }
    // 売り値を かえる (はばの 中に おさめる)
    function priceBounds(id) { const p = product(id); return [Math.round(p.price * C.priceRange[0] / 10) * 10, Math.round(p.price * C.priceRange[1] / 10) * 10]; }
    function setPrice(s, id, v) {
        const [a, b] = priceBounds(id);
        s.prices[id] = clamp(Math.round(v / C.priceStep) * C.priceStep, a, b);
        return s.prices[id];
    }
    // もうけの 率を pct (0〜1) に する 売り値
    const priceForMargin = (s, id, pct) => costOf(s, id) / Math.max(0.05, 1 - pct);

    // ----- 操作 (画面から よぶ。できないと false) -----
    function facCost(s, id) { return Math.round(facility(id).cost * (id === 'parking' ? regionOf(s).parkingMul : 1)); }
    function buyFacility(s, id) {
        if (hasFac(s, id) || s.facilities.length >= facCap(s) || floorUsed(s) >= floorCap(s) || s.cash < facCost(s, id)) return false;
        const c = facCost(s, id);
        s.cash -= c;
        s.paid[id] = c;
        s.facilities.push(id);
        const p = C.products.find(x => x.needs === id);
        if (p) s.orders[p.id] = suggest(s, p.id);
        return true;
    }
    function removeFacility(s, id) {
        if (!hasFac(s, id)) return false;
        s.cash += Math.round((s.paid[id] || facCost(s, id)) * C.sellBack);
        s.facilities = s.facilities.filter(f => f !== id);
        const p = C.products.find(x => x.needs === id);
        if (p) { s.orders[p.id] = 0; s.stock[p.id] = []; s.ware[p.id] = []; s.back[p.id] = []; }
        return true;
    }
    // 棚を ふやす・撤去する (2026-11-17 ユーザー指定)。撤去すると 棚の 商品は 倉庫に もどる
    function addShelf(s, id) {
        const p = product(id);
        const ty = p && C.shelfTypes[p.type];
        if (!p || !needsShelf(p) || floorUsed(s) >= floorCap(s) || s.cash < ty.cost) return false;
        s.cash -= ty.cost;
        s.shelves[id] = shelfUnits(s, id) + 1;
        return true;
    }
    function removeShelf(s, id) {
        const p = product(id);
        if (!p || shelfUnits(s, id) <= 0) return false;
        s.shelves[id]--;
        s.cash += Math.round(C.shelfTypes[p.type].cost * C.shelf.refund);
        const cap = capOf(s, p);
        let over = s.stock[id].reduce((a, b) => a + b.q, 0) - cap;
        for (const b of [...s.stock[id]].reverse()) { if (over <= 0) break; const t = Math.min(b.q, over); b.q -= t; over -= t; s.ware[id].push({ q: t, age: b.age }); }
        s.stock[id] = s.stock[id].filter(b => b.q > 0);
        if (!s.shelves[id]) s.orders[id] = 0;
        return true;
    }
    // 店の 大きさ (2026-11-17 ユーザー指定: お金と 評判が 一定 以上 いる)
    const levelOf = s => C.storeLevels[s.storeLv || 0];
    const floorCap = s => levelOf(s).floor;
    const facCap = s => levelOf(s).maxFac;
    const rentOf = s => regionOf(s).rent + levelOf(s).rentAdd;
    function canExpand(s) {
        const nx = C.storeLevels[(s.storeLv || 0) + 1];
        if (!nx) return { ok: false, max: true };
        return { ok: s.cash >= nx.cost && s.rep >= nx.rep, next: nx, cash: s.cash >= nx.cost, rep: s.rep >= nx.rep };
    }
    function expandStore(s) {
        const c = canExpand(s);
        if (!c.ok) return false;
        s.cash -= c.next.cost;
        s.storeLv = (s.storeLv || 0) + 1;
        return true;
    }
    // 古い セーブを 今の 形に そろえる
    function migrate(s) {
        for (const p of C.products) {
            for (const k of ['stock', 'ware', 'back']) if (!s[k][p.id]) s[k][p.id] = [];
            if (s.prices[p.id] === undefined) s.prices[p.id] = p.price;
            if (s.orders[p.id] === undefined) s.orders[p.id] = 0;
        }
        if (!s.shelves) s.shelves = { ...C.startShelves };
        if (s.storeLv === undefined) s.storeLv = 0;
        if (!s.mode) s.mode = 'year';
        if (!s.matAcc) s.matAcc = {};
        if (s.clearedWeek === undefined) s.clearedWeek = null;
        if (!s.everHired) s.everHired = C.startStaff.slice();
        if (!s.metRare) s.metRare = [];
        if (!s.costNow) { s.costNow = {}; s.costDrift = {}; s.costWhy = {}; s.costPrev = null; }
        for (const p of C.products) if (s.costNow[p.id] === undefined) s.costNow[p.id] = p.cost;
        for (const p of C.partners) if (!s.partners[p.id]) s.partners[p.id] = { on: false, trust: 0, taken: 0 };
        s.facilities = s.facilities.filter(id => facility(id));
        return s;
    }
    // 季節の レアスタッフ: いま (月) やとえるか
    const rareNow = (d, month) => !!d.rare && d.rare.months.includes(month);
    // アルバイト募集: お金を はらうと つぎの 週に 応募が 来る
    function recruit(s) {
        if (s.recruiting || s.cash < C.recruit.cost || s.staff.length >= C.maxStaff) return false;
        s.cash -= C.recruit.cost;
        s.recruiting = true;
        return true;
    }
    function hire(s, id) {
        const d = staffDef(id);
        if (!d || !(s.applicants || []).includes(id) || s.staff.some(m => m.id === id) || s.staff.length >= C.maxStaff) return false;
        s.applicants = s.applicants.filter(x => x !== id);
        if (!s.everHired.includes(id)) s.everHired.push(id);
        const m = newMember(id);
        const order = [0, 1, 2].sort((a, b) => slotCap(s, a) - slotCap(s, b));
        m.slots = [0, 0, 0];
        m.slots[order[0]] = 1; m.slots[order[1]] = 1;
        s.staff.push(m);
        return true;
    }
    // 設備代 (毎週)
    const shelfUpkeep = s => C.products.reduce((a, p) => a + (needsShelf(p) ? shelfUnits(s, p.id) * C.shelfTypes[p.type].upkeep : 0), 0);
    const upkeep = s => C.baseUpkeep + C.warehouse.upkeep * s.wareLv + shelfUpkeep(s) + s.facilities.reduce((a, id) => a + upkeepOf(s, id), 0);
    const upkeepOf = (s, id) => Math.round(facility(id).upkeep * (id === 'parking' ? regionOf(s).parkingMul : 1));
    function fire(s, id) {
        const m = s.staff.find(x => x.id === id);
        if (!m || staffDef(id).boss || m.job === 'dungeon') return false;
        s.staff = s.staff.filter(x => x !== m);
        return true;
    }
    function toggleSlot(s, id, t) {
        const m = s.staff.find(x => x.id === id);
        if (!m || m.job !== 'shop') return false;
        m.slots[t] = m.slots[t] ? 0 : 1;
        return true;
    }
    function sendDungeon(s, id, did) {
        const m = s.staff.find(x => x.id === id), d = C.dungeons.find(x => x.id === did);
        if (!m || !d || m.job !== 'shop' || staffDef(id).boss) return false;
        m.job = 'dungeon';
        m.dungeon = did;
        m.back = d.weeks;
        return true;
    }
    function recall(s, id) { // まだ 出発して いない (今週 えらんだ) ときだけ 取りけせる
        const m = s.staff.find(x => x.id === id);
        if (!m || m.job !== 'dungeon' || m.back !== C.dungeons.find(x => x.id === m.dungeon).weeks || m.left) return false;
        m.job = 'shop'; m.dungeon = null; m.back = 0;
        return true;
    }
    // 予約した ぶんを ふくめて 使える 材料
    function matsLeft(s) {
        const left = { ...s.mats };
        for (const [rid, n] of Object.entries(s.craft)) for (const [k, v] of Object.entries(recipe(rid).use)) left[k] -= v * n;
        return left;
    }
    function craftable(s, rid) {
        const left = matsLeft(s);
        return Object.entries(recipe(rid).use).every(([k, v]) => left[k] >= v);
    }
    function addCraft(s, rid, d) {
        if (d > 0 && !craftable(s, rid)) return false;
        s.craft[rid] = Math.max(0, (s.craft[rid] || 0) + d);
        return true;
    }
    function useItem(s, id) {
        if (!s.items[id]) return false;
        s.items[id]--;
        if (id === 'genki') for (const m of s.staff) m.mood = Math.min(100, m.mood + 30);
        else s.effects[id] = (s.effects[id] || 0) + C.items[id].weeks;
        return true;
    }
    function setPartner(s, id, on) {
        const p = s.partners[id];
        if (!p || p.taken) return false;
        if (partner(id).perUse) return false;
        p.on = !!on;
        return true;
    }
    function bookEvent(s, day) { // DJ イベント: 今週の この 日 (−1 で 取りけし)
        if (s.partners.event.taken) return false;
        s.eventDay = day;
        return true;
    }
    function repay(s, amount) {
        amount = Math.min(amount, s.debt, Math.max(0, s.cash));
        if (amount <= 0) return false;
        s.cash -= amount;
        s.debt -= amount;
        return true;
    }
    function borrow(s) {
        if (s.borrowed >= C.bank.maxBorrow) return false;
        s.borrowed++;
        s.debt += C.bank.borrow;
        s.cash += C.bank.borrow;
        s.rate += C.bank.borrowRate;
        return true;
    }
    function relocate(s, rid) {
        if (rid === s.region || s.cash < C.moveCost || !C.regions.some(r => r.id === rid)) return false;
        s.cash -= C.moveCost;
        s.region = rid;
        s.regulars = Math.round(s.regulars * C.moveKeepRegulars);
        s.history.push({ moved: rid, week: s.week });
        return true;
    }
    // 地域の 好み: 分かった 商品だけ ↑ / ↓ / ・
    function knownPref(s, id, rid = s.region) {
        const k = (s.know[rid] || {})[id] || 0;
        if (k < C.knowWeeks) return null;
        const v = C.regions.find(r => r.id === rid).pref[id] || 1;
        return v > 1.05 ? 'up' : v < 0.95 ? 'down' : 'flat';
    }

    // ----- 1 週間 営業する -----
    // 2026-11-17 ユーザー決定 (指示書 10-2 案B): 1 週間を 1 日ずつ・朝昼夜の コマずつ 進める。
    // beginWeek → runSlot (21 コマ) → finishWeek。途中の ようすは s.wk に もつ (セーブすると その コマから 再開)。
    // runDay = 1 日ぶん、runWeek = ぜんぶ (テスト・自動プレイ・スキップ)。
    const SLOTS = 21;
    const sumQ = a => a.reduce((x, b) => x + b.q, 0);
    const take = (from, n) => { // 古い じゅんに n こ とりだす
        const out = [];
        for (const b of from) { if (!n) break; const t = Math.min(b.q, n); if (t) { out.push({ q: t, age: b.age }); b.q -= t; n -= t; } }
        return out;
    };
    const put = (to, list) => { for (const b of list) { const same = to.find(x => x.age === b.age); if (same) same.q += b.q; else to.push(b); } to.sort((a, b) => b.age - a.age); };
    const prodsOf = s => C.products.filter(p => available(s, p.id));

    function beginWeek(s) {
        if (s.over || s.wk) return s.wk || null;
        // 限定商品を 作る (材料を つかう)
        const limitedMade = {};
        for (const [rid, n] of Object.entries(s.craft)) {
            if (!n) continue;
            const rc = recipe(rid);
            const k = Math.min(n, ...Object.entries(rc.use).map(([m, v]) => Math.floor(s.mats[m] / v)));
            if (k <= 0) continue;
            for (const [m, v] of Object.entries(rc.use)) s.mats[m] -= v * k;
            limitedMade[rid] = k * rc.make;
        }
        s.craft = {};
        for (const m of s.staff) if (m.job === 'dungeon') m.left = true;

        // キャラの できごと
        const goldDay = rand(s) < C.goldDog.chance ? randInt(s, 0, 6) : -1;
        const tomoDay = rand(s) < C.tomoishi.chance ? randInt(s, 0, 6) : -1; // ともいしの 抜き打ち (来る 日は はじめに きまる。営業の 早送りで 見せる)
        const djDay = s.eventDay;
        let djFee = 0;
        if (djDay >= 0) { djFee = partnerFee(s, 'event'); s.partners.event.trust++; }

        const prods = prodsOf(s);
        // 仕入れ値は 発注した 週の 値 (とどく 日に 変わらない)
        const costs = {};
        for (const p of C.products) costs[p.id] = costOf(s, p.id);
        const rep = {}, ps = {};
        for (const p of prods) {
            rep[p.id] = { ordered: 0, refused: 0, need: 0, sold: 0, lost: 0, shelfOut: 0, waste: 0, kids: 0, marked: 0, demand: 0, open: 0, sales: 0, cost: 0, unit: costs[p.id], price: s.prices[p.id] };
            ps[p.id] = { sold: Array(SLOTS).fill(0), lost: Array(SLOTS).fill(0), out: Array(SLOTS).fill(0) };
        }
        const lim = {};
        for (const [rid, n] of Object.entries(limitedMade)) { lim[rid] = { made: n, sold: 0, lost: 0, waste: 0, sales: 0 }; (s.limited[rid] = s.limited[rid] || []); }
        const segServed = {};
        for (const g of SEGS) segServed[g] = 0;
        s.wk = {
            d: 0, t: 0, events: [], goldDay, tomoDay, djDay, djFee,
            shelfPlus: s.effects.hieishi ? 1 : 0, hunters: Math.min(0.3, s.regulars * C.hunterRate),
            costs, rep, lim, ps, segServed, days: [], day: null, slots: [],
            work: { check: [0, 0, 0], stock: [0, 0, 0], cook: [0, 0, 0], checkCap: [0, 1, 2].map(t => slotPower(s, t, 'check')), stockCap: [0, 1, 2].map(t => slotPower(s, t, 'stock')), cookCap: [0, 1, 2].map(t => slotPower(s, t, 'cook')), arrived: 0, refused: 0 },
            acc: { sales: 0, buy: 0, demandYen: 0, lostYen: 0, served: 0, walk: 0, kids: 0, wasteYen: 0, high: 0, cheap: 0, soldOut: 0, limitedSold: 0, shelfOutAll: 0, rushFee: 0 },
            // 営業中に 打った 手 (k = 何コマ目)。stockUsed = すぐ品出しで 使った 品出しの 力、rush = 緊急発注 (つぎの 日の 朝に とどく)
            act: { stockUsed: {}, rush: {}, cookBoost: {}, callout: {} }
        };
        return s.wk;
    }

    // 持ち場ごとの 仕事量 (2026-11-17 ユーザー指定: 持ち場の 人は 100%、ほかの 持ち場の 人も roleHelp だけ 手伝う)
    // k を わたすと 営業中の 手 (呼びこみ中の こおりくんは 働かない・調理を 増やす) も 入れる
    const calloutOn = (s, k) => !!(s.wk && k !== undefined && s.wk.act.callout[k]);
    function workers(s, t, k) { return inShop(s).filter(m => m.slots[t] && !(calloutOn(s, k) && m.id === 'koori')); }
    function slotPower(s, t, role, k) {
        const pMul = key => C.partners.reduce((a, p) => a * (p[key] && partnerPower(s, p.id) ? 1 + (p[key] - 1) * partnerPower(s, p.id) : 1), 1);
        const pw = workers(s, t, k).reduce((a, m) => a + stats(s, m)[C.roles[role].stat] * (m.role === role ? 1 : C.roleHelp), 0);
        if (role === 'stock') return pw * C.stockPer * pMul('stock');
        if (role === 'check') return pw * C.checkPer * pMul('check');
        if (role === 'cook') return pw * C.cookPer * (s.wk && k !== undefined && s.wk.act.cookBoost[k] ? C.midweek.cookBoost : 1);
        return 0;
    }
    function registerCap(s, t, k) {
        const eat = s.facilities.reduce((a, f) => a * (typeof facility(f).capMul === 'number' ? facility(f).capMul : 1), 1);
        const temp = C.partners.reduce((a, p) => a + (p.temp && partnerPower(s, p.id) ? p.temp * partnerPower(s, p.id) : 0), 0);
        return Math.round(workers(s, t, k).reduce((a, m) => a + stats(s, m)[0] * (m.role === 'register' ? 1 : C.roleHelp), 0) * C.serve * eat + temp);
    }

    // 1 日の はじめ: 客の 数・売れやすさ を きめて、発注した 商品 (と 緊急発注) が とどく
    function startDay(s) {
        const w = s.wk, d = w.d, info = weekInfo(s.week), prods = prodsOf(s);
        const { w: wt, temp } = s.weather[d];
        const mult = baseMult(s, info) * C.dayTraffic[d] * C.weather[wt].traffic * (d === w.goldDay ? C.goldDog.day : 1)
            * (d === w.djDay ? 1 + (partner('event').day - 1) * (1 + Math.min(s.partners.event.trust, C.trustMax) * C.trustPower) : 1) * (0.95 + rand(s) * 0.1);
        const tr = segTraffic(s, info, mult);
        const cooks = inShop(s).filter(m => m.role === 'cook' && m.slots.some(Boolean));
        const cookF = cooks.length ? 0.7 + 0.1 * Math.max(...cooks.map(m => stats(s, m)[C.roles.cook.stat])) : 0.6;
        const pf = {};
        for (const p of prods) pf[p.id] = productFactor(s, p, temp, wt, info.event) * (p.cook ? cookF : 1) * (0.9 + rand(s) * 0.2);
        // 朝: 発注した 商品が とどく (発注しないと とどかない)。倉庫が いっぱいなら 受け取れない
        for (const p of prods) {
            const x = w.rep[p.id];
            const rush = w.act.rush[`${d}:${p.id}`] || 0;
            const q = Math.max(0, Math.round(s.orders[p.id] || 0));
            for (const [n, unit] of [[q, w.costs[p.id]], [rush, Math.round(w.costs[p.id] * C.midweek.rushCost)]]) {
                if (!n) continue;
                const ok = Math.min(n, Math.max(0, wareCap(s) - wareUse(s)));
                if (ok) { s.back[p.id].push({ q: ok, age: 0 }); x.ordered += ok; w.acc.buy += ok * unit; x.cost += ok * unit; w.work.arrived += ok; }
                if (n > ok) { x.refused += n - ok; w.work.refused += n - ok; }
            }
        }
        const sv = {};
        for (const g of SEGS) sv[g] = 0;
        w.day = { tr, pf, sales: 0, served: 0, all: 0, flags: { high: 0, cheap: 0, out: 0, shelf: 0 }, sv };
    }

    // 1 コマ (朝・昼・夜) 進める。おわった コマの ようすを かえす
    function runSlot(s) {
        if (!s.wk) beginWeek(s);
        const w = s.wk;
        if (!w || w.d >= 7) return null;
        const d = w.d, t = w.t, k = d * 3 + t, r = regionOf(s), prods = prodsOf(s);
        if (t === 0) startDay(s);
        const day = w.day, tr = day.tr;
        const call = calloutOn(s, k) ? C.midweek.callout : 1;
        const cap = registerCap(s, t, k);
        const checkP = slotPower(s, t, 'check', k), stockP = Math.max(0, slotPower(s, t, 'stock', k) - (w.act.stockUsed[k] || 0)), cookP = slotPower(s, t, 'cook', k);
        // レジが ひまな ときは レジの 人も 検品・品出しを する (ひまな 割合 × spareWork を 半分ずつ)
        const T = SEGS.reduce((a, g) => a + tr[g] * C.segments[g].slot[t] * call, 0);
        const spare = cap ? Math.max(0, 1 - T / cap) * C.spareWork : 0;
        const regs = workers(s, t, k).filter(m => m.role === 'register');
        const checkNow = checkP + regs.reduce((a, m) => a + stats(s, m)[C.roles.check.stat], 0) * C.checkPer * spare / 2;
        const stockNow = stockP + regs.reduce((a, m) => a + stats(s, m)[C.roles.stock.stat], 0) * C.stockPer * spare / 2;
        // 検品・受け取り: 荷受け場 → 倉庫
        const backN = prods.map(p => sumQ(s.back[p.id])), backAll = backN.reduce((x, y) => x + y, 0);
        if (backAll && checkNow) {
            const f = Math.min(1, checkNow / backAll);
            prods.forEach((p, i) => { const n = Math.min(backN[i], Math.ceil(backN[i] * f)); if (n > 0) { put(s.ware[p.id], take(s.back[p.id], n)); w.work.check[t] += n; } });
        }
        // 品出し (倉庫 → 棚) と 調理 (ホットスナック・おでんは 作って ケースへ)。足りない 割合で わける
        for (const kind of ['stock', 'cook']) {
            const list = prods.filter(p => !p.self && (kind === 'cook' ? !!p.cook : !p.cook));
            const need = list.map(p => Math.max(0, Math.min(capOf(s, p) - sumQ(s.stock[p.id]), sumQ(s.ware[p.id]))));
            const total = need.reduce((a, b) => a + b, 0);
            const pw = kind === 'cook' ? cookP : stockNow;
            if (!total || !pw) continue;
            const f = Math.min(1, pw / total);
            list.forEach((p, i) => { const n = Math.floor(need[i] * f); if (n > 0) { put(s.stock[p.id], take(s.ware[p.id], n)); w.work[kind][t] += n; } });
        }
        // 客
        const rs = T ? Math.min(1, cap / T) : 1;
        const svT = {};
        let slotServed = 0, slotAll = 0, slotSales = 0;
        for (const g of SEGS) { const all = tr[g] * C.segments[g].slot[t] * call; svT[g] = all * rs; day.sv[g] += svT[g]; slotServed += svT[g]; slotAll += all; }
        day.served += slotServed; day.all += slotAll;
        const outs = [];
        for (const p of prods) {
            const x = w.rep[p.id], price = s.prices[p.id], ratio = price / p.price;
            let want = 0, need = 0;
            for (const g of SEGS) {
                const kk = C.segments[g].rate[p.id] * priceF(g, ratio, r.line) * day.pf[p.id];
                want += tr[g] * C.segments[g].slot[t] * call * kk;
                need += svT[g] * kk;
            }
            want = Math.round(want); need = Math.round(need);
            x.demand += want; x.need += need;
            const shelf = p.self ? s.ware[p.id] : s.stock[p.id]; // コーヒーは マシンで その場で いれる (倉庫の 豆から)
            const sold = sumQ(take(shelf, need));
            x.sold += sold; x.lost += need - sold;
            const pk = w.ps[p.id];
            if (pk) { pk.sold[k] += sold; pk.lost[k] += need - sold; }
            if (need > sold && sumQ(s.ware[p.id]) > 0) { x.shelfOut += need - sold; w.acc.shelfOutAll += need - sold; day.flags.shelf++; if (pk) pk.out[k] += need - sold; }
            x.sales += sold * price; day.sales += sold * price; slotSales += sold * price;
            w.acc.demandYen += need * price; w.acc.lostYen += (need - sold) * price;
            if (ratio > r.line * 1.08) { w.acc.high += sold; day.flags.high++; }
            if (ratio < C.cheapLine) { w.acc.cheap += sold; day.flags.cheap++; }
            if (need > sold) { w.acc.soldOut++; day.flags.out++; outs.push(p.id); }
        }
        const slot = { d, t, k, customers: Math.round(slotServed), walkAway: Math.round(slotAll - slotServed), sales: slotSales, cap, want: Math.round(T), outs, callout: call > 1 };
        w.slots.push(slot);
        if (t === 2) endDay(s);
        w.t++;
        if (w.t > 2) { w.t = 0; w.d++; }
        return slot;
    }

    // 1 日の おわり: 期限 今日までを 値下げ → 期限切れは 廃棄 か 子ども食堂。限定商品
    function endDay(s) {
        const w = s.wk, d = w.d, day = w.day, prods = prodsOf(s), x0 = w.acc;
        for (const p of prods) {
            const x = w.rep[p.id], price = s.prices[p.id];
            x.open++;
            if (!p.shelf) continue;
            const life = p.shelf + w.shelfPlus;
            // 値下げは 棚と 倉庫の 期限 今日までの 商品 (倉庫の ぶんも 値札を 貼って 出す)
            for (const b of [...s.stock[p.id], ...s.ware[p.id]]) if (b.age === life - 1 && b.q && s.markdown) {
                const m = Math.min(b.q, Math.round(b.q * Math.min(0.9, w.hunters + s.markdown * 1.2)));
                b.q -= m; x.marked += m; x.sold += m;
                const yenM = Math.round(m * price * (1 - s.markdown));
                x.sales += yenM; day.sales += yenM;
            }
            for (const k of ['back', 'ware', 'stock']) for (const b of s[k][p.id]) {
                b.age++;
                if (b.age >= life && b.q) {
                    if (s.kids) { x.kids += b.q; x0.kids += b.q; } else { x.waste += b.q; x0.wasteYen += b.q * w.costs[p.id]; }
                    b.q = 0;
                }
            }
        }
        for (const p of prods) for (const k of ['back', 'ware', 'stock']) s[k][p.id] = s[k][p.id].filter(b => b.q > 0);
        // 限定商品 (作った 数を 7 日に わけて ならべる)
        for (const [rid, x] of Object.entries(w.lim)) {
            const rc = recipe(rid), st = s.limited[rid] = s.limited[rid] || [];
            const q = Math.ceil(x.made / 7) * (d < 6 ? 1 : 0) + (d === 6 ? x.made - Math.ceil(x.made / 7) * 6 : 0);
            if (q > 0) st.push({ q, age: 0 });
            let need = Math.round(day.served * rc.rate * (0.9 + rand(s) * 0.2)), sold = 0;
            const want = Math.round(day.all * rc.rate);
            for (const b of st) { const t = Math.min(b.q, need); b.q -= t; need -= t; sold += t; if (!need) break; }
            x.sold += sold; x.lost += Math.max(0, want - sold); x.sales += sold * rc.price; day.sales += sold * rc.price; x0.limitedSold += sold;
            for (const b of st) { b.age++; if (b.age >= C.limitedShelf + w.shelfPlus && b.q) { if (s.kids) x0.kids += b.q; else x.waste += b.q; b.q = 0; } }
            s.limited[rid] = st.filter(b => b.q > 0);
        }
        for (const g of SEGS) w.segServed[g] += day.sv[g];
        x0.sales += day.sales;
        x0.served += day.served; x0.walk += day.all - day.served;
        const { w: wt, temp } = s.weather[d];
        w.days.push({ w: wt, temp, customers: Math.round(day.served), walkAway: Math.round(day.all - day.served), sales: day.sales, gold: d === w.goldDay, dj: d === w.djDay, flags: day.flags, segs: Object.fromEntries(SEGS.map(g => [g, Math.round(day.sv[g])])) });
        w.day = null;
    }

    function runDay(s) {
        if (!s.wk) beginWeek(s);
        if (!s.wk) return null;
        const out = [];
        const d = s.wk.d;
        while (s.wk.d === d && s.wk.d < 7) out.push(runSlot(s));
        return out;
    }
    function runWeek(s) {
        if (s.over) return null;
        if (!s.wk) beginWeek(s);
        while (s.wk.d < 7) runSlot(s);
        return finishWeek(s);
    }

    // ----- 営業中に 手を 打つ (2026-11-17 ユーザー決定: 案B) -----
    // k = つぎの コマ (s.wk.d * 3 + s.wk.t)。できないと false
    const nextK = s => (s.wk ? s.wk.d * 3 + s.wk.t : -1);
    function midStock(s, id) { // すぐ 品出し: つぎの コマの 品出しの 力を つかって 倉庫 → 棚
        const w = s.wk, p = product(id);
        if (!w || w.d >= 7 || !p || p.self || p.cook || !available(s, id)) return false;
        const k = nextK(s), t = w.t;
        const left = slotPower(s, t, 'stock', k) - (w.act.stockUsed[k] || 0);
        const n = Math.floor(Math.min(left, capOf(s, p) - sumQ(s.stock[id]), sumQ(s.ware[id])));
        if (n <= 0) return false;
        put(s.stock[id], take(s.ware[id], n));
        s.ware[id] = s.ware[id].filter(b => b.q > 0);
        w.act.stockUsed[k] = (w.act.stockUsed[k] || 0) + n;
        w.work.stock[t] += n;
        return n;
    }
    function midRush(s, id, q) { // 緊急発注: つぎの 日の 朝に とどく (仕入れ値 高め・送料)
        const w = s.wk;
        q = Math.round(q);
        if (!w || w.d >= 6 || !available(s, id) || product(id).self || q <= 0) return false;
        const key = `${w.d + 1}:${id}`;
        if (!w.act.rush[key]) w.acc.rushFee += C.midweek.rushFee; // 送料は 週の おわりに 連携の 料金と いっしょに はらう
        w.act.rush[key] = (w.act.rush[key] || 0) + q;
        return true;
    }
    function midShift(s, id, t) { // シフトの 入れ替え (つぎの コマ から。やる気 −)
        const w = s.wk, m = s.staff.find(x => x.id === id);
        if (!w || !m || m.job !== 'shop') return false;
        m.slots[t] = m.slots[t] ? 0 : 1;
        m.mood = clamp(m.mood - C.midweek.shiftMood, 0, 100);
        return true;
    }
    function midCook(s) { // 調理を 増やす (つぎの コマ)
        const w = s.wk;
        if (!w || w.d >= 7) return false;
        w.act.cookBoost[nextK(s)] = true;
        return true;
    }
    function midCallout(s) { // こおりくんの 呼びこみ (つぎの コマ 来店 +。こおりくんは その コマ 働かない)
        const w = s.wk;
        if (!w || w.d >= 7 || !s.staff.some(m => m.id === 'koori' && m.job === 'shop')) return false;
        w.act.callout[nextK(s)] = true;
        return true;
    }

    // 棚 1 つの ようす (2026-11-17 ユーザー指定: 棚を 調べる)。営業中は 今の 日・コマ、そうでない ときは 先週の 数字
    function shelfInfo(s, id) {
        const p = product(id);
        if (!p) return null;
        const life = p.shelf ? p.shelf + (s.effects.hieishi ? 1 : 0) : 0;
        const exp = { green: 0, yellow: 0, red: 0 };
        for (const b of [...s.stock[id], ...(p.self ? s.ware[id] : [])]) {
            if (!life) { exp.green += b.q; continue; }
            const left = life - b.age;
            if (left <= 1) exp.red += b.q; else if (left === 2) exp.yellow += b.q; else exp.green += b.q;
        }
        const w = s.wk, live = !!(w && w.ps[id]);
        const ps = live ? w.ps[id] : s.lastPs && s.lastPs[id];
        const d = live ? Math.min(6, w.t === 0 && w.d > 0 ? w.d - 1 : w.d) : null;
        const dayOf = (src, dd) => (src ? [0, 1, 2].map(t => src.sold[dd * 3 + t]) : null);
        const doneT = live ? (w.t === 0 ? 3 : w.t) : 3; // 今日 おわった コマの 数 (先週と くらべる のは 同じ コマ まで)
        const lastSame = s.lastPs && s.lastPs[id] && d !== null ? dayOf(s.lastPs[id], d).map((v, t) => (t < doneT ? v : 0)) : null;
        const today = live ? dayOf(ps, d) : null;
        const outT = live ? [0, 1, 2].filter(t => ps.lost[d * 3 + t] > 0) : [];
        const lostToday = live ? [0, 1, 2].reduce((a, t) => a + ps.lost[d * 3 + t], 0) : 0;
        const weekSold = ps ? ps.sold.reduce((a, b) => a + b, 0) : 0;
        const weekLost = ps ? ps.lost.reduce((a, b) => a + b, 0) : 0;
        const onShelf = sumQ(p.self ? s.ware[id] : s.stock[id]);
        // ひとこと
        let note = '';
        const perSlot = today ? Math.max(...today) : weekSold / SLOTS;
        if (lostToday > 0 || (!live && weekLost > weekSold * 0.1)) note = 'sellout';
        else if (live && w.t > 0 && w.t < 3 && onShelf < perSlot * (3 - w.t) && sumQ(s.ware[id]) < perSlot) note = 'soon';
        else if (exp.red > Math.max(5, onShelf * 0.3)) note = 'left';
        else if (weekSold > 0 && onShelf > 0) note = 'good';
        return { p, live, d, doneT, onShelf, cap: p.self ? null : capOf(s, p), ware: sumQ(s.ware[id]) + sumQ(s.back[id]), exp, today, lastSame, outT, lostToday, weekSold, weekLost, note, margin: marginOf(s, id) };
    }
    // 早送りを 止めて 手を 打つ タイミング (2026-11-17 ユーザー決定)
    function alerts(s) {
        const w = s.wk;
        if (!w || w.d >= 7 || !w.slots.length) return [];
        const last = w.slots[w.slots.length - 1], out = [];
        const soon = prodsOf(s).filter(p => !p.self && !p.cook && shelfInfo(s, p.id).note === 'soon').map(p => p.id);
        if (soon.length) out.push({ kind: 'soon', ids: soon });
        if (last.outs.length) out.push({ kind: 'out', ids: last.outs });
        if (w.t === 0) {
            const red = prodsOf(s).filter(p => p.shelf && shelfInfo(s, p.id).exp.red > Math.max(20, capOf(s, p) * 0.25)).map(p => p.id);
            if (red.length >= 2) out.push({ kind: 'expire', ids: red });
        }
        if (last.walkAway > Math.max(15, last.want * 0.08)) out.push({ kind: 'queue', n: last.walkAway });
        return out;
    }

    function finishWeek(s) {
        const w = s.wk;
        const info = weekInfo(s.week);
        const { events, rep, lim, work, days, goldDay, djDay, djFee } = w;
        const say = (who, text) => events.push({ who, text });
        const prods = prodsOf(s);
        const { sales, buy, demandYen, lostYen, served, walk, kids, wasteYen, high, cheap, soldOut, limitedSold, shelfOutAll } = w.acc;
        const segServed = w.segServed;
        work.backlog = prods.reduce((a, p) => a + sumQ(s.back[p.id]), 0);
        work.shelfOut = shelfOutAll;
        // 前の 週に 作った 限定商品の のこりも 売れる (上で 売って いる)。作らなかった レシピの 古い 在庫も 期限で 消す
        for (const rid of Object.keys(s.limited)) if (!lim[rid]) {
            for (const b of s.limited[rid]) b.age += 7;
            s.limited[rid] = s.limited[rid].filter(b => b.age < C.limitedShelf + w.shelfPlus);
        }
        s.lastPs = w.ps;
        s.wk = null;

        // ----- お金 -----
        const wageSum = wages(s);
        const fees = C.partners.filter(p => !p.perUse && s.partners[p.id].on).reduce((a, p) => a + partnerFee(s, p.id), 0) + djFee + w.acc.rushFee;
        const royalty = Math.round(sales * C.royalty);
        const limitedCost = Object.entries(lim).reduce((a, [rid, x]) => a + x.made * recipe(rid).cost, 0);
        const upkeepSum = upkeep(s);
        const rent = rentOf(s);
        const profit = sales - buy - limitedCost - wageSum - rent - upkeepSum - royalty - fees;
        s.cash += profit;

        // ----- 評判と 常連 -----
        const repBefore = s.rep, regBefore = s.regulars;
        const assort = clamp(1 - (demandYen ? lostYen / demandYen : 0) * 2.5, 0, 1);
        // 接客 = 1 週間で レジまで たどりつけた 客の 割合 (イベントの 1 日だけ 混んでも 大きく 下がらない)
        const service = clamp((served / Math.max(1, served + walk) - 0.85) / 0.13, 0, 1);
        const avgRatio = prods.reduce((a, p) => a + ratioOf(s, p.id), 0) / prods.length;
        const cheapShop = avgRatio < C.cheapLine;
        const limitedRep = Object.entries(lim).reduce((a, [rid, x]) => a + (recipe(rid).rep && x.sold ? recipe(rid).rep : 0), 0);
        const facRep = s.facilities.reduce((a, id) => a + (facility(id).rep || 0), 0);
        const target = clamp(C.rep.base + assort * C.rep.assort + service * C.rep.service - (cheapShop ? 5 : 0) + facRep, 0, 100);
        s.rep = clamp(s.rep + (target - s.rep) * C.rep.move + Math.min(4, kids * C.kidsRep) + limitedRep + Math.min(2, limitedSold / 100), 0, 100);
        s.regulars = clamp(Math.round(s.regulars * (1 - C.regulars.lose) + (assort * service - 0.5) * C.regulars.gain + (cheapShop ? C.regulars.cheap : 0) - (s.occupy ? 10 : 0)), 0, C.regulars.max);

        // ともいし の 抜き打ち
        if (w.tomoDay >= 0) {
            const wasteRate = Object.values(rep).reduce((a, x) => a + x.waste, 0) / Math.max(1, Object.values(rep).reduce((a, x) => a + x.ordered, 0));
            const good = assort > 0.8 && wasteRate < 0.12 && service > 0.6;
            s.rep = clamp(s.rep + (good ? C.tomoishi.rep : -C.tomoishi.rep), 0, 100);
            say('tomoishi', good ? '抜き打ち チェック！ 棚も レジも ばっちり。評判 アップ！' : `抜き打ち チェック！ ${assort <= 0.8 ? '品切れ' : wasteRate >= 0.12 ? '廃棄' : 'レジの 行列'}が 目立つ…「内定とりなさい！」 評判 ダウン`);
        }
        if (goldDay >= 0) say('goldDog', `${C.dayNames[goldDay]}曜日に 伝説の 客 ゴールド金面犬が 来た！ 大入り！`);
        if (djDay >= 0) say('okagappa', `${C.dayNames[djDay]}曜日の DJ イベントで 大混雑！ YO！`);
        if (!s.flags.shibata && s.regulars >= C.shibata.regulars) { s.flags.shibata = true; say('shibata', 'シバターが 常連に なった！「この 店、わるくないね」'); }
        if (cheapShop) say('koori', '「安いだけの 店」って 言われてる… 常連は ふえるけど もうけが へる');

        // ----- スタッフ: やる気・ダンジョン -----
        const returned = [];
        for (const m of [...s.staff]) {
            const d = staffDef(m.id);
            if (m.job === 'shop') {
                m.mood = clamp(m.mood + C.mood.work[workSlots(m)], 0, 100);
                m.tired = false;
            } else {
                m.mood = clamp(m.mood - 3, 0, 100);
                m.back--;
                if (m.back <= 0) {
                    const dg = C.dungeons.find(x => x.id === m.dungeon);
                    const ex = d.st[4];
                    const fail = rand(s) < Math.max(0, (dg.danger - ex / 1.5) * 0.15);
                    const got = {};
                    for (const [k, [a, b]] of Object.entries(dg.rewards)) {
                        const n = Math.round(randInt(s, a, b) * (0.6 + 0.15 * ex) * (d.rare && d.rare.dungeon || 1) * (fail ? 0.5 : 1));
                        if (n > 0) { s.mats[k] += n; got[k] = n; }
                    }
                    if (rand(s) < dg.maboroshi * ex / 3 && !fail) { s.mats.maboroshi++; got.maboroshi = 1; }
                    let item = null;
                    if (rand(s) < dg.items * (fail ? 0.5 : 1)) { const ks = Object.keys(C.items); item = ks[Math.floor(rand(s) * ks.length)]; s.items[item]++; }
                    if (fail) m.mood = clamp(m.mood - 10, 0, 100);
                    m.job = 'shop'; m.dungeon = null; m.tired = true; m.left = false;
                    returned.push({ id: m.id, dungeon: dg.id, got, item, fail });
                    const list = Object.entries(got).map(([k, n]) => `${C.materials[k].name} ×${n}`).concat(item ? [C.items[item].name] : []);
                    say(d.art, `${dg.name}から 帰って きた！ ${fail ? 'てごわかった… ' : ''}${list.length ? list.join('・') : 'なにも なかった…'}${'（つかれて いる）'}`);
                }
            }
            if (!d.boss && m.mood <= C.mood.quit && m.job === 'shop') {
                s.staff = s.staff.filter(x => x !== m);
                say(d.art, `${d.name}が「もう むり…」と やめて しまった… (働かせすぎ)`);
            }
        }

        // ----- 特産品・連携・アイテム -----
        // 連携: 評判・材料
        for (const p of C.partners) if (partnerPower(s, p.id)) {
            if (p.rep) s.rep = clamp(s.rep + p.rep * partnerPower(s, p.id), 0, 100);
            if (p.mats) for (const [k, v] of Object.entries(p.mats)) {
                s.matAcc = s.matAcc || {};
                s.matAcc[k] = (s.matAcc[k] || 0) + v * partnerPower(s, p.id);
                const n = Math.floor(s.matAcc[k]); s.matAcc[k] -= n; s.mats[k] += n;
            }
        }
        s.localAcc += C.localPerWeek;
        for (const p of C.partners) if (p.local && s.partners[p.id].on) s.localAcc += p.local * partnerPower(s, p.id);
        const newLocal = Math.floor(s.localAcc);
        s.localAcc -= newLocal;
        s.mats.local += newLocal;
        for (const p of C.partners) {
            const st = s.partners[p.id];
            if (st.taken) { st.taken--; continue; }
            if (st.on) st.trust++;
            else if (!p.perUse && rand(s) < C.steal) { st.taken = C.stealWeeks; say('koori', `${p.name}が ライバル店に とられた… (${C.stealWeeks} 週 連携 できない)`); }
        }
        s.eventDay = -1;
        // 応募: 来週の はじめに とどく (やとわなかった 人は いなくなる)
        s.applicants = [];
        if (s.recruiting) {
            s.recruiting = false;
            const month = weekInfo(s.week + 1).start.month;
            const pool = C.staff.filter(d => !d.boss && !d.rare && !s.staff.some(m => m.id === d.id)).map(d => d.id);
            const n = Math.min(pool.length, randInt(s, C.recruit.min, C.recruit.max));
            for (let i = 0; i < n; i++) s.applicants.push(pool.splice(Math.floor(rand(s) * pool.length), 1)[0]);
            // 季節の レアスタッフ (その 月 だけ。確率で 応募に まざる)
            for (const d of C.staff) if (rareNow(d, month) && !s.staff.some(m => m.id === d.id) && rand(s) < C.recruit.rareChance) {
                s.applicants.push(d.id);
                if (!s.metRare.includes(d.id)) s.metRare.push(d.id);
                say(d.art, `★ レアスタッフ ${d.name}が 応募して きた！ (${d.rare.months.join('・')} 月 だけ)`);
            }
            if (s.applicants.length) say('koori', `アルバイトの 応募が ${s.applicants.length} 人 来た！ (シフトの ページで 面接)`);
            else say('koori', 'アルバイトの 応募は だれも 来なかった…');
        }
        for (const k of Object.keys(s.effects)) if (s.effects[k]) s.effects[k]--;

        // 地域の 知識 (売った 商品の 好みが 分かって くる)
        const kn = s.know[s.region] = s.know[s.region] || {};
        for (const p of prods) if (rep[p.id].sold) kn[p.id] = (kn[p.id] || 0) + 1;

        // ----- ライバル -----
        for (let i = 0; i < C.rivals.length; i++) {
            const cr = C.rivals[i], rv = s.rivals[i];
            const ev = info.event ? info.event.traffic : 1; // ライバルも 行事で 客が ふえる
            // エンドレスの 2 年目 から ライバルの のびは ゆっくり (endlessRivalGrow 倍)
            const gw = s.week <= C.weeks ? s.week : C.weeks + (s.week - C.weeks) * C.endlessRivalGrow;
            rv.sales.push(Math.round(cr.weekly * diffOf(s).rival * (1 + cr.grow * gw / C.weeks) * C.seasonTraffic[info.mi] * ev * (0.96 + rand(s) * 0.08)));
            if (rv.sales.length > C.rankWeeks) rv.sales.shift();
        }

        const report = {
            week: s.week, info, days, products: rep, limited: lim, sales, buy, limitedCost, wages: wageSum, wageList: s.staff.map(m => ({ id: m.id, yen: wageOf(m), slots: workSlots(m), job: m.job })), upkeep: upkeepSum, rent, royalty, fees, profit,
            customers: Math.round(served), walkAway: Math.round(walk), caps: [0, 1, 2].map(k => registerCap(s, k)), rushFee: w.acc.rushFee, slots: w.slots, assort, service, repBefore, repAfter: s.rep, regBefore, regAfter: s.regulars,
            high, cheap, soldOut, kids, wasteYen, segServed, events, returned, cheapShop, work, month: null
        };
        s.history.push({ week: s.week, sales, profit, customers: Math.round(served), rep: s.rep, cash: s.cash, products: rep });

        // ----- 月末: おにおにバンクへの 返済・Mr.SASAKI の 査定 -----
        if (monthEnds(s.week)) report.month = monthEnd(s, info);
        if (s.occupy) s.occupy--;

        s.week++;
        updateScores(s);
        report.rank = ranking(s).findIndex(x => x.me) + 1;
        report.score = s.score;
        if (report.rank === 1 && s.clearedWeek === null) { s.clearedWeek = s.week; report.firstClear = true; }
        if (s.mode === 'endless') { if (s.week % C.weeks === 0) report.yearEnd = yearOf(s.week - 1); }
        else if (report.rank === 1) s.over = 'clear';
        else if (s.week >= C.weeks) s.over = s.debt <= 0 ? 'normal' : 'bad';
        else prepareWeek(s);
        return report;
    }

    function monthEnd(s, info) {
        s.months++;
        const out = { month: info.start.month, interest: 0, paid: 0, missed: false, forced: 0 };
        // 赤字で お金が マイナスなら おにおにが 強制で 貸す (利息 アップ)
        if (s.cash < 0) { out.forced = -s.cash; s.debt += -s.cash; s.cash = 0; s.rate += C.bank.borrowRate; }
        if (s.months > C.bank.graceMonths && s.debt > 0) {
            out.interest = Math.round(s.debt * s.rate);
            s.debt += out.interest;
            const due = Math.min(s.debt, C.bank.pay + out.interest);
            if (s.cash >= due) { s.cash -= due; s.debt -= due; out.paid = due; }
            else { out.missed = true; s.occupy = C.bank.occupyWeeks + 1; s.debt += C.bank.lateFee; out.paid = Math.max(0, s.cash); s.debt -= out.paid; s.cash = 0; }
        } else if (s.debt > 0) out.grace = true;
        // Mr.SASAKI の 査定 (この 月の 売上の のび・品切れ・廃棄)
        const month = s.history.slice(-5).filter(h => !h.moved);
        const prev = s.history.slice(-10, -5).filter(h => !h.moved);
        const sum = a => a.reduce((x, h) => x + h.sales, 0) / Math.max(1, a.length);
        const growth = prev.length ? sum(month) / Math.max(1, sum(prev)) : 1.05;
        const wasteRate = month.reduce((a, h) => a + Object.values(h.products).reduce((b, x) => b + x.waste, 0), 0) / Math.max(1, month.reduce((a, h) => a + Object.values(h.products).reduce((b, x) => b + x.ordered, 0), 0));
        const pts = (growth - 1) * 100 + (s.rep - 50) / 5 - wasteRate * 40;
        out.grade = pts >= 12 ? 'S' : pts >= 5 ? 'A' : pts >= 0 ? 'B' : pts >= -6 ? 'C' : 'D';
        out.growth = growth;
        out.bonus = C.sasaki.bonus[out.grade] || 0;
        s.cash += out.bonus;
        return out;
    }

    // ----- コンビニランキング -----
    const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    function updateScores(s) {
        const mine = s.history.filter(h => !h.moved).slice(-C.rankWeeks).map(h => h.sales);
        s.score = Math.round(avg(mine) / 10000 + s.rep * 0.5);
        s.rivals.forEach((rv, i) => {
            const cr = C.rivals[i];
            const sales = rv.sales.length ? rv.sales : [cr.weekly * diffOf(s).rival];
            rv.score = Math.round(avg(sales) / 10000 + cr.rep * 0.5);
        });
    }
    function ranking(s) {
        return [{ name: s.name, score: s.score, me: true, owner: 'koori' }, ...s.rivals.map((rv, i) => ({ ...rv, boss: C.rivals[i].boss }))].sort((a, b) => b.score - a.score);
    }

    const Sim = {
        C, costOf, costChange, costDownOf, marginOf, setPrice, priceBounds, priceForMargin, moveCosts, diffOf, yearOf, levelOf, floorCap, facCap, rentOf, canExpand, expandStore, migrate, shelfUpkeep, rand, dateOf, weekInfo, monthEnds, newGame, available, capOf, stats, slotCap, rolePower, addShelf, removeShelf, shelfUnits, floorUsed, rareNow, setRole, bestRole, wareCap, wareUse, expandWare, slotWage, wageOf, wages, upkeep, upkeepOf, recruit, priceF, ratioOf, productFactor,
        estTraffic, estSlots, suggest, dailyNeed, stockOf, prepareWeek, facCost, buyFacility, removeFacility, hire, fire, toggleSlot, sendDungeon, recall,
        matsLeft, craftable, addCraft, useItem, setPartner, partnerFee, bookEvent, repay, borrow, relocate, knownPref, runWeek, beginWeek, runSlot, runDay, finishWeek, midStock, midRush, midShift, midCook, midCallout, shelfInfo, alerts, SLOTS, ranking,
        product, facility, staffDef, recipe, partner, regionOf, trioOn, inShop, hasFac, SEGS
    };
    if (typeof module !== 'undefined') module.exports = Sim;
    else root.Sim = Sim;
})(this);
