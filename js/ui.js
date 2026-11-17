// こおりくんの コンビニ物語 — 画面
(() => {
    const C = CONFIG;
    const SAVE_KEY = 'koori-konbini-save';
    const $ = id => document.getElementById(id);
    const yen = n => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString()}円`;
    const man = n => `${n < 0 ? '−' : ''}${(Math.abs(n) / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })}万円`;
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const params = new URLSearchParams(location.search);
    let s = null, tab = 'order', running = false, skip = false;

    // ----- セーブ (読めない ときは なし で うごく) -----
    function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* なし */ } }
    function load() { try { const v = JSON.parse(localStorage.getItem(SAVE_KEY)); return v && v.version === 1 && !v.over ? v : null; } catch (e) { return null; } }
    function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* なし */ } }

    // ----- タイトル -----
    function title() {
        $('title').hidden = false;
        $('game').hidden = true;
        $('store-name').value = C.defaultName;
        $('continue-button').hidden = !load();
        const tc = $('title-art'), tg = tc.getContext('2d');
        tg.clearRect(0, 0, tc.width, tc.height);
        Art.draw(tg, 'koori', 160, 130, { height: 96 });
        ['yamamou', 'onioni', 'okagappa', 'ueno'].forEach((id, i) => Art.draw(tg, id, [40, 90, 230, 280][i], 130, { height: 56, flip: i < 2 }));
    }
    $('new-button').addEventListener('click', () => {
        const seed = params.get('seed') ? Number(params.get('seed')) : Math.floor(Math.random() * 2 ** 31);
        s = Sim.newGame($('store-name').value.trim() || C.defaultName, seed);
        start();
        say(`店長の こおりくん です！ 1 年で おかおか 1 の コンビニに なるぞ！ まずは 発注を きめて「えいぎょう」を 押してね。`);
    });
    $('continue-button').addEventListener('click', () => { s = load(); if (s) { start(); say('つづきから だよ。今週も がんばろう！'); } });

    function start() {
        $('title').hidden = true;
        $('game').hidden = false;
        Scene.setState(s);
        save();
        render();
    }

    function say(text, who = 'koori') {
        $('talk').innerHTML = `<img src="${Art.icon(who, 44)}" alt=""><p>${text}</p>`;
    }

    // ----- 画面 ぜんぶ -----
    function render() {
        const info = Sim.weekInfo(s.week);
        $('when-week').textContent = `第 ${s.week + 1} 週`;
        $('when-date').textContent = `${info.start.month}/${info.start.date} 〜 ${info.end.month}/${info.end.date}`;
        $('stat-cash').textContent = man(s.cash);
        $('stat-cash').className = s.cash < 0 ? 'bad' : '';
        $('stat-rep').textContent = Math.round(s.rep);
        $('stat-rank').textContent = s.history.length ? `${Sim.ranking(s).findIndex(x => x.me) + 1} 位` : '-';
        Scene.setDay({ w: s.forecast[0].w, temp: s.forecast[0].temp, month: info.start.month, event: info.event && info.event.name }, 0.25);
        renderOrder(info);
        renderStaff(info);
        renderShop();
        renderRank();
        updateCost();
    }

    function renderOrder(info) {
        const fc = s.forecast.map((f, i) => `<div class="fc"><small>${C.dayNames[i]}</small><span>${C.weather[f.w].icon}</span><small>${f.temp}℃</small></div>`).join('');
        const ev = info.event ? `<div class="event">🎌 今週は <b>${info.event.name}</b>${info.event.text ? `　${info.event.text}` : ''}</div>` : '';
        const next = C.events.find(e => e.week === s.week + 1);
        const nextEv = next ? `<div class="event next">来週は ${next.name}${next.text ? `: ${next.text}` : ''}</div>` : '';
        const last = s.history.length ? s.history[s.history.length - 1].products : null;
        const rows = C.products.map(p => {
            if (!Sim.available(s, p.id)) return `<tr class="locked"><td>${p.icon}</td><td colspan="5">${p.name} <small>(設備「${Sim.upgrade(p.needs).name}」で 売れる)</small></td></tr>`;
            const l = last && last[p.id];
            const lastText = l ? `${Math.round(l.sold / Math.max(1, l.open))}${l.lost ? ` <em class="lost">逃 ${Math.round(l.lost / Math.max(1, l.open))}</em>` : ''}${l.waste ? ` <em class="waste">廃 ${Math.round(l.waste / 7)}</em>` : ''}` : '-';
            const price = Math.round(p.price * C.prices[s.prices[p.id]].mul);
            return `<tr>
                <td class="icon">${p.icon}</td>
                <td class="pname">${p.name}<small>${price}円・${p.shelf ? `${p.shelf} 日で 廃棄` : `棚 ${Sim.capOf(s, p)}`}</small></td>
                <td><select data-price="${p.id}">${Object.entries(C.prices).map(([k, v]) => `<option value="${k}"${s.prices[p.id] === k ? ' selected' : ''}>${v.name}</option>`).join('')}</select></td>
                <td class="last">${lastText}</td>
                <td class="qty"><button data-step="${p.id}" data-d="-10">−</button><input type="number" min="0" step="10" data-order="${p.id}" value="${s.orders[p.id] || 0}"><button data-step="${p.id}" data-d="10">＋</button></td>
                <td><button class="mini" data-auto="${p.id}" title="先週の 1 日 平均 (売れた + 売り逃し)">目安 ${Sim.suggest(s, p.id)}</button></td>
            </tr>`;
        }).join('');
        $('tab-order').innerHTML = `${ev}${nextEv}
            <div class="forecast"><span class="lbl">天気予報</span>${fc}</div>
            <div class="order-head"><span>1 日に 入れる 数</span><button id="auto-all" class="mini">ぜんぶ 目安に する</button></div>
            <div class="table-wrap"><table class="orders"><thead><tr><th></th><th>商品</th><th>値段</th><th>先週/日</th><th>発注/日</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
            <p class="note">目安は 先週 1 日に ほしがられた 数。天気予報 (たまに はずれる) と 行事を 見て ふやしたり へらしたり しよう。<br>逃 = 売り切れで 買えなかった 数・廃 = 捨てた 数</p>`;
    }

    function renderStaff(info) {
        const est = Math.round(Sim.estTraffic(s, info));
        const cap = Sim.capacity(s);
        $('tab-staff').innerHTML = `
            <h3>スタッフ</h3>
            <div class="staff-row">
                <button data-staff="-1">−</button><b>${s.staff} 人</b><button data-staff="1">＋</button>
                <span>+ 店長 こおりくん</span>
            </div>
            <p>1 日に さばける お客さん: <b>${cap.toLocaleString()} 人</b>　今週の 見こみ: 約 ${est.toLocaleString()} 人 (土日は もっと)</p>
            <p class="note">お給料 1 人 ${yen(C.staff.wage)}/週・やとう ときに ${yen(C.staff.hireCost)}。足りないと お客さんが 帰って 評判も 下がる。</p>
            <h3>今週の 宣伝</h3>
            <div class="camps">${C.campaigns.map(c => `<label class="camp${s.campaign === c.id ? ' on' : ''}"><input type="radio" name="camp" value="${c.id}"${s.campaign === c.id ? ' checked' : ''}><b>${c.name}</b><small>${c.cost ? yen(c.cost) : ''}${c.text ? ` ${c.text}` : ''}</small></label>`).join('')}</div>`;
    }

    function renderShop() {
        $('tab-shop').innerHTML = `<p class="note">設備は いちど 買えば ずっと 使える。買うと すぐ 資金が へる。</p><div class="shop">${C.upgrades.map(u => {
            const have = s.upgrades[u.id];
            return `<div class="item${have ? ' have' : ''}"><span class="ui">${u.icon}</span><div><b>${u.name}</b><small>${u.text}</small></div>
                ${have ? '<span class="tag">設置ずみ</span>' : `<button data-buy="${u.id}"${s.cash < u.cost ? ' disabled' : ''}>${man(u.cost)}</button>`}</div>`;
        }).join('')}</div>`;
    }

    function renderRank() {
        const list = Sim.ranking(s);
        $('tab-rank').innerHTML = `<h3>おかおか市 コンビニ ランキング (1 年の 売上)</h3><ol class="rank">${list.map((r, i) => {
            const cr = C.rivals.find(x => x.name === r.name);
            return `<li class="${r.me ? 'me' : ''}"><span class="no">${i + 1}</span><img src="${Art.icon(r.me ? 'koori' : r.owner, 36)}" alt=""><div><b>${esc(r.name)}</b><small>${r.me ? '店長 こおりくん (あなたの お店)' : `店長 ${cr.boss}「${cr.line}」`}</small></div><span class="sum">${man(r.total)}<small>先週 ${man(r.last)}</small></span></li>`;
        }).join('')}</ol><p class="note">1 年 (52 週) の 売上の 合計で きまる。のこり ${C.weeks - s.week} 週。</p>`;
    }

    function updateCost() {
        const buy = C.products.reduce((a, p) => a + (Sim.available(s, p.id) ? (s.orders[p.id] || 0) * p.cost * 7 : 0), 0);
        const camp = C.campaigns.find(c => c.id === s.campaign).cost;
        $('cost-note').innerHTML = `今週の 仕入れ 約 ${man(buy)}・お給料 ${man(s.staff * C.staff.wage)}・家賃など ${man(C.fixedCost)}${camp ? `・宣伝 ${man(camp)}` : ''}`;
    }

    // ----- 操作 -----
    document.querySelector('.tabs').addEventListener('click', e => {
        const b = e.target.closest('button[data-tab]');
        if (!b) return;
        tab = b.dataset.tab;
        document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
        document.querySelectorAll('.panel').forEach(p => { p.hidden = p.id !== `tab-${tab}`; });
    });
    $('game').addEventListener('click', e => {
        if (running) return;
        const t = e.target.closest('button');
        if (!t) return;
        if (t.dataset.step) { s.orders[t.dataset.step] = Math.max(0, (s.orders[t.dataset.step] || 0) + Number(t.dataset.d)); refreshOrder(t.dataset.step); }
        else if (t.dataset.auto) { s.orders[t.dataset.auto] = Sim.suggest(s, t.dataset.auto); refreshOrder(t.dataset.auto); }
        else if (t.id === 'auto-all') { for (const p of C.products) if (Sim.available(s, p.id)) { s.orders[p.id] = Sim.suggest(s, p.id); refreshOrder(p.id); } }
        else if (t.dataset.staff) { Sim.setStaff(s, s.staff + Number(t.dataset.staff)); render(); }
        else if (t.dataset.buy) {
            const u = Sim.upgrade(t.dataset.buy);
            if (Sim.buyUpgrade(s, u.id)) { say(`「${u.name}」を 入れたよ！ ${u.text}`); render(); }
        }
        else return;
        save();
    });
    function refreshOrder(id) { const inp = document.querySelector(`input[data-order="${id}"]`); if (inp) inp.value = s.orders[id]; updateCost(); }
    $('game').addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.order) { s.orders[t.dataset.order] = Math.max(0, Math.round(Number(t.value) || 0)); t.value = s.orders[t.dataset.order]; updateCost(); }
        else if (t.dataset.price) { s.prices[t.dataset.price] = t.value; renderOrder(Sim.weekInfo(s.week)); }
        else if (t.name === 'camp') { s.campaign = t.value; renderStaff(Sim.weekInfo(s.week)); updateCost(); }
        save();
    });

    // ----- 1 週間 えいぎょう -----
    const wait = ms => new Promise(r => setTimeout(r, skip ? 0 : ms));
    $('go-button').addEventListener('click', async () => {
        if (running) return;
        running = true;
        skip = skip || params.get('fast') === '1';
        $('go-button').disabled = true;
        const month = Sim.weekInfo(s.week).start.month;
        const report = Sim.runWeek(s);
        save();
        $('ticker').hidden = false;
        $('skip-button').hidden = false;
        let total = 0;
        for (let d = 0; d < 7; d++) {
            const day = report.days[d];
            const dt = Sim.dateOf(report.week * 7 + d);
            total += day.sales;
            Scene.setDay({ w: day.w, temp: day.temp, month: dt.month, event: report.info.event && report.info.event.name }, day.open ? Math.min(1, day.customers / 1400) : 0);
            $('ticker').innerHTML = `<b>${dt.month}/${dt.date} (${C.dayNames[d]})</b> ${C.weather[day.w].icon} ${day.temp}℃　${day.open ? `お客さん ${day.customers.toLocaleString()} 人${day.walkAway > 20 ? ` <em>(${day.walkAway} 人 帰った)</em>` : ''}　売上 ${man(day.sales)}` : '停電で お休み'}<br><small>今週の 売上 ${man(total)}</small>`;
            await wait(900);
        }
        $('ticker').hidden = true;
        $('skip-button').hidden = true;
        running = false;
        skip = false;
        $('go-button').disabled = false;
        showReport(report, month);
    });
    $('skip-button').addEventListener('click', () => { skip = true; });

    function comment(r) {
        const lostRate = 1 - r.assort;
        const out = [];
        if (r.random) out.push(r.random.name);
        if (r.buzz) out.push('SNS の 投稿が バズった！ お客さんが いっぱい 来たよ！');
        if (r.walkAway > r.customers * 0.05) out.push(`レジが まにあわなくて ${r.walkAway.toLocaleString()} 人も 帰っちゃった… スタッフを ふやそう`);
        if (lostRate > 0.25) out.push('売り切れが 多かった… 発注を ふやそう');
        const waste = Object.values(r.products).reduce((a, p) => a + p.waste, 0), ordered = Object.values(r.products).reduce((a, p) => a + p.ordered, 0);
        if (waste > ordered * 0.15) out.push('捨てた 商品が 多い… もったいない');
        if (r.profit < 0) out.push('今週は 赤字だった… お金に 気を つけて');
        if (!out.length) out.push(r.rank === 1 ? 'おかおか 1 位を キープ！ この ちょうし！' : 'いい 1 週間 だった！');
        return out.join('<br>');
    }

    function showReport(r, month) {
        const prow = C.products.filter(p => r.products[p.id]).map(p => {
            const x = r.products[p.id];
            return `<tr><td>${p.icon} ${p.name}</td><td>${x.ordered}</td><td>${x.sold}</td><td class="${x.lost ? 'lost' : ''}">${x.lost}</td><td class="${x.waste ? 'waste' : ''}">${x.waste}</td><td>${man(x.sales)}</td></tr>`;
        }).join('');
        const days = r.days.map((d, i) => `<div class="fc"><small>${C.dayNames[i]}</small><span>${C.weather[d.w].icon}</span><small>${d.open ? d.customers : '休'}</small></div>`).join('');
        const repD = r.repAfter - r.repBefore;
        const newMonth = s.over ? false : Sim.weekInfo(s.week).start.month !== month;
        const news = r.rivalNews.map(t => `<p class="news">📰 ${t}</p>`).join('');
        const top = Sim.ranking(s)[0];
        const topLine = !top.me && newMonth ? (() => { const cr = C.rivals.find(x => x.name === top.name); return `<div class="rival-talk"><img src="${Art.icon(cr.owner, 40)}" alt=""><p><b>${cr.boss}</b>「${cr.line}」</p></div>`; })() : '';
        $('modal-box').innerHTML = `<h2>第 ${r.week + 1} 週の 報告${r.info.event ? ` <small>${r.info.event.name}</small>` : ''}</h2>
            <div class="forecast">${days}</div>
            <div class="sum-grid">
                <div><span>売上</span><b>${man(r.sales)}</b></div>
                <div><span>もうけ</span><b class="${r.profit < 0 ? 'bad' : 'good'}">${man(r.profit)}</b></div>
                <div><span>お客さん</span><b>${r.customers.toLocaleString()} 人</b></div>
                <div><span>評判</span><b>${Math.round(r.repAfter)} <small class="${repD >= 0 ? 'good' : 'bad'}">${repD >= 0 ? '▲' : '▼'}${Math.abs(repD).toFixed(1)}</small></b></div>
                <div><span>順位</span><b>${r.rank} 位</b></div>
                <div><span>資金</span><b class="${s.cash < 0 ? 'bad' : ''}">${man(s.cash)}</b></div>
            </div>
            <details><summary>お金の くわしい ところ</summary><p class="money">売上 ${yen(r.sales)}<br>仕入れ −${yen(r.buy)} (うち 廃棄 ${yen(r.wasteCost)})<br>お給料 −${yen(r.wages)}<br>家賃など −${yen(r.fixed)}<br>本部へ (売上の ${Math.round(C.royalty * 100)}%) −${yen(r.royalty)}${r.campaign ? `<br>宣伝 −${yen(r.campaign)}` : ''}${r.loss ? `<br>万引き −${yen(r.loss)}` : ''}</p></details>
            <div class="table-wrap"><table class="orders small"><thead><tr><th>商品</th><th>入荷</th><th>売れた</th><th>売り逃し</th><th>廃棄</th><th>売上</th></tr></thead><tbody>${prow}</tbody></table></div>
            <div class="talk in"><img src="${Art.icon('koori', 44)}" alt=""><p>${comment(r)}</p></div>
            ${news}${topLine}
            <button id="next-button" class="big">${s.over ? 'けっかを 見る' : 'つぎの 週へ'}</button>`;
        $('modal').hidden = false;
        $('next-button').addEventListener('click', () => {
            $('modal').hidden = true;
            if (s.over) ending();
            else { render(); say(`第 ${s.week + 1} 週。${Sim.weekInfo(s.week).event ? `今週は ${Sim.weekInfo(s.week).event.name}！ 発注を 多めに しよう。` : '天気予報を 見て 発注を きめよう。'}`); }
        });
    }

    // ----- エンディング -----
    function ending() {
        const list = Sim.ranking(s);
        const rank = list.findIndex(x => x.me) + 1;
        clearSave();
        let head, text;
        if (s.over === 'bankrupt') { head = '閉店…'; text = 'お金が なくなって お店を 閉めることに なった…。つぎは 仕入れと 設備の 買いかたに 気を つけよう。'; }
        else if (rank === 1) { head = 'おかおか 1 の コンビニに なった！'; text = `1 年間 おつかれさま！ 「${esc(s.name)}」は おかおか市で いちばん 売れる コンビニに なった！ おにおにも くやしがってるぞ。`; }
        else { head = `おかおか ${rank} 位`; text = `1 年間 おつかれさま！ おしくも ${rank} 位。1 位の ${esc(list[0].name)} まで あと ${man(list[0].total - s.total)}。つぎこそ おかおか 1 を めざそう！`; }
        const best = s.history.reduce((a, h) => (h.sales > a.sales ? h : a), s.history[0] || { sales: 0, week: 0 });
        $('modal-box').innerHTML = `<h2 class="end-title">${head}</h2>
            <canvas id="end-art" width="320" height="120"></canvas>
            <p>${text}</p>
            <div class="sum-grid">
                <div><span>1 年の 売上</span><b>${man(s.total)}</b></div>
                <div><span>のこった 資金</span><b>${man(s.cash)}</b></div>
                <div><span>評判</span><b>${Math.round(s.rep)}</b></div>
                <div><span>いちばん 売れた 週</span><b>第 ${best.week + 1} 週</b></div>
            </div>
            <ol class="rank">${list.map((r, i) => `<li class="${r.me ? 'me' : ''}"><span class="no">${i + 1}</span><img src="${Art.icon(r.me ? 'koori' : r.owner, 36)}" alt=""><div><b>${esc(r.name)}</b></div><span class="sum">${man(r.total)}</span></li>`).join('')}</ol>
            <button id="again-button" class="big">タイトルへ</button>`;
        $('modal').hidden = false;
        const ec = $('end-art').getContext('2d');
        if (rank === 1 && s.over !== 'bankrupt') { Art.draw(ec, 'koori', 160, 116, { height: 90 }); ['yamamou', 'ueno', 'sasaki', 'goldDog'].forEach((id, i) => Art.draw(ec, id, [40, 95, 225, 280][i], 116, { height: 50 })); }
        else Art.draw(ec, s.over === 'bankrupt' ? 'koori' : 'koori', 160, 116, { height: 80 });
        $('again-button').addEventListener('click', () => { $('modal').hidden = true; title(); });
    }

    Scene.init($('scene'));
    title();
    // 画面の 確認用: ?play=1 で すぐ はじめる・&tab=shop など
    if (params.get('play') === '1') {
        $('new-button').click();
        if (params.get('tab')) document.querySelector(`.tabs button[data-tab="${params.get('tab')}"]`).click();
        if (params.get('cash')) { s.cash = Number(params.get('cash')); render(); }
        if (params.get('report') === '1') { skip = true; $('go-button').click(); }
    }
})();
