// こおりくんのコンビニ（仮） — 画面
(() => {
    const C = CONFIG;
    const SAVE_KEY = 'koori-konbini-save-v2';
    const $ = id => document.getElementById(id);
    const yen = n => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString()}円`;
    const man = n => `${n < 0 ? '−' : ''}${(Math.abs(n) / 10000).toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) < 100000 ? 1 : 0 })}万円`;
    const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const img = (id, size = 36) => (id ? `<img class="face" src="${Art.icon(id, size)}" alt="" width="${size}" height="${size}">` : '<span class="face blank">？</span>');
    const params = new URLSearchParams(location.search);
    let s = null, running = false, skip = false, lastReport = null, difficulty = 'normal', mode = 'year', showLocked = false;

    // レアスタッフ図鑑 (2026-11-17 ユーザー指定: やりこみ)。何回 遊んでも のこる
    const ZUKAN_KEY = 'koori-konbini-zukan';
    function zukan() { try { const z = JSON.parse(localStorage.getItem(ZUKAN_KEY)); return { met: (z && z.met) || [], hired: (z && z.hired) || [], sold: (z && z.sold) || [] }; } catch (e) { return { met: [], hired: [], sold: [] }; } }
    function saveZukan() {
        if (!s) return;
        const z = zukan();
        for (const id of s.metRare || []) if (!z.met.includes(id)) z.met.push(id);
        for (const id of s.everHired || []) if (Sim.staffDef(id).rare && !z.hired.includes(id)) z.hired.push(id);
        // 売った 商品 (2026-11-17 ユーザー指定: 9-3 図鑑に「売った 商品」)
        z.sold = z.sold || [];
        for (const id of s.soldSkus || []) if (!z.sold.includes(id)) z.sold.push(id);
        try { localStorage.setItem(ZUKAN_KEY, JSON.stringify(z)); } catch (e) { /* なし */ }
    }
    const RARES = C.staff.filter(d => d.rare);
    function save() { saveZukan(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* なし */ } }
    function load() { try { const v = JSON.parse(localStorage.getItem(SAVE_KEY)); return v && v.version === 2 && !v.over ? Sim.migrate(v) : null; } catch (e) { return null; } }
    function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* なし */ } }
    function show(id) { ['title', 'story', 'region', 'game'].forEach(x => { $(x).hidden = x !== id; }); }

    // ----- タイトル -----
    function title() {
        show('title');
        $('store-name').value = 'こおりマート';
        $('continue-button').hidden = !load();
        renderDiff();
        const z = zukan();
        $('zukan-line').textContent = `★ レアスタッフ図鑑 ${z.hired.length} / ${RARES.length} 人 (会った ${z.met.length} 人)`;
        const g = $('title-art').getContext('2d');
        g.clearRect(0, 0, 320, 140);
        Art.draw(g, 'koori', 160, 130, { height: 96 });
        [['furukawa', 40], ['onioni', 95], ['yasu', 225], ['dake', 280]].forEach(([id, x], i) => Art.draw(g, id, x, 130, { height: 56, flip: i < 2 }));
    }
    // 難易度 (2026-11-17 ユーザー指定)
    function renderDiff() {
        $('diff-row').innerHTML = Object.entries(C.difficulties).map(([k, d]) => `<button class="chip${difficulty === k ? ' on' : ''}" data-diff="${k}">${d.name}</button>`).join('');
        $('diff-text').textContent = C.difficulties[difficulty].text;
        $('mode-row').innerHTML = Object.entries(C.modes).map(([k, d]) => `<button class="chip${mode === k ? ' on' : ''}" data-mode="${k}">${d.name}</button>`).join('');
        $('mode-text').textContent = C.modes[mode].text;
    }
    $('mode-row').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) { mode = b.dataset.mode; renderDiff(); } });
    $('diff-row').addEventListener('click', e => { const b = e.target.closest('[data-diff]'); if (b) { difficulty = b.dataset.diff; renderDiff(); } });
    $('new-button').addEventListener('click', () => story(OPENING, regionSelect));
    $('continue-button').addEventListener('click', () => { s = load(); if (s) { start(); say('furukawa', s.wk ? '営業の 途中から だね。▶ で つづけよう！' : 'つづきから だね。今週も たのむよ！'); if (s.wk) resumeWeek(); } });

    // ----- お話 (企画書の あらすじ) -----
    const OPENING = [
        ['koori', 'こおりくん', 'ぜんぶ 落ちた…。就活、ぜんめつ…。'],
        ['furukawa', 'ふるカワ', 'こおりくん、新しい プロジェクトが あるんだ。「おかおか コンビニ計画」。コンビニの 店長を やって みないか？'],
        ['koori', 'こおりくん', 'ぼくが 店長！？ やります！'],
        ['furukawa', 'ふるカワ', 'ただし わたせるのは 何も ない コンビニ 1 店だけ。しめきりは 1 年。それまでに おかおか 1 の コンビニに して くれ。'],
        ['onioni', 'おにおに', 'がっはっは！ 足りない ものは この おにおにバンクが 貸して やる。しめて 100 万円！'],
        ['onioni', 'おにおに', '最初の 1 か月は つけに して やる。そのあとは 毎月 取り立てに 来るからな！'],
        ['koori', 'こおりくん', '借金 100 万円…！ 結果が 出ないと… こおり いきていけない！'],
        ['furukawa', 'ふるカワ', 'まずは どこに 店を 作るか きめよう。地域で 来る 客も 売れる 物も ちがうよ。']
    ];
    let storyLines = [], storyDone = null, storyIdx = 0;
    function story(lines, done) {
        storyLines = lines; storyDone = done; storyIdx = 0;
        show('story');
        storyStep();
    }
    function storyStep() {
        if (storyIdx >= storyLines.length) { storyDone(); return; }
        const [id, name, text] = storyLines[storyIdx];
        const g = $('story-art').getContext('2d');
        g.clearRect(0, 0, 320, 130);
        Art.draw(g, id, 160, 124, { height: 100 });
        $('story-name').textContent = name;
        $('story-text').textContent = text;
    }
    $('story-next').addEventListener('click', () => { storyIdx++; storyStep(); });
    $('story-skip').addEventListener('click', () => { storyIdx = storyLines.length; storyStep(); });

    // ----- 出店地 -----
    function regionSelect() {
        show('region');
        $('region-list').innerHTML = C.regions.map(r => {
            const total = Object.values(r.base).reduce((a, b) => a + b, 0);
            const segs = Sim.SEGS.map(g => `<span class="seg">${C.segments[g].icon} ${C.segments[g].name} ${Math.round(r.base[g] / total * 100)}%</span>`).join('');
            return `<button class="region-card" data-region="${r.id}"><span class="ricon">${r.icon}</span><b>${r.name}</b><small>${r.text}</small>
                <div class="segs">${segs}</div><small>家賃 ${man(r.rent)}/週・特産品 ${r.local.icon} ${r.local.name}・駐車場 ${man(C.facilities.find(f => f.id === 'parking').cost * r.parkingMul)}</small></button>`;
        }).join('');
    }
    $('region-list').addEventListener('click', e => {
        const b = e.target.closest('[data-region]');
        if (!b) return;
        const seed = params.get('seed') ? Number(params.get('seed')) : Math.floor(Math.random() * 2 ** 31);
        s = Sim.newGame($('store-name').value.trim() || 'こおりマート', seed, b.dataset.region, difficulty, mode);
        start();
        setTimeout(tutStart, 400);
        say('furukawa', `${Sim.regionOf(s).name}に 開店！ 店は からっぽ。商品は 発注しないと とどかないよ。まずは 発注 (「ぜんぶ 目安に」でも いい) と シフト・持ち場を きめて「営業する」だ。`);
    });

    function start() {
        show('game');
        Sound.play('day');
        Scene.setState(s);
        save();
        render();
    }
    function say(who, text) { $('talk').innerHTML = `${img(who, 44)}<p>${text}</p>`; }

    // ----- 画面 ぜんぶ -----
    let tab = 'order';
    function render() {
        const info = Sim.weekInfo(s.week);
        $('when-week').textContent = s.mode === 'endless' ? `${Sim.yearOf(s.week)} 年目 第 ${s.week % C.weeks + 1} 週` : `第 ${s.week + 1} 週`;
        $('when-date').textContent = `${info.start.month}/${info.start.date}〜${info.end.month}/${info.end.date}・${Sim.diffOf(s).name}`;
        $('stat-cash').textContent = man(s.cash);
        $('stat-cash').className = s.cash < 0 ? 'bad' : '';
        $('stat-debt').textContent = s.debt > 0 ? man(s.debt) : 'なし';
        $('stat-debt').className = s.debt > 0 ? 'bad' : 'good';
        $('stat-rep').textContent = `${Math.round(s.rep)}`;
        $('stat-rank').textContent = `${Sim.ranking(s).findIndex(x => x.me) + 1} 位`;
        Scene.setDay({ w: s.forecast[0].w, temp: s.forecast[0].temp, label: '予報' }, 0.2);
        renderOrder(info);
        renderStaff();
        renderShop();
        renderPartner();
        renderBank();
        renderArea();
        renderRank();
        updateCost();
        if (tut >= 0) setTimeout(tutShow, 0);
    }

    // 種類 (2026-11-17 ユーザー指定: 9 章)。発注の 表で ひらいて いる グループ
    const openGroups = new Set();
    function skuTags(k) {
        let t = '';
        if (k.months) t += '<span class="tag lim">期間限定</span>';
        if (s.newUntil && s.newUntil[k.id] > s.week) t += '<span class="tag new">新発売</span>';
        if (s.boom && s.boom.id === k.id && s.boom.until > s.week) t += '<span class="tag boom">🔥ブーム</span>';
        if (!Sim.skuOn(s, k)) t += '<span class="tag">期間 おわり</span>';
        return t;
    }
    // おまかせ: 人気の じゅんに 棚に のる 種類を 目安で、ほかは 0
    function autoGroup(gid) {
        for (const k of Sim.skusOf(gid)) s.orders[k.id] = 0;
        for (const k of Sim.pickSkus(s, gid)) s.orders[k.id] = Sim.suggest(s, k.id);
    }
    function autoAll() { for (const p of C.products) if (Sim.available(s, p.id)) { if (Sim.hasVariety(p.id)) autoGroup(p.id); else s.orders[p.id] = Sim.suggest(s, p.id); } }
    function lastOf(id) { const h = s.history.filter(x => !x.moved); return h.length ? h[h.length - 1].products[id] : null; }
    function prefMark(id) { const k = Sim.knownPref(s, id); return k === 'up' ? '<em class="up" title="この 地域で よく 売れる">↑</em>' : k === 'down' ? '<em class="down" title="この 地域では 売れにくい">↓</em>' : k === 'flat' ? '' : '<em class="q" title="売って いくと 好みが 分かる">？</em>'; }

    function renderOrder(info) {
        const r = Sim.regionOf(s);
        const fc = s.forecast.map((f, i) => `<div class="fc"><small>${C.dayNames[i]}</small><span>${C.weather[f.w].icon}</span><small>${f.temp}℃</small></div>`).join('');
        const ev = info.event ? `<div class="event">🎌 今週は <b>${info.event.name}</b>${info.event.text ? `　${info.event.text}` : ''}</div>` : '';
        const next = C.events.find(e => e.week === s.week + 1);
        let lastCat = null;
        // 1 種類の 行 (種類を もたない 商品は グループ そのもの)。sub = グループの 中の 種類
        const skuRow = (k, sub) => {
            const p = k, l = lastOf(k.id);
            const ratio = s.prices[k.id] / k.price;
            const voice = ratio > r.line * 1.08 ? '<span class="voice high">高っ…</span>' : ratio < C.cheapLine ? '<span class="voice cheap">安っ！</span>' : '';
            const qOf = key => (s[key][k.id] || []).reduce((a, b) => a + b.q, 0);
            const stockText = p.self ? `豆 ${qOf('ware')}` : sub ? `棚 ${qOf('stock')}<br>倉庫 ${qOf('ware') + qOf('back')}` : `棚 ${qOf('stock')}<small>/${Sim.capOf(s, p)}</small><br>倉庫 ${qOf('ware') + qOf('back')}`;
            const lastText = l ? `${Math.round(l.sold / Math.max(1, l.open))}${l.lost ? ` <em class="lost">逃${Math.round(l.lost / Math.max(1, l.open))}</em>` : ''}${l.refused ? ` <em class="lost">断${Math.round(l.refused / 7)}</em>` : ''}${l.waste ? ` <em class="waste">廃${Math.round(l.waste / 7)}</em>` : ''}${l.kids ? ` <em class="kids">食${Math.round(l.kids / 7)}</em>` : ''}` : '-';
            const mg = Sim.marginOf(s, k.id), ch = Sim.costChange(s, k.id), down = Sim.costDownOf(s, k.id) < 1;
            const why = (s.costWhy && s.costWhy[k.id] || []).join('・');
            const tags = skuTags(k);
            return `<tr class="${mg.yen <= 0 ? 'loss' : ''}${sub ? ` sub g-${k.group}` : ''}"${sub && !openGroups.has(k.group) ? ' hidden' : ''}>
                <td class="icon">${sub ? '' : p.icon}</td>
                <td class="pname">${sub ? `<span class="subname">${k.name}</span>${tags}` : `${p.name}${prefMark(p.id)}`}<small>${sub ? `人気 ${Math.round(Sim.shareOf(s, k.id) * 100)}%` : `${p.shelf ? `期限 ${p.shelf} 日` : '日持ちする'}${p.cook ? '・調理' : ''}`}</small></td>
                <td class="cost" title="${why}${down ? `${why ? '・' : ''}連携で 安く なって いる` : ''}"><b>${mg.cost}円</b>${ch ? `<em class="${ch > 0 ? 'up' : 'down'}">${ch > 0 ? '↑' : '↓'}${Math.abs(ch)}円</em>` : ''}${down ? '<em class="partner">連携</em>' : ''}</td>
                <td class="qty price"><button data-price="${k.id}" data-d="-1">−</button><button class="pbtn" data-pmenu="${k.id}" title="値段の メニュー">${s.prices[k.id]}円</button><button data-price="${k.id}" data-d="1">＋</button>${voice}</td>
                <td class="margin ${mg.yen <= 0 ? 'neg' : mg.rate < C.lowMargin ? 'low' : ''}">${mg.yen >= 0 ? '+' : '−'}${Math.abs(mg.yen)}円<small> (${Math.round(mg.rate * 100)}%)</small></td>
                <td class="last">${lastText}</td>
                <td class="stockq">${stockText}</td>
                <td class="qty order"><button data-step="${k.id}" data-d="-10">−</button><input type="number" min="0" step="10" data-order="${k.id}" value="${s.orders[k.id] || 0}"><button data-step="${k.id}" data-d="10">＋</button></td>
                <td class="auto"><button class="mini" data-auto="${k.id}" title="先週 1 日に 売れそうだった 数 (日持ちする 商品は 在庫も 見る)">目安 ${Sim.suggest(s, k.id)}</button></td>
            </tr>`;
        };
        // グループの 行 (種類を もつ 商品。はじめは たたんで ある。合計の 発注・もうけ)
        const groupRow = p => {
            const ks = Sim.groupSkus(s, p.id), all = Sim.skusOf(p.id).filter(k => ks.includes(k) || Sim.stockOf(s, k.id) > 0);
            const open = openGroups.has(p.id);
            const sum = (f) => all.reduce((a, k) => a + f(k), 0);
            const qOf = (k, key) => (s[key][k.id] || []).reduce((a, b) => a + b.q, 0);
            const costs = ks.map(k => Sim.marginOf(s, k.id).cost), prices = ks.map(k => s.prices[k.id]);
            const ordered = sum(k => s.orders[k.id] || 0);
            const profit = sum(k => (s.orders[k.id] || 0) * Sim.marginOf(s, k.id).yen);
            const rate = sum(k => (s.orders[k.id] || 0) * s.prices[k.id]) ? profit / sum(k => (s.orders[k.id] || 0) * s.prices[k.id]) : null;
            const carried = all.filter(k => (s.orders[k.id] || 0) > 0 || Sim.stockOf(s, k.id) > 0).length;
            const anyLoss = ks.some(k => Sim.marginOf(s, k.id).yen <= 0), anyUp = ks.some(k => Sim.costChange(s, k.id) > 0);
            const last = all.map(k => lastOf(k.id)).filter(Boolean);
            const lsum = key => last.reduce((a, x) => a + (x[key] || 0), 0), open7 = last.length ? Math.max(1, last[0].open) : 1;
            const lastText = last.length ? `${Math.round(lsum('sold') / open7)}${lsum('lost') - lsum('subIn') > 0 ? ` <em class="lost">帰${Math.round((lsum('lost') - lsum('subIn')) / open7)}</em>` : ''}${lsum('waste') ? ` <em class="waste">廃${Math.round(lsum('waste') / 7)}</em>` : ''}` : '-';
            const hot = ks.filter(k => skuTags(k)).length;
            return `<tr class="grp${anyLoss ? ' loss' : ''}">
                <td class="icon">${p.icon}</td>
                <td class="pname"><button class="gtoggle" data-gopen="${p.id}">${open ? '▾' : '▸'} ${p.name}</button>${prefMark(p.id)}<small>種類 ${carried}/${ks.length}・棚に ${Sim.facingsOf(s, p.id)} 種類 まで${hot ? `・<b class="hot">注目 ${hot}</b>` : ''}・${p.shelf ? `期限 ${p.shelf} 日` : '日持ちする'}</small></td>
                <td class="cost"><b>${Math.min(...costs)}〜${Math.max(...costs)}円</b>${anyUp ? '<em class="up">↑ あり</em>' : ''}</td>
                <td class="price"><small>${Math.min(...prices)}〜${Math.max(...prices)}円</small><br><button class="mini" data-gopen="${p.id}">${open ? 'たたむ' : '種類ごとに きめる'}</button></td>
                <td class="margin ${anyLoss ? 'neg' : rate !== null && rate < C.lowMargin ? 'low' : ''}">${rate === null ? '-' : `+${Math.round(profit).toLocaleString()}円<small> (${Math.round(rate * 100)}%)/日</small>`}</td>
                <td class="last">${lastText}</td>
                <td class="stockq">棚 ${sum(k => qOf(k, 'stock'))}<small>/${Sim.capOf(s, p)}</small><br>倉庫 ${sum(k => qOf(k, 'ware') + qOf(k, 'back'))}</td>
                <td class="qty order"><button data-gstep="${p.id}" data-d="-10">−</button><input type="number" min="0" step="10" data-gorder="${p.id}" value="${ordered}" title="合計。入れると 先週の 売れ行きで 種類に 分ける"><button data-gstep="${p.id}" data-d="10">＋</button></td>
                <td class="auto"><button class="mini" data-gauto="${p.id}" title="人気の じゅんに 棚に のる 種類を 目安で 発注">おまかせ ${Sim.pickSkus(s, p.id).reduce((a, k) => a + Sim.suggest(s, k.id), 0)}</button></td>
            </tr>${ks.concat(all.filter(k => !ks.includes(k))).map(k => skuRow(k, true)).join('')}`;
        };
        const rows = C.products.map(p => {
            const head = p.cat !== lastCat ? `<tr class="cat"><th colspan="9">${C.cats[p.cat]}</th></tr>` : '';
            lastCat = p.cat;
            if (!Sim.available(s, p.id)) return head + (showLocked ? `<tr class="locked"><td class="icon">${p.icon}</td><td colspan="8">${p.name} <small>(${p.needs && !Sim.hasFac(s, p.needs) ? `施設「${Sim.facility(p.needs).name}」で 売れる` : `「棚・施設」で ${C.shelfTypes[p.type].name}を 置くと 売れる`})</small></td></tr>` : '');
            return head + (Sim.hasVariety(p.id) ? groupRow(p) : skuRow(Sim.sku(p.id), false));
        }).join('');
        // 今週 仕入れが 上がった・下がった 商品 (種類ごと。多い ときは ほか n)
        const sold = C.skus.filter(k => Sim.available(s, k.id));
        const ups = sold.filter(p => Sim.costChange(s, p.id) > 0), downs = sold.filter(p => Sim.costChange(s, p.id) < 0);
        const losses = sold.filter(p => Sim.marginOf(s, p.id).yen <= 0);
        const few = (list, f, n = 8) => list.slice(0, n).map(f).join('') + (list.length > n ? `<span>ほか ${list.length - n}</span>` : '');
        const costBox = ups.length || downs.length || losses.length ? `<div class="costbox">
            ${ups.length ? `<div><b class="bad">↑ 今週 仕入れが 上がった</b> ${few(ups, p => `<span title="${(s.costWhy[p.id] || []).join('・')}">${p.icon}${p.single ? p.name : p.full} +${Sim.costChange(s, p.id)}円</span>`)}</div>` : ''}
            ${downs.length ? `<div><b class="good">↓ 下がった</b> ${few(downs, p => `<span>${p.icon}${p.single ? p.name : p.full} −${-Sim.costChange(s, p.id)}円</span>`)}</div>` : ''}
            ${losses.length ? `<div><b class="bad">⚠ 赤字</b> ${few(losses, p => `<span>${p.icon}${p.single ? p.name : p.full}</span>`)} <small>売り値を 見なおそう</small></div>` : ''}</div>` : '';
        // 本部の 新商品・ブーム (2026-11-17 ユーザー指定: 9-3)
        const offer = s.offer ? (() => { const k = Sim.sku(s.offer); return `<div class="offer">${img('sasaki', 40)}<div><b>新商品の おすすめ: ${k.icon} ${k.full}</b><small>${k.price}円・仕入れ ${Sim.costOf(s, k.id)}円。置くと ${C.launch.newWeeks} 週 人気 ×${C.launch.newMul}。置くか どうかは きみが きめて いい</small></div><span class="btns"><button class="mini go" data-offer="yes">置く</button><button class="mini" data-offer="no">見送る</button></span></div>`; })() : '';
        const boom = s.boom && s.boom.until > s.week ? `<div class="boom">🔥 SNS で <b>${Sim.sku(s.boom.id).full}</b> が ブーム！ (あと ${s.boom.until - s.week} 週)</div>` : '';
        const left = Sim.matsLeft(s);
        const mats = Object.entries(C.materials).map(([k, m]) => `<span class="mat">${m.icon} ${k === 'local' ? r.local.name : m.name} <b>${left[k]}</b>${left[k] !== s.mats[k] ? `<small>/${s.mats[k]}</small>` : ''}</span>`).join('');
        const recipes = C.recipes.map(rc => {
            const use = Object.entries(rc.use).map(([k, v]) => `${C.materials[k].icon}${v}`).join(' + ');
            return `<div class="recipe"><span class="ri">${rc.icon}</span><div><b>${rc.id === 'localBento' ? `${r.local.name.replace(/^.*の /, '')}弁当` : rc.name}</b><small>${use} → ${rc.make} こ・${rc.price}円・仕入れ ${rc.cost}円 (材料の ほか)・1こ の もうけ <span class="good">+${rc.price - rc.cost}円 (${Math.round((rc.price - rc.cost) / rc.price * 100)}%)</span>${rc.rep ? '・評判 アップ' : ''}</small></div>
                <span class="qty"><button data-craft="${rc.id}" data-d="-1">−</button><b>${s.craft[rc.id] || 0}</b><button data-craft="${rc.id}" data-d="1"${Sim.craftable(s, rc.id) ? '' : ' disabled'}>＋</button></span></div>`;
        }).join('');
        $('tab-order').innerHTML = `${ev}${next ? `<div class="event next">来週は ${next.name}${next.text ? `: ${next.text}` : ''}</div>` : ''}
            <div class="forecast"><span class="lbl">天気予報</span>${fc}</div>
            <div class="ware"><span>📦 倉庫</span><i class="bar"><i style="width:${Math.min(100, Sim.wareUse(s) / Sim.wareCap(s) * 100)}%"></i></i><b>${Sim.wareUse(s).toLocaleString()} / ${Sim.wareCap(s).toLocaleString()}</b></div>
            <p class="note">商品は 発注しないと とどかない。毎朝 とどいた 商品は 検品して 倉庫へ、品出しで 棚へ。客が 買えるのは 棚の 商品だけ。倉庫が いっぱいだと 受け取れない。</p>
            ${offer}${boom}${costBox}
            <div class="order-head"><span>値段と 毎朝 とどく 数</span><span><label class="chip${showLocked ? ' on' : ''}"><input type="checkbox" id="show-locked"${showLocked ? ' checked' : ''}>売って いない 商品も 見る</label> <button id="price-reset" class="mini">ぜんぶ 定価に もどす</button> <button id="auto-all" class="mini">ぜんぶ 目安に</button></span></div>
            <div class="table-wrap"><table class="orders order-main"><thead><tr><th></th><th>商品</th><th>仕入れ</th><th>売り値</th><th>1こ の もうけ</th><th>見こみ<br><small>先週/日</small></th><th>棚・倉庫</th><th>発注/日</th><th>目安</th></tr></thead><tbody>${rows}</tbody></table></div>
            <p class="note">仕入れは 週ごとに 変わる (季節・天気・行事)。↑↓ = 先週から 変わった 額。売り値は 自動では 変わらないので、もうけが 赤 (赤字)・黄 (${Math.round(C.lowMargin * 100)}% 未満) の 商品は 見なおそう。売り値の ボタンを 押すと メニューが 出る。<br>
            逃 = 品切れで 買えなかった・断 = 倉庫が いっぱいで 受け取れなかった・廃 = 廃棄・食 = 子ども食堂へ。商品名の ↑↓ = この 地域の 好み (売って いくと 分かる)。</p>
            <h3>期限 今日までの 商品</h3>
            <div class="row-opts">
                <span>値下げ</span>${C.markdowns.map(m => `<label class="chip${s.markdown === m ? ' on' : ''}"><input type="radio" name="markdown" value="${m}"${s.markdown === m ? ' checked' : ''}>${m ? `${m * 10}割引き` : 'しない'}</label>`).join('')}
                <label class="chip${s.kids ? ' on' : ''}"><input type="checkbox" id="kids"${s.kids ? ' checked' : ''}>期限切れは 子ども食堂へ</label>
            </div>
            <p class="note">値下げすると 値下げハンター (常連の 一部) が 買って いく。子ども食堂に 回すと お金には ならないが 評判が 上がる。</p>
            <h3>限定商品 (特産品・ダンジョンの 報酬で 作る)</h3>
            <div class="mats">${mats}</div>
            <div class="recipes">${recipes}</div>`;
    }

    function bar(v, max = 5) { return `<i class="bar"><i style="width:${Math.min(100, v / max * 100)}%"></i></i>`; }
    function renderStaff() {
        const need = Sim.estSlots(s);
        // 1 日に 売れそうな 数 (品出しの 見こみ) と 毎朝 とどく 数 (検品の 見こみ)
        const sell = C.skus.reduce((a, p) => a + (Sim.available(s, p.id) && !p.cook && !p.self ? Math.max(s.orders[p.id] || 0, (s.orders[p.id] || 0) ? Sim.dailyNeed(s, p.id) : 0) : 0), 0);
        const arrive = C.skus.reduce((a, p) => a + (Sim.available(s, p.id) ? s.orders[p.id] || 0 : 0), 0);
        const cookNeed = C.skus.reduce((a, p) => a + (Sim.available(s, p.id) && p.cook ? s.orders[p.id] || 0 : 0), 0);
        const pw = role => [0, 1, 2].map(t => Sim.rolePower(s, t, role));
        const tot = a => a.reduce((x, y) => x + y, 0);
        const reg = pw('register'), stk = pw('stock'), chk = pw('check'), ck = pw('cook');
        const cell = (v, n, unit) => `<td class="${v < n ? 'short' : ''}">${v.toLocaleString()}${n !== null ? `<small> / ${n.toLocaleString()}</small>` : ''}${unit || ''}</td>`;
        const summary = `<div class="table-wrap"><table class="work"><thead><tr><th></th>${C.slotNames.map(n => `<th>${n}</th>`).join('')}<th>1 日</th></tr></thead><tbody>
            <tr><th>${C.roles.register.icon} レジ <small>(客)</small></th>${reg.map((v, t) => cell(v, need[t])).join('')}<td></td></tr>
            <tr><th>${C.roles.stock.icon} 品出し <small>(こ)</small></th>${stk.map(v => cell(v, null)).join('')}${cell(tot(stk), sell)}</tr>
            <tr><th>${C.roles.check.icon} 検品 <small>(こ)</small></th>${chk.map(v => cell(v, null)).join('')}${cell(tot(chk), arrive)}</tr>
            ${cookNeed || Sim.available(s, 'hotsnack') || Sim.available(s, 'oden') ? `<tr><th>${C.roles.cook.icon} 調理 <small>(こ)</small></th>${ck.map(v => cell(v, null)).join('')}${cell(tot(ck), cookNeed)}</tr>` : ''}
            </tbody></table></div>`;
        const cards = s.staff.map(m => {
            const d = Sim.staffDef(m.id), st = Sim.stats(s, m);
            const stats = ['接客', '品出し', '検品', '調理', '探索'].map((n, i) => `<span>${n}${bar(st[i], 6)}</span>`).join('');
            let work;
            if (m.job === 'dungeon') {
                const dg = C.dungeons.find(x => x.id === m.dungeon);
                work = `<div class="away">🗺 ${dg.name}へ (${m.left ? `帰りまで あと ${m.back} 週` : '今週 出発'})${m.left ? '' : ` <button class="mini" data-recall="${m.id}">やめる</button>`}</div>`;
            } else {
                const best = Sim.bestRole(m.id);
                work = `<div class="roles">${Object.entries(C.roles).map(([k, ro]) => `<button class="roleb${m.role === k ? ' on' : ''}" data-role="${m.id}" data-r="${k}" title="${ro.text}">${ro.icon} ${ro.name}${k === best ? '<i>★</i>' : ''}</button>`).join('')}</div>
                    <div class="slots">${C.slotNames.map((n, t) => `<button class="slotb${m.slots[t] ? ' on' : ''}" data-slot="${m.id}" data-t="${t}">${n}</button>`).join('')}
                    ${d.boss ? '' : `<select data-dungeon="${m.id}"><option value="">ダンジョンへ…</option>${C.dungeons.map(dg => `<option value="${dg.id}">${dg.name} (${dg.weeks} 週)</option>`).join('')}</select>`}</div>`;
            }
            const n = m.job === 'shop' ? m.slots.filter(Boolean).length : 2;
            const moodNote = m.job === 'shop' ? (n === 3 ? '働きすぎ' : n === 0 ? '休み' : '') : '';
            return `<div class="staff-card${m.job === 'dungeon' ? ' out' : ''}">${img(d.art, 48)}<div class="sc-main">
                <div class="sc-head">${d.rare ? '<span class="tag rare">★レア</span>' : ''}<b>${d.name}</b>${m.tired ? '<span class="tag bad">つかれ</span>' : ''}${C.trio.includes(m.id) && Sim.trioOn(s) ? '<span class="tag good">3 人 連携</span>' : ''}<small>${d.boss ? '店長 (給料なし)' : `時給 ${d.pay.toLocaleString()}円・今週 ${man(Sim.wageOf(m))}`}</small></div>
                <div class="stats">${stats}</div>${d.rare ? `<div class="perk">得意: ${d.rare.perkText}${d.rare.dungeon ? '・ダンジョンの 報酬 アップ' : ''}</div>` : ''}
                <div class="mood">やる気 ${bar(m.mood, 100)} ${Math.round(m.mood)} <small class="${n === 3 ? 'bad' : ''}">${moodNote}</small></div>
                ${work}</div>${d.boss || m.job === 'dungeon' ? '' : `<button class="mini fire" data-fire="${m.id}" title="やめて もらう">解雇</button>`}</div>`;
        }).join('');
        const apps = (s.applicants || []).map(id => { const d = Sim.staffDef(id); return `<div class="hire${d.rare ? ' rare' : ''}">${img(d.art, 36)}<div><b>${d.rare ? '★レア ' : ''}${d.name}</b><small>${d.text}${d.rare ? `<br>得意: ${d.rare.perkText}${d.rare.dungeon ? '・ダンジョンの 報酬 アップ' : ''}。${d.rare.months.join('・')} 月 だけ やとえる` : ''}<br>接客${d.st[0]} 品出し${d.st[1]} 検品${d.st[2]} 調理${d.st[3]} 探索${d.st[4]}・時給 ${d.pay.toLocaleString()}円 (1 コマ ${man(Sim.slotWage(id))}/週)</small></div><button class="mini" data-hire="${d.id}"${s.staff.length >= C.maxStaff ? ' disabled' : ''}>やとう</button></div>`; }).join('');
        const full = s.staff.length >= C.maxStaff;
        const recruit = s.recruiting ? '<p class="note">求人を 出した！ 来週の はじめに 応募が 来る。</p>'
            : `<div class="hire"><span class="ri">📋</span><div><b>アルバイトを 募集する</b><small>求人を 出すと 来週 ${C.recruit.min}〜${C.recruit.max} 人 応募が 来る (来ない ことも)。その 週の うちに やとわないと ほかへ 行く。</small></div><button class="mini" data-recruit${full || s.cash < C.recruit.cost ? ' disabled' : ''}>${man(C.recruit.cost)}</button></div>`;
        const hire = (apps ? `<p class="note">応募が 来て いる！ 今週の うちに 面接して やとおう。</p>${apps}` : '') + recruit;
        const items = Object.entries(C.items).map(([k, it]) => `<div class="hire"><span class="ri">${it.icon}</span><div><b>${it.name} ×${s.items[k]}</b><small>${it.text}${s.effects[k] ? `・あと ${s.effects[k]} 週` : ''}</small></div><button class="mini" data-item="${k}"${s.items[k] ? '' : ' disabled'}>つかう</button></div>`).join('');
        $('tab-staff').innerHTML = `<h3>持ち場と シフト (できる 量 / 見こみ)</h3>${summary}
            <p class="note">スタッフごとに 持ち場 (レジ・品出し・検品・調理) を きめる。★ = いちばん 向いて いる 持ち場。ほかの 持ち場の 人も ${Math.round(C.roleHelp * 100)}% だけ 手伝う。<br>
            レジが 足りないと 客が 帰る・品出しが 足りないと 倉庫に あるのに 棚が 空・検品が 足りないと とどいた 商品が 倉庫に 入らない。<br>
            朝・昼・夜の 3 コマ。3 コマ 入ると 働きすぎで やる気が 下がり、やめて しまう ことも。やす・たむ・だけ の 3 人が 店に そろうと 連携ボーナス。</p>
            <div class="staff-list">${cards}</div>
            <h3>ダンジョン</h3><p class="note">${C.dungeons.map(d => `<b>${d.name}</b> ${d.weeks} 週 (${Object.keys(d.rewards).map(k => C.materials[k].name).join('・')}${d.maboroshi ? '・幻の 食材' : ''})`).join('<br>')}<br>探索が 高いほど 多く 持って 帰る。帰った 次の 週は つかれて 仕事が 下手に なる。</p>
            <h3>便利アイテム</h3><div class="hire-list">${items}</div>
            <h3>アルバイト (${s.staff.length}/${C.maxStaff} 人)</h3><div class="hire-list">${hire}</div>
            <p class="note">給料は 時給 × ${C.hoursPerSlot} 時間 × 7 日 × 入った コマの 数。毎週 はらう。ダンジョンの あいだも 2 コマぶん はらう。今週の 給料 合計 <b>${man(Sim.wages(s))}</b><br>「解雇」で やめて もらえる (店長と ダンジョン中の 人は できない)。</p>
            ${renderZukan()}`;
    }

    function renderZukan() {
        const z = zukan();
        const met = new Set([...z.met, ...(s.metRare || [])]), hired = new Set([...z.hired, ...(s.everHired || []).filter(id => Sim.staffDef(id).rare)]);
        const month = Sim.weekInfo(Math.min(s.week + 1, C.weeks - 1)).start.month;
        const now = RARES.filter(d => d.rare.months.includes(month));
        return `<h3>★ レアスタッフ図鑑 (${hired.size} / ${RARES.length})</h3>
            <p class="note">季節の レアスタッフは その 月に 募集すると たまに 応募に 来る。給料は 高いが 能力が 高く、店に いると 得意な 商品が よく 売れる。ダンジョンでも 強い。図鑑は 何回 遊んでも のこる。${now.length ? `<br><b>いま 募集すると 来るかも: ${now.map(d => d.name).join('・')}</b>` : ''}</p>
            <div class="zukan">${RARES.map(d => {
                const known = met.has(d.id) || hired.has(d.id);
                return `<div class="zk${hired.has(d.id) ? ' hired' : known ? ' met' : ''}">${known ? img(d.art, 40) : `<span class="face blank">？</span>`}<b>${known ? d.name : '？？？'}</b><small>${d.rare.months.join('・')} 月${known ? `<br>${d.rare.perkText}` : ''}</small>${hired.has(d.id) ? '<span class="tag good">やとった</span>' : known ? '<span class="tag">会った</span>' : ''}</div>`;
            }).join('')}</div>`;
    }

    function renderShop() {
        const cap = Sim.floorCap(s), used = Sim.floorUsed(s), full = used >= cap, lv = Sim.levelOf(s), ex = Sim.canExpand(s);
        const expand = ex.max ? `<p class="good">これ いじょう 大きく できない (いちばん 大きい 店)</p>`
            : `<div class="item"><span class="ui">🏗</span><div><b>「${ex.next.name}」に 大きく する</b><small>床 ${lv.floor} → ${ex.next.floor} マス・施設 ${lv.maxFac} → ${ex.next.maxFac} こ・客 ×${ex.next.traffic}・家賃 +${man(ex.next.rentAdd - lv.rentAdd)}/週<br>いる もの: お金 <span class="${ex.cash ? 'good' : 'bad'}">${man(ex.next.cost)}</span>・評判 <span class="${ex.rep ? 'good' : 'bad'}">${ex.next.rep} 以上 (いま ${Math.round(s.rep)})</span></small></div><button data-expand${ex.ok ? '' : ' disabled'}>${man(ex.next.cost)}</button></div>`;
        const groups = Object.entries(C.shelfTypes).map(([tid, ty]) => {
            const rows = C.products.filter(p => p.type === tid && !p.cook && !p.self).map(p => {
                const n = Sim.shelfUnits(s, p.id);
                return `<div class="item${n ? '' : ' have'}"><span class="ui">${p.icon}</span><div><b>${p.name} ×${n}</b><small>${n ? `${Sim.capOf(s, p)} こ ならぶ` : '棚が ないので 売れない'}</small></div>
                    <span class="btns">${n ? `<button class="mini" data-unshelf="${p.id}">撤去</button>` : ''}<button class="mini" data-shelf="${p.id}"${full || s.cash < ty.cost ? ' disabled' : ''}>＋${man(ty.cost)}</button></span></div>`;
            }).join('');
            return `<h4>${ty.icon} ${ty.name} <small>1 台 ${man(ty.cost)}${ty.upkeep ? `・電気代 ${man(ty.upkeep)}/週` : ''}・${ty.text}</small></h4><div class="shop">${rows}</div>`;
        }).join('');
        $('tab-shop').innerHTML = `<h3>🏪 店の 大きさ: ${lv.name}</h3>${expand ? `<div class="shop">${expand}</div>` : ''}
            <div class="ware"><span>床</span><i class="bar"><i style="width:${used / cap * 100}%"></i></i><b>${used} / ${cap} マス</b></div>
            <p class="note">棚 1 台と 施設 1 つで 1 マス ずつ つかう。棚は 種類ごとに 置ける 商品が きまって いる (アイスは 冷凍ケース・ドリンクは 飲料ケース など)。棚を ふやすと たくさん ならべられ (品出しの 回数が へる)、撤去すると 施設を 置ける。棚が 0 台の 商品は 売れない。撤去すると 棚は ${Math.round(C.shelf.refund * 100)}%・施設は ${Math.round(C.sellBack * 100)}% お金が もどる。</p>
            <h3>棚</h3>${groups}
            <h3>倉庫</h3><div class="shop"><div class="item"><span class="ui">📦</span><div><b>倉庫を 広げる</b><small>いま ${Sim.wareCap(s).toLocaleString()} こ → +${C.warehouse.add.toLocaleString()} こ・設備代 +${man(C.warehouse.upkeep)}/週 (あと ${C.warehouse.max - s.wareLv} 回)。マスは つかわない</small></div><button data-ware${s.wareLv >= C.warehouse.max || s.cash < C.warehouse.cost ? ' disabled' : ''}>${man(C.warehouse.cost)}</button></div></div>
            <h3>施設 (${s.facilities.length} / ${Sim.facCap(s)})</h3>
            <p class="note">施設ごとに 集まる 客が ちがう。買う ときの お金の ほかに、毎週 設備代 (リース・電気代) が かかる。</p>
            <p>今週の 設備代 <b>${man(Sim.upkeep(s))}</b> <small class="note">(店の 基本 ${man(C.baseUpkeep)}・棚の 電気代 ${man(Sim.shelfUpkeep(s))}${s.wareLv ? `・倉庫 ${man(C.warehouse.upkeep * s.wareLv)}` : ''}${s.facilities.map(id => `・${Sim.facility(id).name} ${man(Sim.upkeepOf(s, id))}`).join('')})</small></p><div class="shop">${C.facilities.map(f => {
            const have = Sim.hasFac(s, f.id), cost = Sim.facCost(s, f.id);
            return `<div class="item${have ? ' have' : ''}"><span class="ui">${f.icon}</span><div><b>${f.name}</b><small>${f.text}・設備代 ${man(Sim.upkeepOf(s, f.id))}/週${f.warn ? `<br><span class="warn">⚠ ${f.warn}</span>` : ''}</small></div>
                ${have ? `<button class="mini" data-remove="${f.id}">撤去</button>` : `<button data-buy="${f.id}"${s.cash < cost || full || s.facilities.length >= Sim.facCap(s) ? ' disabled' : ''}>${man(cost)}</button>`}</div>`;
        }).join('')}</div>`;
    }

    function renderPartner() {
        $('tab-partner').innerHTML = `<p class="note">ほかの お店と 連携すると 特産品が ふえたり 客が ふえたり する。続けるほど 信頼度が 上がって 安く・強く なる。ライバルに 先に とられる ことも。</p><div class="shop">${C.partners.map(p => {
            const st = s.partners[p.id], fee = Sim.partnerFee(s, p.id);
            let ctl;
            if (st.taken) ctl = `<span class="tag bad">ライバルが 連携中 (あと ${st.taken} 週)</span>`;
            else if (p.perUse) ctl = `<select data-dj><option value="-1">よばない</option>${C.dayNames.map((n, i) => `<option value="${i}"${s.eventDay === i ? ' selected' : ''}>${n}曜日に よぶ</option>`).join('')}</select>`;
            else ctl = `<button class="${st.on ? 'mini on' : 'mini'}" data-partner="${p.id}">${st.on ? '連携中 (やめる)' : '連携する'}</button>`;
            return `<div class="item">${img(p.art, 40)}<div><b>${p.name}</b><small>社長: ${p.boss}・${p.text}<br>料金 ${man(fee)}${p.perUse ? '/回' : '/週'}・信頼度 ${st.trust}</small></div>${ctl}</div>`;
        }).join('')}</div>`;
    }

    function renderBank() {
        const graceLeft = s.months < C.bank.graceMonths;
        $('tab-bank').innerHTML = `<div class="bank">${img('onioni', 64)}<div>
            <h3>おにおにバンク</h3>
            <p>借金 <b class="${s.debt > 0 ? 'bad' : 'good'}">${s.debt > 0 ? yen(s.debt) : 'なし！'}</b>・利息 月 ${(s.rate * 100).toFixed(0)}%</p>
            <p class="note">${graceLeft ? '最初の 1 か月は つけ (返済なし)。' : ''}月末に 利息と ${man(C.bank.pay)} を 取り立てに 来る。払えないと ${C.bank.occupyWeeks} 週 おにおにが 店に 居座って 客が へる。早く 返すほど 利息が 少ない。<br>週の おわりに 資金が マイナスの まま 月末を むかえると、おにおにが 勝手に 貸して 利息が 上がる。</p>
            ${s.occupy ? '<p class="bad">おにおにが 店に 居座って いる…</p>' : ''}
            <div class="bank-buttons">
                <button class="mini" data-repay="100000"${s.debt > 0 && s.cash >= 100000 ? '' : ' disabled'}>10 万円 返す</button>
                <button class="mini" data-repay="all"${s.debt > 0 && s.cash > 0 ? '' : ' disabled'}>返せる だけ 返す</button>
                <button class="mini" data-borrow${s.borrowed < C.bank.maxBorrow ? '' : ' disabled'}>${man(C.bank.borrow)} 借りる (利息 +${C.bank.borrowRate * 100}%)</button>
            </div></div></div>`;
    }

    function renderArea() {
        const r = Sim.regionOf(s);
        const prefs = C.products.map(p => { const k = Sim.knownPref(s, p.id); return `<span class="pref">${p.icon}${k === 'up' ? '<em class="up">↑</em>' : k === 'down' ? '<em class="down">↓</em>' : k === 'flat' ? '・' : '<em class="q">？</em>'}</span>`; }).join('');
        const segs = s.history.length ? lastReport && lastReport.segServed : null;
        const segText = segs ? Sim.SEGS.map(g => `${C.segments[g].icon} ${C.segments[g].name} ${Math.round(segs[g] / 7)}人`).join('・') : '営業すると 分かる';
        const others = C.regions.filter(x => x.id !== s.region).map(x => `<div class="item"><span class="ui">${x.icon}</span><div><b>${x.name}</b><small>${x.text}・家賃 ${man(x.rent)}/週</small></div><button data-move="${x.id}"${s.cash < C.moveCost ? ' disabled' : ''}>移転 ${man(C.moveCost)}</button></div>`).join('');
        $('tab-area').innerHTML = `<h3>${r.icon} ${r.name}</h3><p>${r.text}<br>家賃 ${man(Sim.rentOf(s))}/週 (${Sim.levelOf(s).name})・特産品 ${r.local.icon} ${r.local.name}</p>
            <p>先週の 客 (1 日): ${segText}</p>
            <p>常連 <b>${s.regulars}</b> 人</p>
            <h3>この 地域の 好み</h3><div class="prefs">${prefs}</div><p class="note">${C.knowWeeks} 週 売ると 分かる。↑ よく 売れる・↓ 売れにくい</p>
            ${renderItemZukan()}
            <h3>移転</h3><p class="note">店は 1 軒だけ。お金を 払えば 別の 地域へ 移れる。施設と 地域の 知識は のこる。常連は ${Math.round(C.moveKeepRegulars * 100)}% だけ ついて くる。</p><div class="shop">${others}</div>`;
    }

    // 商品図鑑 (売った 種類。何回 遊んでも のこる)
    function renderItemZukan() {
        const z = zukan(), got = new Set([...z.sold, ...(s.soldSkus || [])]);
        const list = C.skus.filter(k => !k.single);
        return `<h3>📖 商品図鑑 (${list.filter(k => got.has(k.id)).length} / ${list.length})</h3>
            <p class="note">売った ことの ある 種類。期間限定や 本部の 新商品も ある。何回 遊んでも のこる。</p>
            <div class="izukan">${C.products.filter(p => Sim.hasVariety(p.id)).map(p => `<div><b>${p.icon} ${p.name}</b> ${Sim.skusOf(p.id).map(k => got.has(k.id) ? `<span class="got">${k.name}${k.months ? '<small>限定</small>' : k.launch ? '<small>新</small>' : ''}</span>` : '<span class="no">？？？</span>').join('')}</div>`).join('')}</div>`;
    }
    function renderRank() {
        const list = Sim.ranking(s);
        $('tab-rank').innerHTML = `<h3>コンビニランキング</h3><ol class="rank">${list.map((x, i) => {
            const cr = C.rivals.find(r => r.name === x.name);
            return `<li class="${x.me ? 'me' : ''}"><span class="no">${i + 1}</span>${img(x.me ? 'koori' : x.owner, 36)}<div><b>${esc(x.name)}</b><small>${x.me ? '店長 こおりくん' : `${cr.boss}「${cr.line}」`}</small></div><span class="sum">${x.score} 点</span></li>`;
        }).join('')}</ol><p class="note">点 = 直近 ${C.rankWeeks} 週の 売上の 平均 (万円) + 評判 × 0.5。毎週 発表。${s.mode === 'endless' ? `エンドレス: 1 位に なっても つづく。${s.clearedWeek !== null ? `はじめて 1 位に なったのは 第 ${s.clearedWeek} 週。` : ''}` : `1 位に なったら クリア！ のこり ${C.weeks - s.week} 週。`}</p>`;
    }

    function updateCost() {
        const buy = C.skus.reduce((a, p) => a + (Sim.available(s, p.id) ? (s.orders[p.id] || 0) * Sim.costOf(s, p.id) * 7 : 0), 0);
        const fees = C.partners.filter(p => !p.perUse && s.partners[p.id].on).reduce((a, p) => a + Sim.partnerFee(s, p.id), 0) + (s.eventDay >= 0 ? Sim.partnerFee(s, 'event') : 0);
        $('cost-note').innerHTML = `仕入れ 約${man(buy)}・給料 ${man(Sim.wages(s))}・家賃 ${man(Sim.rentOf(s))}・設備代 ${man(Sim.upkeep(s))}${fees ? `・連携 ${man(fees)}` : ''}`;
    }

    // ----- 操作 -----
    document.querySelector('.tabs').addEventListener('click', e => {
        const b = e.target.closest('button[data-tab]');
        if (!b) return;
        tab = b.dataset.tab;
        document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
        document.querySelectorAll('#game .panel').forEach(p => { p.hidden = p.id !== `tab-${tab}`; });
        if (tab === 'staff') tutDone('staffTab');
    });
    $('game').addEventListener('click', e => {
        if (running) return;
        const t = e.target.closest('button');
        if (!t) return;
        const d = t.dataset;
        if (d.step) { s.orders[d.step] = Math.max(0, (s.orders[d.step] || 0) + Number(d.d)); const inp = document.querySelector(`input[data-order="${d.step}"]`); if (inp) inp.value = s.orders[d.step]; updateCost(); }
        else if (d.auto) { s.orders[d.auto] = Sim.suggest(s, d.auto); renderOrder(Sim.weekInfo(s.week)); updateCost(); }
        else if (t.id === 'auto-all') { autoAll(); renderOrder(Sim.weekInfo(s.week)); updateCost(); tutDone('auto'); }
        else if (d.gopen) { if (openGroups.has(d.gopen)) openGroups.delete(d.gopen); else openGroups.add(d.gopen); renderOrder(Sim.weekInfo(s.week)); return; }
        else if (d.gauto) { autoGroup(d.gauto); renderOrder(Sim.weekInfo(s.week)); updateCost(); }
        else if (d.gstep) { Sim.splitOrder(s, d.gstep, Math.max(0, Sim.groupOrder(s, d.gstep) + Number(d.d))); renderOrder(Sim.weekInfo(s.week)); updateCost(); }
        else if (d.offer) { const k = Sim.sku(s.offer); Sim.acceptOffer(s, d.offer === 'yes'); if (d.offer === 'yes') { openGroups.add(k.group); s.orders[k.id] = Sim.suggest(s, k.id); say('sasaki', `${k.full}、よろしく たのむよ！ 最初の ${C.launch.newWeeks} 週は よく 売れる はずだ。`); } else say('sasaki', 'そうか。また いい 商品が あったら 持って くるよ。'); render(); }
        else if (d.price) { Sim.setPrice(s, d.price, s.prices[d.price] + Number(d.d) * C.priceStep); renderOrder(Sim.weekInfo(s.week)); }
        else if (d.pmenu) { openPriceMenu(d.pmenu, t); return; }
        else if (t.id === 'price-reset') { for (const p of C.skus) s.prices[p.id] = p.price; renderOrder(Sim.weekInfo(s.week)); say('furukawa', 'ぜんぶ 定価に もどしたよ。'); }
        else if (d.craft) { Sim.addCraft(s, d.craft, Number(d.d)); renderOrder(Sim.weekInfo(s.week)); }
        else if (d.role) { Sim.setRole(s, d.role, d.r); renderStaff(); }
        else if (d.slot) { Sim.toggleSlot(s, d.slot, Number(d.t)); renderStaff(); updateCost(); }
        else if (d.recall) { Sim.recall(s, d.recall); renderStaff(); }
        else if (d.fire) {
            const fd = Sim.staffDef(d.fire);
            if (confirm(`${fd.name}を 解雇する？${fd.rare ? `\n★レアスタッフは ${fd.rare.months.join('・')} 月に しか やとえない！` : ''}`)) { Sim.fire(s, d.fire); say('koori', `${fd.name}に やめて もらった…`); render(); }
        }
        else if ('recruit' in d) { if (Sim.recruit(s)) { say('koori', `アルバイトの 求人を 出したよ！ 来週 応募が 来るかな。`); render(); } }
        else if (d.hire) { if (Sim.hire(s, d.hire)) { say(Sim.staffDef(d.hire).art, `${Sim.staffDef(d.hire).name}です！ よろしく おねがいします！`); render(); } }
        else if (d.item) { if (Sim.useItem(s, d.item)) { say('koori', `${C.items[d.item].name}を つかった！ ${C.items[d.item].text}`); render(); } }
        else if (d.buy) { const f = Sim.facility(d.buy); if (Sim.buyFacility(s, f.id)) { say('koori', `「${f.name}」を 置いたよ！ ${f.text}`); render(); } }
        else if ('expand' in d) { const nx = Sim.canExpand(s).next; if (nx && confirm(`「${nx.name}」に 大きく する？ ${man(nx.cost)} かかる。家賃も 上がる`)) { Sim.expandStore(s); say('furukawa', `おめでとう！ 「${Sim.levelOf(s).name}」に なった！ 床が ${Sim.floorCap(s)} マスに ふえたよ。`); render(); } }
        else if ('ware' in d) { if (Sim.expandWare(s)) { say('koori', `倉庫を 広げたよ！ ${Sim.wareCap(s).toLocaleString()} こ 入る`); render(); } }
        else if (d.remove) { if (confirm(`「${Sim.facility(d.remove).name}」を 撤去する？`)) { Sim.removeFacility(s, d.remove); render(); } }
        else if (d.shelf) { if (Sim.addShelf(s, d.shelf)) { say('koori', `${C.shelfTypes[Sim.product(d.shelf).type].name}を 置いて ${Sim.product(d.shelf).name}を ならべたよ！`); render(); } }
        else if (d.unshelf) { const p = Sim.product(d.unshelf); if (confirm(`${p.name}の 棚を 1 台 撤去する？${Sim.shelfUnits(s, p.id) === 1 ? `\n0 台に なると ${p.name}は 売れなく なる` : ''}`)) { Sim.removeShelf(s, p.id); render(); } }
        else if (d.partner) { const st = s.partners[d.partner]; Sim.setPartner(s, d.partner, !st.on); const p = Sim.partner(d.partner); if (st.on && p.art) say(p.art, p.id === 'ad' ? 'まかせろ！！ おかおか じゅうに 店の 名前を さけんで くるぜ！！' : 'よろしく！'); render(); }
        else if (d.repay) { Sim.repay(s, d.repay === 'all' ? s.debt : Number(d.repay)); if (s.debt <= 0) say('onioni', 'ぐぬぬ… ぜんぶ 返しおった…！'); render(); }
        else if ('borrow' in d) { if (confirm(`${man(C.bank.borrow)} 借りる？ 利息が 月 ${((s.rate + C.bank.borrowRate) * 100).toFixed(0)}% に 上がる`)) { Sim.borrow(s); say('onioni', 'がっはっは！ 毎度 あり！'); render(); } }
        else if (d.move) { const r = C.regions.find(x => x.id === d.move); if (confirm(`${r.name}へ 移転する？ ${man(C.moveCost)} かかる`)) { Sim.relocate(s, r.id); say('furukawa', `${r.name}へ 移転した！ 新しい 地域の 客に 合わせよう。`); render(); } }
        else return;
        save();
    });
    $('game').addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.order) { s.orders[t.dataset.order] = Math.max(0, Math.round(Number(t.value) || 0)); t.value = s.orders[t.dataset.order]; updateCost(); if (Sim.sku(t.dataset.order) && !Sim.sku(t.dataset.order).single) renderOrder(Sim.weekInfo(s.week)); }
        else if (t.dataset.gorder) { Sim.splitOrder(s, t.dataset.gorder, Math.max(0, Math.round(Number(t.value) || 0))); renderOrder(Sim.weekInfo(s.week)); updateCost(); }
        else if (t.name === 'markdown') { s.markdown = Number(t.value); renderOrder(Sim.weekInfo(s.week)); }
        else if (t.id === 'show-locked') { showLocked = t.checked; renderOrder(Sim.weekInfo(s.week)); }
        else if (t.id === 'kids') { s.kids = t.checked; renderOrder(Sim.weekInfo(s.week)); }
        else if (t.dataset.dungeon && t.value) { const dg = C.dungeons.find(x => x.id === t.value); if (Sim.sendDungeon(s, t.dataset.dungeon, t.value)) say(Sim.staffDef(t.dataset.dungeon).art, `${dg.name}に 行って きます！ (${dg.weeks} 週)`); renderStaff(); updateCost(); }
        else if ('dj' in t.dataset) { Sim.bookEvent(s, Number(t.value)); if (s.eventDay >= 0) say('okagappa', `${C.dayNames[s.eventDay]}曜日は まかせとけ！ YO！`); updateCost(); }
        save();
    });

    // ----- 値段の メニュー (2026-11-17 ユーザー指定: 定価・ちょい安・ちょい高・もうけ ○%) -----
    const pm = document.createElement('div');
    pm.id = 'pmenu'; pm.className = 'pmenu'; pm.hidden = true;
    document.body.appendChild(pm);
    let pmId = null;
    function openPriceMenu(id, btn) {
        pmId = id;
        const p = Sim.sku(id), mg = Sim.marginOf(s, id), [lo, hi] = Sim.priceBounds(id);
        const opt = (k, label, v) => `<button data-pset="${k}"><span>${label}</span><b>${Math.min(hi, Math.max(lo, Math.round(v / 10) * 10))}円</b></button>`;
        pm.innerHTML = `<div class="pm-head">${p.icon} ${p.full}<small>仕入れ ${mg.cost}円・いま ${s.prices[id]}円 (もうけ ${Math.round(mg.rate * 100)}%)</small></div>
            ${opt('list', 'ふつう (定価)', p.price)}${opt('cheap', 'ちょい安 (−10%)', p.price * 0.9)}${opt('high', 'ちょい高 (+10%)', p.price * 1.1)}
            <div class="pm-margin"><span>もうけ</span><input type="number" id="pm-pct" min="0" max="80" value="${Math.max(0, Math.round(mg.rate * 100))}"><span>% に</span><button data-pset="margin">する</button></div>
            <button class="pm-close" data-pset="close">とじる</button>`;
        pm.hidden = false;
        const r = btn.getBoundingClientRect(), w = Math.min(260, innerWidth - 16);
        pm.style.width = `${w}px`;
        pm.style.left = `${scrollX + Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
        const h = pm.offsetHeight;
        pm.style.top = `${scrollY + (r.bottom + h + 8 < innerHeight ? r.bottom + 4 : Math.max(8, r.top - h - 4))}px`;
    }
    function closePriceMenu() { pm.hidden = true; pmId = null; }
    pm.addEventListener('click', e => {
        const b = e.target.closest('[data-pset]');
        if (!b || !pmId) return;
        const p = Sim.sku(pmId), k = b.dataset.pset;
        if (k === 'list') Sim.setPrice(s, p.id, p.price);
        else if (k === 'cheap') Sim.setPrice(s, p.id, p.price * 0.9);
        else if (k === 'high') Sim.setPrice(s, p.id, p.price * 1.1);
        else if (k === 'margin') { const v = Number($('pm-pct').value); if (!Number.isFinite(v)) return; Sim.setPrice(s, p.id, Sim.priceForMargin(s, p.id, Math.min(0.8, Math.max(0, v / 100)))); }
        closePriceMenu();
        if (k !== 'close') { renderOrder(Sim.weekInfo(s.week)); save(); }
    });
    document.addEventListener('click', e => { if (!pm.hidden && !pm.contains(e.target) && !e.target.closest('[data-pmenu]')) closePriceMenu(); });

    // ----- 1 週間 営業 (2026-11-17 ユーザー指定: 7 日ぶんを 早送りで 見せる。止めて 手を 打てる) -----
    // 計算は Sim.runSlot で 1 コマずつ。コマの 区切りで セーブ (閉じても その コマから 再開)
    const PREF_KEY = 'koori-konbini-pref';
    function pref() { try { return { skipAll: false, autoStop: true, ...(JSON.parse(localStorage.getItem(PREF_KEY)) || {}) }; } catch (e) { return { skipAll: false, autoStop: true }; } }
    function setPref(k, v) { const p = pref(); p[k] = v; try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* なし */ } }
    let paused = false, pauseWhy = '', resumeAfterInspect = false, liveTimer = null;
    const slotMs = () => (C.playback.dayMs / 3);
    let sleepResolve = null;
    const sleep = ms => new Promise(r => { sleepResolve = r; liveTimer = setTimeout(() => { sleepResolve = null; r(); }, ms); });

    $('go-button').addEventListener('click', () => {
        if (running) return;
        if (!s.staff.some(m => m.job === 'shop' && m.slots.some(Boolean))) { say('koori', 'だれも シフトに 入って ないよ！'); return; }
        closePriceMenu();
        if (tut >= 0) { tut = -1; s.flags.tutDone = true; tutShow(); }
        Sim.beginWeek(s);
        save();
        playWeek();
    });
    // 営業の 途中から (セーブを 読んだ とき)
    function resumeWeek() { paused = true; pauseWhy = '営業の 途中から だよ。▶ で つづける。'; playWeek(); }

    let alerted = new Set(), stopDay = -1;
    async function playWeek() {
        running = true;
        alerted = new Set(); stopDay = -1;
        skip = skip || params.get('fast') === '1' || pref().skipAll;
        $('game').classList.add('live');
        $('ticker').hidden = false;
        renderLive();
        while (s.wk && s.wk.d < 7) {
            if (paused && !skip) { renderLive(); await new Promise(r => { resumeFn = r; }); continue; }
            const w = s.wk, d = w.d, t = w.t;
            const dt = Sim.dateOf(s.week * 7 + d), info = Sim.weekInfo(s.week);
            const wx = s.weather[d];
            if (t === 0 && !skip) {
                Scene.setDay({ w: wx.w, temp: wx.temp, gold: d === w.goldDay, label: `${dt.month}/${dt.date} (${C.dayNames[d]})`, event: info.event ? `🎌 ${info.event.name}` : d === w.djDay ? '🎧 DJ かっぱ イベント' : '' });
            }
            const slot = Sim.runSlot(s);
            save();
            if (skip) continue;
            Sound.play(t === 2 ? 'night' : 'day');
            if (t === 0) Sound.se('chime');
            // できごと (その 日に 出す)
            let special = null, specialSay = null;
            if (t === 1 && d === w.goldDay) { special = 'goldDog'; specialSay = 'ゴールド金面犬だ！ 大入り！'; }
            else if (t === 1 && d === w.djDay) { special = 'okagappa'; specialSay = 'YO！ DJ かっぱ！'; }
            else if (t === 0 && d === w.tomoDay) { special = 'tomoishi'; specialSay = '抜き打ち チェック！'; }
            else if (t === 2 && s.flags.shibata && (d + s.week) % 3 === 0) { special = 'shibata'; specialSay = 'いつもの 買いに 来たよ'; }
            Scene.playSlot(slot, slotMs(), { special, specialSay });
            const high = C.skus.some(p => Sim.available(s, p.id) && s.prices[p.id] / p.price > Sim.regionOf(s).line * 1.08);
            if (high && Math.random() < 0.4) Scene.say('高っ…', '#c03030');
            renderLive(slot);
            await sleep(slotMs());
            // 手を 打てる タイミングで 自動で 止まる (設定で 切れる)
            // 同じ 知らせで 何回も 止まらない (1 日 1 回 まで・同じ 商品の 同じ 知らせは 週に 1 回)
            const al = s.wk ? Sim.alerts(s).map(a => ({ ...a, ids: (a.ids || []).filter(id => !alerted.has(`${a.kind}:${id}`)) })).filter(a => a.kind === 'queue' ? !alerted.has(`queue:${s.wk.d}`) : a.ids.length) : [];
            if (pref().autoStop && al.length && s.wk && s.wk.d < 7 && !skip && stopDay !== s.wk.d) {
                stopDay = s.wk.d;
                for (const a of al) { if (a.kind === 'queue') alerted.add(`queue:${s.wk.d}`); for (const id of a.ids) alerted.add(`${a.kind}:${id}`); }
                paused = true;
                pauseWhy = alertText(al);
                Sound.se('alert');
                say('furukawa', pauseWhy);
            }
        }
        const report = Sim.finishWeek(s);
        lastReport = report;
        save();
        running = false; skip = false; paused = false; resumeFn = null;
        $('game').classList.remove('live');
        $('ticker').hidden = true;
        Scene.setLive(null);
        closeInspect();
        showReport(report);
    }
    let resumeFn = null;
    function resume() { paused = false; pauseWhy = ''; if (resumeFn) { const f = resumeFn; resumeFn = null; f(); } renderLive(); }
    function alertText(al) {
        const nm = ids => ids.slice(0, 2).map(id => Sim.product(id).name).join('・');
        const slotName = s.wk ? C.slotNames[s.wk.t] : '';
        const a = al[0];
        if (a.kind === 'soon') return `${nm(a.ids)}、${slotName}に 売りきれ そう！ 棚を 調べて 品出し しよう。`;
        if (a.kind === 'out') return `${nm(a.ids)}が 品切れ！ 倉庫に あれば すぐ 品出し、なければ 緊急発注も できるよ。`;
        if (a.kind === 'expire') return `期限 今日までの 商品が 多いよ (${nm(a.ids)})。値下げを 考えよう。`;
        if (a.kind === 'queue') return `レジに ならびすぎて ${a.n} 人 帰っちゃった！ シフトを 入れ替えよう。`;
        return '';
    }
    // 営業中の パネル
    function renderLive(slot) {
        if (!s.wk) return;
        const w = s.wk;
        const total = w.acc.sales + (w.day ? w.day.sales : 0);
        const last = slot || w.slots[w.slots.length - 1];
        const d = last ? last.d : Math.min(6, w.d), dt = Sim.dateOf(s.week * 7 + d);
        const nextName = w.d < 7 ? `${C.dayNames[w.d]}曜 ${C.slotNames[w.t]}` : '';
        $('ticker').innerHTML = `<b>${dt.month}/${dt.date} (${C.dayNames[d]})</b> ${last ? C.slotNames[last.t] : ''}　${last ? `客 ${last.customers.toLocaleString()} 人${last.walkAway > 5 ? ` <em>(${last.walkAway} 人 帰った)</em>` : ''}` : ''}<br><small>今週の 売上 ${man(total)}</small>`;
        // しるし (品切れ・品切れ しそう・期限が 近い)
        const marks = {};
        for (const p of C.products) if (Sim.available(s, p.id)) {
            const inf = Sim.shelfInfo(s, p.id);
            if (last && last.outs.some(id => Sim.groupOf(id) === p.id) && inf.onShelf < (inf.cap || 1) * 0.15) marks[p.id] = 'out';
            else if (inf.note === 'soon') marks[p.id] = 'soon';
            else if (p.shelf && inf.exp.red > Math.max(10, (inf.cap || 0) * 0.25)) marks[p.id] = 'expire';
        }
        Scene.setLive({ slot: last ? last.t : 0, marks, callout: !!(w.act.callout[w.d * 3 + w.t] && paused) || !!(last && last.callout) });
        const p = pref();
        const staffRow = paused ? s.staff.filter(m => m.job === 'shop').map(m => `<div class="lv-staff">${img(Sim.staffDef(m.id).art, 28)}<b>${Sim.staffDef(m.id).name}</b>${C.slotNames.map((n, t) => `<button class="slotb${m.slots[t] ? ' on' : ''}" data-lshift="${m.id}" data-t="${t}">${n}</button>`).join('')}</div>`).join('') : '';
        const k = w.d * 3 + w.t;
        const hasCook = C.products.some(x => x.cook && Sim.available(s, x.id));
        $('live').innerHTML = `<div class="lv-head">
                <span class="lv-when">🏪 営業中 ${w.d < 7 ? `つぎは <b>${Sim.dateOf(s.week * 7 + w.d).month}/${Sim.dateOf(s.week * 7 + w.d).date} ${nextName}</b>` : ''}</span>
                <span class="lv-btns"><button id="lv-play" class="mini ${paused ? 'go' : ''}">${paused ? '▶ つづける' : '⏸ 止める'}</button><button id="lv-skip" class="mini">スキップ ▶▶</button></span>
            </div>
            ${paused ? `<div class="lv-pause">${pauseWhy ? `<p class="lv-why">${pauseWhy}</p>` : ''}
                <p class="note">お店の 絵の 棚を タップすると、その 棚の ようすを 調べて 値段・品出し・緊急発注が できる。下の 手は つぎの コマ (${nextName}) から きく。</p>
                <div class="lv-acts">
                    ${hasCook ? `<button class="mini" data-lact="cook"${w.act.cookBoost[k] ? ' disabled' : ''}>🍳 調理を 増やす${w.act.cookBoost[k] ? ' ✔' : ''}<small>調理 ×${C.midweek.cookBoost}・作りすぎると 廃棄</small></button>` : ''}
                    <button class="mini" data-lact="callout"${w.act.callout[k] || !s.staff.some(m => m.id === 'koori' && m.job === 'shop') ? ' disabled' : ''}>📣 呼びこみ${w.act.callout[k] ? ' ✔' : ''}<small>来店 +${Math.round((C.midweek.callout - 1) * 100)}%・こおりくんは 働けない</small></button>
                </div>
                <h4>シフトの 入れ替え <small>(つぎの コマ から・入れ替えた 人は やる気 −${C.midweek.shiftMood})</small></h4>
                <div class="lv-staffs">${staffRow}</div></div>` : ''}
            <div class="lv-opts"><label><input type="checkbox" id="lv-auto"${p.autoStop ? ' checked' : ''}> 手を 打てる ときに 自動で 止まる</label><label><input type="checkbox" id="lv-skipall"${p.skipAll ? ' checked' : ''}> 毎週 スキップ</label></div>`;
    }
    $('live').addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b || !s.wk) return;
        if (b.id === 'lv-play') { if (paused) resume(); else { paused = true; pauseWhy = ''; renderLive(); } }
        else if (b.id === 'lv-skip') { skip = true; closeInspect(); resume(); fastForward(); }
        else if (b.dataset.lact === 'cook') { if (Sim.midCook(s)) { say('yamamou', 'まかせて！ どんどん 作るよ！'); save(); renderLive(); } }
        else if (b.dataset.lact === 'callout') { if (Sim.midCallout(s)) { say('koori', 'いらっしゃいませー！ 店の 前で 呼びこみ するよ！'); save(); renderLive(); } }
        else if (b.dataset.lshift) { const m = s.staff.find(x => x.id === b.dataset.lshift); if (Sim.midShift(s, b.dataset.lshift, Number(b.dataset.t))) { say(Sim.staffDef(m.id).art, m.slots[Number(b.dataset.t)] ? `${C.slotNames[b.dataset.t]}も 入るよ！` : `${C.slotNames[b.dataset.t]}は 休むね`); save(); renderLive(); } }
    });
    $('live').addEventListener('change', e => {
        if (e.target.id === 'lv-auto') setPref('autoStop', e.target.checked);
        if (e.target.id === 'lv-skipall') setPref('skipAll', e.target.checked);
    });
    // スキップ: 待って いる sleep を すぐ おわらせる
    function fastForward() { clearTimeout(liveTimer); liveTimer = null; if (sleepResolve) { const f = sleepResolve; sleepResolve = null; f(); } }

    // ----- 棚を 調べる (2026-11-17 ユーザー指定: 指示書 10 章) -----
    $('scene').addEventListener('click', e => {
        if (!s) return;
        const h = Scene.hit(e.clientX, e.clientY);
        if (!h) return;
        if (h.kind === 'fac') { const p = C.products.find(x => x.needs === h.id); if (p && Sim.available(s, p.id)) openInspect(p.id); else openFacInfo(h.id); }
        else openInspect(h.id);
    });
    let inspectId = null;
    function openInspect(id) {
        inspectId = id;
        if (running && !paused) { paused = true; pauseWhy = ''; resumeAfterInspect = true; } else resumeAfterInspect = false;
        renderInspect();
        $('inspect').hidden = false;
        if (running) renderLive();
    }
    function openFacInfo(id) {
        const f = Sim.facility(id);
        inspectId = null;
        $('inspect-box').innerHTML = `<h3>${f.icon} ${f.name}</h3><p class="note">${f.text}${f.warn ? `<br>⚠ ${f.warn}` : ''}<br>設備代 ${man(Sim.upkeepOf(s, id))}/週</p><button class="big" data-ins="close">とじる</button>`;
        $('inspect').hidden = false;
    }
    function closeInspect() {
        $('inspect').hidden = true;
        inspectId = null;
        if (resumeAfterInspect && running) { resumeAfterInspect = false; resume(); }
    }
    function renderInspect() {
        const id = inspectId;
        if (!id) return;
        const inf = Sim.shelfInfo(s, id), p = inf.p, w = s.wk;
        const live = running && w && w.d < 7;
        const bar3 = arr => { const mx = Math.max(1, ...arr); return `<span class="bars">${arr.map((v, t) => `<span class="b"><i style="height:${Math.round(v / mx * 100)}%"></i><small>${C.slotNames[t]}</small></span>`).join('')}</span>`; };
        const cmp = (tod, last) => (last === null ? '' : tod > last ? `<em class="up">↑ 先週 ${last}</em>` : tod < last ? `<em class="down">↓ 先週 ${last}</em>` : '<em>先週と 同じ</em>');
        let sales = '';
        if (inf.live && inf.today) {
            const tod = inf.today.reduce((a, b) => a + b, 0), last = inf.lastSame ? inf.lastSame.reduce((a, b) => a + b, 0) : null;
            sales = `<div class="ins-row"><span>売れ行き</span><div>今日 <b>${tod}</b> こ ${last !== null ? cmp(tod, last).replace('先週', `先週の ${C.dayNames[inf.d]}曜 ${C.slotNames[inf.doneT - 1]}まで`) : ''}${bar3(inf.today)}</div></div>`;
        } else {
            sales = `<div class="ins-row"><span>売れ行き</span><div>${inf.weekSold ? `先週 <b>${inf.weekSold}</b> こ (1 日 ${Math.round(inf.weekSold / 7)} こ)` : 'まだ 売って いない'}</div></div>`;
        }
        const out = inf.live ? (inf.outT.length ? `<b class="bad">${inf.outT.map(t => C.slotNames[t]).join('・')}</b> に 品切れ・買えなかった 客 ${inf.lostToday} 人` : '今日は なし') : (inf.weekLost ? `先週 ${inf.weekLost} こ 買えなかった` : '先週は なし');
        const notes = { sellout: '品切れで 帰る 客が いる…', soon: `${w && w.d < 7 ? C.slotNames[w.t] : ''}に 売りきれ そう！`, left: '売れ残り ぎみ。値下げ しようか？', good: 'よく 売れてる！' };
        const capLine = inf.cap ? `<i class="bar"><i style="width:${Math.min(100, inf.onShelf / inf.cap * 100)}%"></i></i> <b>${inf.onShelf}</b> / ${inf.cap}` : `<b>${inf.onShelf}</b> (豆)`;
        const dis = live || !running ? '' : ' disabled';
        // 種類ごとに 1 行 (2026-11-17 ユーザー指定)
        const rows = inf.rows.map(r => {
            const k = r.k, mg = r.margin, rushQ = Math.max(10, Math.round(Math.max(Sim.dailyNeed(s, k.id), 20) * 0.5 / 10) * 10);
            const todaySum = r.today ? r.today.reduce((a, b) => a + b, 0) : null, lastSum = r.lastSame ? r.lastSame.reduce((a, b) => a + b, 0) : null;
            const sold = r.live && r.today ? `今日 ${todaySum} ${cmp(todaySum, lastSum)}` : r.weekSold ? `先週 ${r.weekSold}` : '-';
            const exp = p.shelf ? `<span class="exp g">🟢${r.exp.green}</span><span class="exp y">🟡${r.exp.yellow}</span><span class="exp r">🔴${r.exp.red}</span>` : '';
            return `<div class="ins-sku${r.onShelf ? '' : ' empty'}">
                <div class="isk-head"><b>${k.single ? p.name : k.name}</b>${skuTags(k)}${!r.onShelf && !r.ware && !(s.orders[k.id] || 0) ? '<em>置いて いない</em>' : r.outT.length ? `<em class="bad">${r.outT.map(t => C.slotNames[t]).join('・')} 品切れ</em>` : ''}</div>
                <div class="isk-body">
                    <span>棚 <b>${r.onShelf}</b>・倉庫 ${r.ware}</span>${exp}<span>売れた ${sold}</span>
                    <span class="qty"><button data-ins="price" data-k="${k.id}" data-d="-1"${dis}>−</button><b class="ins-price">${s.prices[k.id]}円</b><button data-ins="price" data-k="${k.id}" data-d="1"${dis}>＋</button></span>
                    <span>仕入れ ${mg.cost}円・<span class="${mg.yen <= 0 ? 'bad' : mg.rate < C.lowMargin ? 'warn' : 'good'}">${mg.yen >= 0 ? '+' : '−'}${Math.abs(mg.yen)}円 (${Math.round(mg.rate * 100)}%)</span></span>
                    ${live && !k.self ? `<button class="mini" data-ins="rush" data-k="${k.id}" data-q="${rushQ}"${w.d >= 6 ? ' disabled' : ''}>🚚 緊急 ${rushQ} こ${w.act.rush[`${w.d + 1}:${k.id}`] ? ` (予約 ${w.act.rush[`${w.d + 1}:${k.id}`]})` : ''}</button>` : ''}
                </div></div>`;
        }).join('');
        $('inspect-box').innerHTML = `<h3>${p.icon} ${p.name} <small>${live ? `${C.dayNames[Math.min(6, w.d)]}曜 ${C.slotNames[w.t]} の まえ` : '発注の 時間 (先週の 数字)'}${Sim.hasVariety(p.id) ? `・ならんで いる 種類 ${inf.shown} / ${inf.facings} まで` : ''}</small></h3>
            <div class="ins-row"><span>棚</span><div>${capLine}</div></div>
            <div class="ins-row"><span>倉庫</span><div><b>${inf.ware}</b> こ <small>(品出し 待ち)</small></div></div>
            ${p.shelf ? `<div class="ins-row"><span>期限</span><div><span class="exp g">🟢 ${inf.exp.green}</span><span class="exp y">🟡 ${inf.exp.yellow}</span><span class="exp r">🔴 今日まで ${inf.exp.red}</span></div></div>` : ''}
            ${sales}
            <div class="ins-row"><span>品切れ</span><div>${out}</div></div>
            <div class="ins-skus">${rows}</div>
            ${live ? '<p class="note">値段・緊急発注は つぎの コマ から (緊急発注は あしたの 朝 とどく・仕入れ ×' + C.midweek.rushCost + '・送料 ' + man(C.midweek.rushFee) + ')</p>' : ''}
            ${inf.note ? `<div class="talk in">${img('furukawa', 36)}<p>${notes[inf.note]}</p></div>` : ''}
            ${live ? `<div class="ins-acts">
                ${!p.cook && !p.self ? `<button class="mini" data-ins="stock"${inf.ware ? '' : ' disabled'}>📦 すぐ 品出し<small>つぎの コマの 品出しの 力を つかう</small></button>` : ''}
                ${p.cook ? `<button class="mini" data-ins="cook"${w.act.cookBoost[w.d * 3 + w.t] ? ' disabled' : ''}>🍳 調理を 増やす<small>つぎの コマ 調理 ×${C.midweek.cookBoost}</small></button>` : ''}
            </div>` : ''}
            <button class="big" data-ins="close">${running ? 'とじて つづける' : 'とじる'}</button>`;
    }
    $('inspect').addEventListener('click', e => {
        if (e.target.id === 'inspect') { closeInspect(); return; }
        const b = e.target.closest('[data-ins]');
        if (!b) return;
        const k = b.dataset.ins, id = inspectId;
        if (k === 'close') { closeInspect(); return; }
        if (!id) return;
        const p = Sim.product(id), kid = b.dataset.k, kk = kid && Sim.sku(kid);
        if (k === 'price') { Sim.setPrice(s, kid, s.prices[kid] + Number(b.dataset.d) * C.priceStep); if (!running) renderOrder(Sim.weekInfo(s.week)); }
        else if (k === 'stock') { const n = Sim.midStock(s, id); if (n) Sound.se('stock'); say('tamu', n ? `${p.name}を ${n} こ 棚に 出したよ！` : 'もう 出せる 力が のこって ない…'); }
        else if (k === 'cook') { Sim.midCook(s); say('yamamou', 'まかせて！ どんどん 作るよ！'); }
        else if (k === 'rush') { const q = Number(b.dataset.q); if (Sim.midRush(s, kid, q)) say('nozoema', `${kk.single ? kk.name : kk.full} ${q} こ、あしたの 朝 とどけるぜ！`); }
        save();
        renderInspect();
        if (running) renderLive();
    });
    $('skip-button').addEventListener('click', () => { skip = true; closeInspect(); resume(); fastForward(); });

    // ふるカワの ひとこと
    function furukawa(r) {
        const waste = Object.values(r.products).reduce((a, p) => a + p.waste, 0), ordered = Object.values(r.products).reduce((a, p) => a + p.ordered, 0);
        const lost = Object.values(r.groups || {}).reduce((a, p) => a + p.left, 0), sold = Object.values(r.products).reduce((a, p) => a + p.sold, 0);
        if (r.rank === 1) return 'やった…！ ついに おかおか 1 だ！';
        if (r.walkAway > r.customers * 0.06) return `レジが まにあわなくて ${r.walkAway.toLocaleString()} 人も 帰っちゃった。シフトを 見なおそう。`;
        if (r.work.refused > 100) return `倉庫が いっぱいで ${r.work.refused.toLocaleString()} こ 受け取れなかったよ。発注を へらすか 倉庫を 広げよう。`;
        if (r.work.shelfOut > sold * 0.08) return '倉庫に あるのに 棚が 空で 売れなかった 商品が あるよ。品出しの 持ち場を ふやそう。';
        if (r.work.backlog > 200) return `検品が まにあわなくて ${r.work.backlog.toLocaleString()} こ 荷受け場に のこってる。検品の 持ち場を ふやそう。`;
        if (Object.values(r.products).every(x => !x.ordered) && !sold) return '何も 発注して ないから 何も とどかなかったよ！ 発注・値段の ページで 発注しよう。';
        if (lost > sold * 0.15) return '品切れが 多いね。発注を ふやそう。天気予報も 見てね。';
        if (waste > ordered * 0.15) return '廃棄が 多いよ。発注を へらすか、値下げや 子ども食堂も 考えて。';
        if (r.high > r.cheap && r.high > 50) return '「高っ…」って 声が 聞こえたよ。この 地域には ちょっと 高いのかも。';
        if (r.profit < 0) return '今週は 赤字だ。お金に 気を つけて。';
        if (r.regAfter > r.regBefore + 3) return `常連さんが ふえて きたね (${r.regAfter} 人)。いい 調子！`;
        return ['いい 1 週間 だった。この 調子で いこう！', 'ランキングも 少しずつ 見えて きたね。', '地域の 好みを 見て 品ぞろえを かえて みよう。'][r.week % 3];
    }

    let prevRank = null;
    function showReport(r) {
        // 音: まとめの 曲・もうけ・ランキングが 上がった・月末の 取り立て
        Sound.play(r.month && !r.month.grace ? 'bank' : 'report');
        setTimeout(() => { if (r.profit > 0) Sound.se('coin'); }, 300);
        if (prevRank !== null && r.rank < prevRank) setTimeout(() => Sound.se('rankup'), 900);
        if (r.month && !r.month.grace && r.month.paid) setTimeout(() => Sound.se('onioni'), 1500);
        prevRank = r.rank;
        const prow = C.products.filter(p => (r.groups || {})[p.id]).map(p => {
            const x = r.groups[p.id], pf = x.sales - (x.cost || 0), many = Sim.hasVariety(p.id);
            const head = `<tr class="${many ? 'grp' : ''}"><td>${p.icon} ${many ? `<button class="gtoggle" data-rgroup="${p.id}">▸ ${p.name}</button>` : p.name}</td><td>${x.ordered}</td><td>${x.sold}${x.marked ? `<small> (値下げ ${x.marked})</small>` : ''}</td><td class="${x.left || (!many && x.lost) ? 'lost' : ''}">${many ? x.left : x.lost}${many && x.subIn ? `<small> (代わり ${x.subIn})</small>` : ''}</td><td class="${x.waste ? 'waste' : ''}">${x.waste}${x.kids ? `<small class="kids"> 食${x.kids}</small>` : ''}</td><td>${man(x.sales)}</td><td>${man(x.cost || 0)}</td><td class="${pf < 0 ? 'lost' : 'good'}">${man(pf)}</td></tr>`;
            if (!many) return head;
            return head + Sim.skusOf(p.id).filter(k => r.products[k.id] && (r.products[k.id].sold || r.products[k.id].ordered || r.products[k.id].lost)).map(k => {
                const y = r.products[k.id], kp = y.sales - (y.cost || 0);
                return `<tr class="sub rg-${p.id}" hidden><td>　${k.name}${skuTags(k)}</td><td>${y.ordered}</td><td>${y.sold}${y.subIn ? `<small> (代わり ${y.subIn})</small>` : ''}</td><td class="${y.lost ? 'lost' : ''}">${y.lost}</td><td class="${y.waste ? 'waste' : ''}">${y.waste}</td><td>${man(y.sales)}</td><td>${man(y.cost || 0)}${y.unit ? `<small> (${y.unit}円)</small>` : ''}</td><td class="${kp < 0 ? 'lost' : 'good'}">${man(kp)}</td></tr>`;
            }).join('');
        }).join('') + Object.entries(r.limited).map(([rid, x]) => { const rc = Sim.recipe(rid), c = x.made * rc.cost; return `<tr class="limited"><td>${rc.icon} ${rc.name}</td><td>${x.made}</td><td>${x.sold}</td><td>${x.lost}</td><td>${x.waste}</td><td>${man(x.sales)}</td><td>${man(c)}</td><td class="${x.sales - c < 0 ? 'lost' : 'good'}">${man(x.sales - c)}</td></tr>`; }).join('');
        // いちばん もうけた 商品・もうけが 少なかった 商品 (2026-11-17 ユーザー指定)
        const ranked = C.skus.filter(p => r.products[p.id] && (r.products[p.id].ordered || r.products[p.id].sold)).map(p => ({ p: { ...p, name: p.single ? p.name : p.full }, v: r.products[p.id].sales - (r.products[p.id].cost || 0) })).sort((a, b) => b.v - a.v);
        const top = ranked[0], low = ranked[ranked.length - 1];
        const bestLine = ranked.length >= 2 ? `<div class="talk in">${img('furukawa', 44)}<p>いちばん もうけたのは <b>${top.p.icon}${top.p.name}</b> (${man(top.v)})。${low.v < 0 ? `<b>${low.p.icon}${low.p.name}</b>は ${man(low.v)} の 赤字… 発注か 売り値を 見なおそう。` : `もうけが 少なかったのは <b>${low.p.icon}${low.p.name}</b> (${man(low.v)})。`}</p></div>` : '';
        const days = r.days.map((d, i) => `<div class="fc"><small>${C.dayNames[i]}</small><span>${C.weather[d.w].icon}</span><small>${d.customers}</small></div>`).join('');
        const repD = r.repAfter - r.repBefore;
        const evs = r.events.map(e => `<div class="ev">${img(e.who, 36)}<p>${e.text}</p></div>`).join('');
        let month = '';
        if (r.month) {
            const m = r.month;
            const bank = m.grace ? '最初の 1 か月は つけ。返済なし！' : m.missed ? `払えなかった… おにおにが 店に 居座る！ (延滞料 ${man(C.bank.lateFee)})` : m.paid ? `${man(m.paid)} 返した (うち 利息 ${man(m.interest)})。のこり ${man(s.debt)}` : '借金は もう ない！';
            const gradeText = { S: 'すばらしい！ 本部も 大よろこびだ', A: 'いい 店だ。この 調子で', B: 'まあまあ。もっと 工夫を', C: '売上が のびて いないね…', D: 'このままでは まずい…' }[m.grade];
            month = `<div class="month"><h3>${m.month} 月の おわり</h3>
                <div class="ev">${img('onioni', 36)}<p><b>おにおにバンク</b>: ${bank}${m.forced ? `<br>資金が マイナスだったので ${man(m.forced)} 勝手に 貸した (利息 アップ)` : ''}</p></div>
                <div class="ev">${img('sasaki', 36)}<p><b>Mr.SASAKI の 査定: ${m.grade}</b> ${gradeText}${m.bonus ? `<br>本部から ボーナス ${man(m.bonus)}！` : ''}</p></div></div>`;
        }
        const banner = (r.firstClear && s.mode === 'endless' ? `<div class="banner">🏆 おかおか 1 達成！ (第 ${r.week + 1} 週) エンドレスは まだ つづく！</div>` : '')
            + (r.yearEnd ? `<div class="banner">🎉 ${r.yearEnd} 年目 おつかれさま！ ${r.yearEnd + 1} 年目が はじまる</div>` : '');
        $('modal-box').innerHTML = `<h2>今週の まとめ <small>${s.mode === 'endless' ? `${Sim.yearOf(r.week)} 年目 ` : ''}第 ${r.week % C.weeks + 1} 週${r.info.event ? `・${r.info.event.name}` : ''}</small></h2>${banner}
            <div class="forecast">${days}</div>
            <div class="sum-grid">
                <div><span>売上</span><b>${man(r.sales)}</b></div>
                <div><span>もうけ</span><b class="${r.profit < 0 ? 'bad' : 'good'}">${man(r.profit)}</b></div>
                <div><span>客</span><b>${r.customers.toLocaleString()} 人</b></div>
                <div><span>評判</span><b>${Math.round(r.repAfter)} <small class="${repD >= 0 ? 'good' : 'bad'}">${repD >= 0 ? '▲' : '▼'}${Math.abs(repD).toFixed(1)}</small></b></div>
                <div><span>常連</span><b>${r.regAfter} 人 <small class="${r.regAfter >= r.regBefore ? 'good' : 'bad'}">${r.regAfter >= r.regBefore ? '+' : ''}${r.regAfter - r.regBefore}</small></b></div>
                <div><span>ランキング</span><b>${r.rank} 位 <small>${r.score} 点</small></b></div>
            </div>
            <details open><summary>お金の くわしい ところ</summary><p class="money">売上 ${yen(r.sales)}<br>仕入れ −${yen(r.buy + r.limitedCost)} (うち 廃棄 ${yen(r.wasteYen)})<br>給料 −${yen(r.wages)}${r.wageList.filter(w => w.yen).map(w => `<small><br>　${Sim.staffDef(w.id).name} ${w.job === 'dungeon' ? 'ダンジョン' : `${w.slots} コマ`} ${yen(w.yen)}</small>`).join('')}<br>家賃 −${yen(r.rent)}<br>設備代 −${yen(r.upkeep)}<br>本部へ (売上の ${Math.round(C.royalty * 100)}%) −${yen(r.royalty)}${r.fees ? `<br>連携 −${yen(r.fees)}` : ''}<br>資金 ${yen(s.cash)}</p></details>
            <div class="workline"><span>📋 検品 ${r.work.check.reduce((a, b) => a + b, 0).toLocaleString()} こ${r.work.backlog ? ` <em class="lost">(のこり ${r.work.backlog})</em>` : ''}</span><span>📦 品出し ${r.work.stock.reduce((a, b) => a + b, 0).toLocaleString()} こ</span>${r.work.cook.some(Boolean) ? `<span>🍳 調理 ${r.work.cook.reduce((a, b) => a + b, 0).toLocaleString()} こ</span>` : ''}${r.work.refused ? `<span class="lost">倉庫が いっぱいで 受け取れず ${r.work.refused.toLocaleString()}</span>` : ''}${r.work.shelfOut ? `<span class="lost">棚が 空で 売れず ${r.work.shelfOut.toLocaleString()}</span>` : ''}</div>
            <div class="table-wrap"><table class="orders small"><thead><tr><th>商品</th><th>入荷</th><th>売れた</th><th>品切れ<small> (帰った)</small></th><th>廃棄</th><th>売上</th><th>仕入れ</th><th>もうけ</th></tr></thead><tbody>${prow}</tbody></table></div>
            ${bestLine}
            ${evs}${month}
            <div class="talk in">${img('furukawa', 44)}<p><b>ふるカワ</b>「${furukawa(r)}」</p></div>
            <button id="next-button" class="big">${s.over ? 'つづき ▶' : 'つぎの 週へ'}</button>`;
        $('modal').hidden = false;
        $('modal-box').scrollTop = 0;
        $('next-button').addEventListener('click', () => {
            $('modal').hidden = true;
            if (s.over) ending();
            else {
                Sound.play('day');
                render();
                const ev = Sim.weekInfo(s.week).event;
                // 仕入れが 上がって もうけが へった 商品が あれば ふるカワが ひとこと (2026-11-17 ユーザー決定)
                const ups = C.skus.filter(p => Sim.available(s, p.id) && Sim.costChange(s, p.id) > 0);
                const thin = ups.filter(p => Sim.marginOf(s, p.id).rate < C.lowMargin);
                if (s.offer) say('sasaki', `新商品「${Sim.sku(s.offer).full}」の おすすめが 来てるよ。発注の ページで 置くか きめてね。`);
                else if (thin.length) say('furukawa', `${thin.slice(0, 3).map(p => p.single ? p.name : p.full).join('・')}の 仕入れが 上がって、もうけが ${thin.some(p => Sim.marginOf(s, p.id).yen <= 0) ? '赤字に なってる' : 'へってる'}よ。売り値を 見なおそう。`);
                else if (ups.length >= 3) say('furukawa', `今週は ${ups.slice(0, 3).map(p => p.single ? p.name : p.full).join('・')}${ups.length > 3 ? ' など' : ''}の 仕入れが 上がったよ。もうけを 見て 売り値を きめてね。`);
                else say('koori', ev ? `今週は ${ev.name}！ ${ev.text || '発注を 考えよう。'}` : s.occupy ? 'おにおにが 店に 居座ってる… お客さんが こわがってる…' : '天気予報を 見て 発注を きめよう！');
            }
        });
    }

    // ----- エンディング (企画書: 1 位で クリア・借金を 返したら 普通の 終わり・返せないと「こおりいきていけない…」) -----
    const ENDINGS = {
        clear: { head: 'おかおか 1 の コンビニ！', lines: [['furukawa', 'ふるカワ', 'おめでとう！ コンビニランキング 1 位だ！ おかおか コンビニ計画は 大成功だよ！'], ['asahara', 'KING.ASAHARA', 'この KING.ASAHARA が… やぶれた だと…！'], ['koori', 'こおりくん', 'やった！ これで こおり いきていける！']] },
        normal: { head: '1 年 おつかれさま', lines: [['furukawa', 'ふるカワ', '1 位には とどかなかった けど、借金は ちゃんと 返したね。'], ['onioni', 'おにおに', 'ふん、きっちり 返しおって。'], ['furukawa', 'ふるカワ', 'もう 1 年 やって みるかい？ 次こそ おかおか 1 だ。']] },
        bad: { head: 'こおり いきていけない…', lines: [['onioni', 'おにおに', 'しめきりだ！ 借金は まだ のこって いるぞ！'], ['koori', 'こおりくん', 'こおり いきていけない…'], ['furukawa', 'ふるカワ', 'つぎは 借金を はやめに 返して いこう…']] }
    };
    function ending() {
        const e = ENDINGS[s.over];
        Sound.play('ending');
        clearSave();
        story(e.lines, () => {
            show('game');
            const list = Sim.ranking(s);
            $('modal-box').innerHTML = `<h2 class="end-title">${e.head}</h2><canvas id="end-art" width="320" height="120"></canvas>
                <div class="sum-grid">
                    <div><span>週 (難易度)</span><b>第 ${s.week} 週 <small>${Sim.diffOf(s).name}</small></b></div>
                    <div><span>順位</span><b>${list.findIndex(x => x.me) + 1} 位</b></div>
                    <div><span>借金</span><b class="${s.debt > 0 ? 'bad' : 'good'}">${s.debt > 0 ? man(s.debt) : 'なし'}</b></div>
                    <div><span>資金</span><b>${man(s.cash)}</b></div>
                    <div><span>評判</span><b>${Math.round(s.rep)}</b></div>
                    <div><span>常連</span><b>${s.regulars} 人</b></div>
                </div>
                <ol class="rank">${list.map((x, i) => `<li class="${x.me ? 'me' : ''}"><span class="no">${i + 1}</span>${img(x.me ? 'koori' : x.owner, 36)}<div><b>${esc(x.name)}</b></div><span class="sum">${x.score} 点</span></li>`).join('')}</ol>
                <button id="again-button" class="big">タイトルへ</button>`;
            $('modal').hidden = false;
            const g = $('end-art').getContext('2d');
            if (s.over === 'clear') { Art.draw(g, 'koori', 160, 116, { height: 90 }); [['furukawa', 40], ['yasu', 95], ['tamu', 225], ['dake', 280]].forEach(([id, x]) => Art.draw(g, id, x, 116, { height: 56 })); }
            else if (s.over === 'bad') { Art.draw(g, 'onioni', 100, 116, { height: 90 }); Art.draw(g, 'koori', 220, 116, { height: 60 }); }
            else { Art.draw(g, 'koori', 130, 116, { height: 80 }); Art.draw(g, 'furukawa', 210, 116, { height: 70 }); }
            $('again-button').addEventListener('click', () => { $('modal').hidden = true; title(); });
        });
    }

    // ----- はじめての 人への 案内 (2026-11-17 ユーザー指定: 指示書 その1 の 5 章) -----
    // 1 週目だけ ふるカワが 順に 案内する。「遊び方」から もう一度 見られる
    const TUT = [
        { el: () => $('auto-all'), tab: 'order', text: 'まずは 発注！ 店は からっぽ だから、「ぜんぶ 目安に」を 押してね。売れそうな 数を 入れて くれるよ。', done: 'auto' },
        { el: () => document.querySelector('.tabs button[data-tab="staff"]'), text: 'つぎは シフトを 見てね。「シフト・ダンジョン」を 押そう。', done: 'staffTab' },
        { el: () => document.querySelector('#tab-staff table.work'), tab: 'staff', text: '朝・昼・夜に だれが 入るか、レジ・品出し・検品・調理の どこを まかせるか きめるよ。赤い 数字は 足りない しるし。足りない ときは 持ち場を かえて みてね (はじめは この ままでも 遊べるよ)。', next: true },
        { el: () => $('go-button'), text: '準備 できたら「1週間 営業する」で 営業 スタート！ 棚を タップすると その 棚の ようすが 見られるよ。', done: 'go' }
    ];
    let tut = -1;
    function tutStart() { tut = 0; tutShow(); }
    function tutShow() {
        document.querySelectorAll('.tut-glow').forEach(x => x.classList.remove('tut-glow'));
        $('tut').hidden = tut < 0;
        if (tut < 0 || !s) return;
        const st = TUT[tut];
        if (st.tab) { const b = document.querySelector(`.tabs button[data-tab="${st.tab}"]`); if (b && tab !== st.tab) b.click(); }
        const el = st.el();
        if (el) { el.classList.add('tut-glow'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        $('tut').innerHTML = `${img('furukawa', 40)}<p><b>ふるカワの 案内 (${tut + 1}/${TUT.length})</b>${st.text}</p><span class="tut-btns">${st.next ? '<button class="mini go" data-tut="next">わかった ▶</button>' : ''}<button class="mini" data-tut="end">案内を やめる</button></span>`;
    }
    function tutDone(kind) {
        if (tut < 0 || TUT[tut].done !== kind) return;
        tut++;
        if (tut >= TUT.length) { tut = -1; if (s) s.flags.tutDone = true; }
        tutShow();
    }
    $('tut').addEventListener('click', e => {
        const b = e.target.closest('[data-tut]');
        if (!b) return;
        if (b.dataset.tut === 'next') { tut++; if (tut >= TUT.length) tut = -1; }
        else { tut = -1; if (s) s.flags.tutDone = true; save(); }
        tutShow();
    });
    // 遊び方
    $('howto-button').addEventListener('click', () => {
        $('modal-box').innerHTML = `<h2>遊び方</h2>${document.querySelector('#title .howto ul').outerHTML}
            <ul class="howto-more">
                <li>発注・値段: 商品ごとに 毎朝 とどく 数と 売り値を きめる。仕入れ値は 週ごとに 変わるので「1こ の もうけ」を 見て 売り値を 見なおそう。売り値の ボタンで「定価・ちょい安・ちょい高・もうけ ○%」。</li>
                <li>営業: 7 日ぶんを 早送りで 見せる。お店の 絵の 棚を タップすると 調べられる。止めた ところで 値段・すぐ品出し・緊急発注・シフトの 入れ替え・調理・呼びこみが できる。</li>
                <li>棚の ! は 品切れ・品切れ しそう・期限が 近い しるし。</li>
            </ul>
            <div class="title-buttons"><button id="tut-again" class="big sub">案内を もう一度 見る</button><button id="howto-close" class="big">とじる</button></div>`;
        $('modal').hidden = false;
        $('howto-close').addEventListener('click', () => { $('modal').hidden = true; });
        $('tut-again').addEventListener('click', () => { $('modal').hidden = true; if (!running) tutStart(); });
    });

    // ----- 音の 設定 (音量・ミュート) -----
    $('snd-vol').value = Math.round(Sound.vol * 100);
    $('snd-mute').checked = Sound.mute;
    const sndIcon = () => { $('snd-btn').textContent = Sound.mute || !Sound.vol ? '🔇' : '🔊'; };
    sndIcon();
    $('snd-btn').addEventListener('click', e => { e.stopPropagation(); $('snd-panel').hidden = !$('snd-panel').hidden; });
    $('snd-vol').addEventListener('input', e => { Sound.setVol(Number(e.target.value) / 100); sndIcon(); });
    $('snd-mute').addEventListener('change', e => { Sound.setMute(e.target.checked); sndIcon(); });
    document.addEventListener('click', e => { if (!e.target.closest('.snd')) $('snd-panel').hidden = true; });

    // まとめの 表: グループを ひらくと 種類ごと
    $('modal-box').addEventListener('click', e => {
        const b = e.target.closest('[data-rgroup]');
        if (!b) return;
        const rows = document.querySelectorAll(`.rg-${b.dataset.rgroup}`);
        const open = rows[0] && rows[0].hidden;
        rows.forEach(x => { x.hidden = !open; });
        b.textContent = `${open ? '▾' : '▸'} ${Sim.product(b.dataset.rgroup).name}`;
    });

    Scene.init($('scene'));
    title();
    // 画面の 確認用: ?play=kokura (すぐ はじめる)・&tab=staff・&weeks=10 (自動で すすめる)・&report=1・&end=clear|normal|bad・&story=1
    const play = params.get('play');
    if (play) {
        s = Sim.newGame('こおりマート', Number(params.get('seed') || 5), C.regions.some(r => r.id === play) ? play : 'tsugaku', params.get('diff') || 'normal', params.get('mode') || 'year');
        const weeks = Number(params.get('weeks') || 0);
        for (let i = 0; i < weeks && !s.over; i++) {
            if (i === 1) { Sim.buyFacility(s, 'fryer'); s.applicants = ['tamu', 'dake']; Sim.hire(s, 'tamu'); Sim.hire(s, 'dake'); }
            if (i === weeks - 2) Sim.recruit(s);
            if (i === 3) Sim.sendDungeon(s, 'dake', 'forest');
            autoAll();
            if (i === 2) { s.staff[2].role = 'stock'; }
            if (i === 3 && params.get('rare')) { s.applicants = [params.get('rare')]; Sim.hire(s, params.get('rare')); if (!s.metRare.includes(params.get('rare'))) s.metRare.push(params.get('rare')); }
            if (i === 4 && params.get('rare')) { s.applicants = ['ueno', 'yukionnan']; }
            lastReport = Sim.runWeek(s);
        }
        if (params.get('big')) { // 画面確認: 大きな 店
            s.storeLv = Number(params.get('big')); s.cash = 5e7;
            for (const id of ['sandwich', 'sweets', 'dairy', 'cupnoodle', 'frozen', 'magazine', 'newspaper', 'cosme', 'stationery', 'toy', 'onigiri', 'drink']) Sim.addShelf(s, id);
            for (const id of ['coffee', 'steamer', 'oden', 'toilet', 'copy', 'kids', 'bakery']) Sim.buyFacility(s, id);
        }
        start();
        if (params.get('tab')) document.querySelector(`.tabs button[data-tab="${params.get('tab')}"]`).click();
        if (params.get('report') === '1') { skip = true; $('go-button').click(); }
        if (params.get('live')) { // 画面確認: 営業の 途中 (live = 何コマ 進めるか)
            Sim.beginWeek(s); for (let i = 0; i < Number(params.get('live')); i++) Sim.runSlot(s);
            resumeWeek();
            if (params.get('inspect')) setTimeout(() => openInspect(params.get('inspect')), 300);
        } else if (params.get('inspect')) setTimeout(() => openInspect(params.get('inspect')), 300);
        if (params.get('tut')) setTimeout(() => { tutStart(); for (let i = 1; i < Number(params.get('tut')); i++) { tut++; } tutShow(); }, 300);
        if (params.get('end')) { s.over = params.get('end'); ending(); if (params.get('story') !== '1') { storyIdx = 99; storyStep(); } }
        say('furukawa', '画面の 確認用の はじまり だよ。');
    } else if (params.get('story') === '1') $('new-button').click();
    else if (params.get('region') === '1') regionSelect();
})();
