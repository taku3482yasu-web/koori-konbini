// こおりくんの コンビニ物語 — 経営の 計算 (画面に ふれない。node でも うごく)
(function (root) {
    const C = typeof module !== 'undefined' ? require('./config.js') : root.CONFIG;

    // ----- 乱数 (セーブ できる ように 状態は state.rs に もつ) -----
    function rand(s) {
        s.rs = (s.rs + 0x6D2B79F5) | 0;
        let t = s.rs;
        t = Math.imul(t ^ (t >>> 15), 1 | t);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const product = id => C.products.find(p => p.id === id);
    const upgrade = id => C.upgrades.find(u => u.id === id);

    // ----- こよみ -----
    function dateOf(day) {
        let m = 0;
        while (day >= C.monthDays[m]) { day -= C.monthDays[m]; m = (m + 1) % 12; }
        return { mi: m, month: ((m + C.startMonth - 1) % 12) + 1, date: day + 1 };
    }
    function weekInfo(week) {
        const a = dateOf(week * 7), b = dateOf(week * 7 + 6);
        return { start: a, end: b, mi: dateOf(week * 7 + 3).mi, event: C.events.find(e => e.week === week) || null };
    }

    function newGame(name, seed) {
        const s = {
            version: 1, name: name || C.defaultName, seed: seed >>> 0, rs: seed | 0,
            week: 0, cash: C.start.cash, rep: C.start.rep, staff: C.start.staff,
            upgrades: {}, prices: {}, orders: {}, stock: {}, lastDemand: {},
            campaign: 'none', total: 0, history: [], log: [], over: null,
            rivals: C.rivals.map(r => ({ name: r.name, owner: r.owner, total: 0, last: 0 }))
        };
        const info = weekInfo(0);
        for (const p of C.products) {
            s.prices[p.id] = 'normal';
            const d = Math.round(C.store.baseCustomers * p.rate * productFactor(s, p, C.temp[info.mi], 'sun', info.mi, null, null));
            s.lastDemand[p.id] = d;
            s.orders[p.id] = available(s, p.id) ? d : 0;
            s.stock[p.id] = !p.shelf && available(s, p.id) ? [{ q: d * 2, age: 0 }] : [];
        }
        prepareWeek(s);
        for (const p of C.products) if (available(s, p.id)) s.orders[p.id] = suggest(s, p.id);
        return s;
    }

    const available = (s, id) => { const p = product(id); return !p.needs || !!s.upgrades[p.needs]; };
    const capOf = (s, p) => Math.round(p.cap * C.upgrades.reduce((m, u) => m * (s.upgrades[u.id] && u.capMul && u.capMul[p.id] || 1), 1));
    const trafficUpgrades = s => C.upgrades.reduce((m, u) => m * (s.upgrades[u.id] && u.traffic || 1), 1);
    const capacity = s => Math.round((s.staff + 1) * C.staff.perPerson * C.upgrades.reduce((m, u) => m * (s.upgrades[u.id] && u.staffMul || 1), 1));

    // 商品ごとの 売れやすさ (気温・天気・行事・設備・値段)
    function productFactor(s, p, temp, weather, mi, event, random) {
        let f = 1;
        if (p.temp) f *= Math.max(0.2, p.temp[0] + p.temp[1] * temp);
        if (p.iceCurve) f *= Math.max(0.1, 1 + (temp - 22) * 0.12) * (weather === 'rain' ? 0.7 : 1);
        if (p.odenCurve) f *= Math.max(0, (22 - temp) * 0.08) * (weather === 'rain' || weather === 'snow' ? 1.15 : 1);
        if (event && event.boost && event.boost[p.id]) f *= event.boost[p.id];
        if (random && random.boost && random.boost[p.id]) f *= random.boost[p.id];
        for (const u of C.upgrades) if (s.upgrades[u.id] && u.boost && u.boost[p.id]) f *= u.boost[p.id];
        f *= C.prices[s.prices[p.id] || 'normal'].demand;
        return f;
    }

    // ----- 来週の 天気 (ほんとうの 天気と 予報) -----
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
    }

    function setStaff(s, n) {
        n = clamp(n, 0, C.staff.max);
        if (n > s.staff) s.cash -= (n - s.staff) * C.staff.hireCost;
        s.staff = n;
    }
    function buyUpgrade(s, id) {
        const u = upgrade(id);
        if (!u || s.upgrades[id] || s.cash < u.cost) return false;
        s.cash -= u.cost;
        s.upgrades[id] = s.week + 1;
        const p = C.products.find(x => x.needs === id);
        if (p) { s.orders[p.id] = s.orders[p.id] || suggest(s, p.id); s.lastDemand[p.id] = s.lastDemand[p.id] || suggest(s, p.id); }
        return true;
    }
    // 「おまかせ」の 目安 = 先週の 1 日 平均の 需要 (売れた + 売り逃し)。まだ 売って ない 商品は 今の 季節から 見つもる
    function suggest(s, id) {
        const p = product(id);
        if (!available(s, id)) return 0;
        const last = s.history.length && s.history[s.history.length - 1].products[id];
        if (last && last.demand) return Math.round(last.demand / last.open);
        const info = weekInfo(s.week);
        return Math.round(estTraffic(s, info) * p.rate * productFactor(s, p, C.temp[info.mi], 'sun', info.mi, info.event, null));
    }
    function estTraffic(s, info) {
        return C.store.baseCustomers * repFactor(s.rep) * C.seasonTraffic[info.mi] * trafficUpgrades(s) * (info.event ? info.event.traffic : 1);
    }
    const repFactor = rep => 0.7 + rep / 100 * 0.5;

    // ----- 1 週間 営業する -----
    function runWeek(s) {
        if (s.over) return null;
        const info = weekInfo(s.week);
        const camp = C.campaigns.find(c => c.id === s.campaign) || C.campaigns[0];
        const month = info.start.month;
        // 週の 途中の できごと
        let random = null;
        for (const e of C.random) {
            if (e.months && !e.months.includes(month)) continue;
            if (e.minRep && s.rep < e.minRep) continue;
            if (e.noCamera && s.upgrades.camera) continue;
            if (e.id === 'quit' && s.staff < 2) continue;
            if (rand(s) < e.chance) { random = e; break; }
        }
        const buzz = camp.buzz && rand(s) < camp.buzz;
        const closedDay = random && random.closed ? Math.floor(rand(s) * 7) : -1;
        const cap = capacity(s);
        const prods = C.products.filter(p => available(s, p.id));
        const rep = {};
        for (const p of prods) rep[p.id] = { ordered: 0, sold: 0, lost: 0, waste: 0, demand: 0, open: 0, sales: 0, cost: 0 };
        const days = [];
        let sales = 0, buy = 0, wasteCost = 0, demandYen = 0, lostYen = 0, peak = 0, customers = 0, walkAway = 0;
        for (let d = 0; d < 7; d++) {
            const { w, temp } = s.weather[d];
            const mi = dateOf(s.week * 7 + d).mi;
            const open = d !== closedDay;
            let traffic = C.store.baseCustomers * repFactor(s.rep) * C.dayTraffic[d] * C.weather[w].traffic * C.seasonTraffic[mi]
                * (info.event ? info.event.traffic : 1) * trafficUpgrades(s) * camp.traffic * (buzz ? 1.2 : 1) * (random && random.traffic || 1);
            traffic = open ? Math.round(traffic * (0.95 + rand(s) * 0.1)) : 0;
            const served = Math.min(traffic, cap);
            peak = Math.max(peak, traffic);
            customers += served;
            walkAway += traffic - served;
            let daySales = 0;
            for (const p of prods) {
                const r = rep[p.id], price = Math.round(p.price * C.prices[s.prices[p.id]].mul);
                const st = s.stock[p.id] || (s.stock[p.id] = []);
                // 朝の 入荷
                let q = Math.max(0, Math.round(s.orders[p.id] || 0));
                if (!p.shelf) q = Math.min(q, Math.max(0, capOf(s, p) - st.reduce((a, b) => a + b.q, 0)));
                if (q) { st.push({ q, age: 0 }); r.ordered += q; buy += q * p.cost; r.cost += q * p.cost; }
                if (open) {
                    // 店に 来られなかった お客さんの ぶんも 需要に 入れる (目安が 小さく なりすぎない ように)
                    const want = traffic * p.rate * productFactor(s, p, temp, w, mi, info.event, random) * (0.9 + rand(s) * 0.2);
                    let need = Math.round(want * (traffic ? served / traffic : 0));
                    const fullNeed = Math.round(want);
                    r.demand += fullNeed;
                    r.open++;
                    let sold = 0;
                    for (const b of st) { const t = Math.min(b.q, need); b.q -= t; need -= t; sold += t; if (!need) break; }
                    r.sold += sold;
                    r.lost += fullNeed - sold;
                    r.sales += sold * price;
                    daySales += sold * price;
                    demandYen += fullNeed * price;
                    lostYen += (fullNeed - sold) * price;
                }
                // 夜: 日持ちしない 商品の 廃棄
                if (p.shelf) {
                    for (const b of st) b.age++;
                    for (const b of st) if (b.age >= p.shelf && b.q) { r.waste += b.q; wasteCost += b.q * p.cost; b.q = 0; }
                }
                s.stock[p.id] = st.filter(b => b.q > 0);
            }
            sales += daySales;
            days.push({ w, temp, customers: served, walkAway: traffic - served, sales: daySales, open });
        }

        // お金
        const wages = s.staff * C.staff.wage;
        const loss = random && random.loss || 0;
        const royalty = Math.round(sales * C.royalty);
        const profit = sales - buy - wages - C.fixedCost - royalty - camp.cost - loss;
        s.cash += profit;
        s.total += sales;

        // 評判
        const repBefore = s.rep;
        const assort = clamp(1 - (demandYen ? lostYen / demandYen : 0) * 2.5, 0, 1);
        const service = clamp((cap / Math.max(1, peak) - 0.7) / 0.4, 0, 1);
        const priceRep = prods.reduce((a, p) => a + C.prices[s.prices[p.id]].rep, 0) / prods.length;
        const upRep = C.upgrades.reduce((a, u) => a + (s.upgrades[u.id] && u.rep || 0), 0);
        const target = clamp(C.rep.base + assort * C.rep.assort + service * C.rep.service + priceRep + upRep + (prods.length - 7) * 1.5, 0, 100);
        s.rep = clamp(s.rep + (target - s.rep) * C.rep.move + (camp.rep || 0) + (random && random.rep || 0), 0, 100);
        if (random && random.quit) s.staff = Math.max(0, s.staff - random.quit);

        // ライバル
        for (let i = 0; i < C.rivals.length; i++) {
            const cr = C.rivals[i], r = s.rivals[i];
            const renew = cr.renew && s.week >= cr.renew.week ? cr.renew.mul : 1;
            const ev = info.event ? 1 + (info.event.traffic - 1) * 0.6 : 1;
            r.last = Math.round(cr.daily * 7 * (1 + cr.grow * s.week / C.weeks) * C.seasonTraffic[info.mi] * ev * renew * (0.96 + rand(s) * 0.08));
            r.total += r.last;
        }

        const report = {
            week: s.week, info, days, products: rep, sales, buy, wasteCost, wages, fixed: C.fixedCost, royalty, campaign: camp.cost, loss, profit,
            customers, walkAway, cap, peak, assort, service, repBefore, repAfter: s.rep, random, buzz,
            rivalNews: C.rivals.filter(r => r.renew && r.renew.week === s.week).map(r => r.renew.text)
        };
        s.history.push({ week: s.week, sales, profit, customers, rep: s.rep, cash: s.cash, products: rep });
        s.week++;
        s.campaign = 'none';
        report.rank = ranking(s).findIndex(x => x.me) + 1;
        if (s.cash < C.bankrupt) s.over = 'bankrupt';
        else if (s.week >= C.weeks) s.over = 'end';
        else prepareWeek(s);
        return report;
    }

    function ranking(s) {
        return [{ name: s.name, total: s.total, me: true, last: s.history.length ? s.history[s.history.length - 1].sales : 0 }, ...s.rivals]
            .sort((a, b) => b.total - a.total);
    }

    const Sim = { C, rand, dateOf, weekInfo, newGame, available, capOf, capacity, trafficUpgrades, productFactor, prepareWeek, setStaff, buyUpgrade, suggest, estTraffic, repFactor, runWeek, ranking, product, upgrade };
    if (typeof module !== 'undefined') module.exports = Sim;
    else root.Sim = Sim;
})(this);
