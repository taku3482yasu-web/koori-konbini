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
    let s = null, running = false, skip = false, lastReport = null;

    function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* なし */ } }
    function load() { try { const v = JSON.parse(localStorage.getItem(SAVE_KEY)); return v && v.version === 2 && !v.over ? v : null; } catch (e) { return null; } }
    function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* なし */ } }
    function show(id) { ['title', 'story', 'region', 'game'].forEach(x => { $(x).hidden = x !== id; }); }

    // ----- タイトル -----
    function title() {
        show('title');
        $('store-name').value = 'こおりマート';
        $('continue-button').hidden = !load();
        const g = $('title-art').getContext('2d');
        g.clearRect(0, 0, 320, 140);
        Art.draw(g, 'koori', 160, 130, { height: 96 });
        [['furukawa', 40], ['onioni', 95], ['yasu', 225], ['dake', 280]].forEach(([id, x], i) => Art.draw(g, id, x, 130, { height: 56, flip: i < 2 }));
    }
    $('new-button').addEventListener('click', () => story(OPENING, regionSelect));
    $('continue-button').addEventListener('click', () => { s = load(); if (s) { start(); say('furukawa', 'つづきから だね。今週も たのむよ！'); } });

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
        s = Sim.newGame($('store-name').value.trim() || 'こおりマート', seed, b.dataset.region);
        start();
        say('furukawa', `${Sim.regionOf(s).name}に 開店！ まずは 発注と 値段を きめて、シフトを 組んだら「営業する」だ。`);
    });

    function start() {
        show('game');
        Scene.setState(s);
        save();
        render();
    }
    function say(who, text) { $('talk').innerHTML = `${img(who, 44)}<p>${text}</p>`; }

    // ----- 画面 ぜんぶ -----
    let tab = 'order';
    function render() {
        const info = Sim.weekInfo(s.week);
        $('when-week').textContent = `第 ${s.week + 1} 週`;
        $('when-date').textContent = `${info.start.month}/${info.start.date}〜${info.end.month}/${info.end.date}`;
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
    }

    function lastOf(id) { const h = s.history.filter(x => !x.moved); return h.length ? h[h.length - 1].products[id] : null; }
    function prefMark(id) { const k = Sim.knownPref(s, id); return k === 'up' ? '<em class="up" title="この 地域で よく 売れる">↑</em>' : k === 'down' ? '<em class="down" title="この 地域では 売れにくい">↓</em>' : k === 'flat' ? '' : '<em class="q" title="売って いくと 好みが 分かる">？</em>'; }

    function renderOrder(info) {
        const r = Sim.regionOf(s);
        const fc = s.forecast.map((f, i) => `<div class="fc"><small>${C.dayNames[i]}</small><span>${C.weather[f.w].icon}</span><small>${f.temp}℃</small></div>`).join('');
        const ev = info.event ? `<div class="event">🎌 今週は <b>${info.event.name}</b>${info.event.text ? `　${info.event.text}` : ''}</div>` : '';
        const next = C.events.find(e => e.week === s.week + 1);
        const rows = C.products.map(p => {
            if (!Sim.available(s, p.id)) return `<tr class="locked"><td class="icon">${p.icon}</td><td colspan="5">${p.name} <small>(施設「${Sim.facility(p.needs).name}」で 売れる)</small></td></tr>`;
            const l = lastOf(p.id);
            const ratio = s.prices[p.id] / p.price;
            const voice = ratio > r.line * 1.08 ? '<span class="voice high">高っ…</span>' : ratio < C.cheapLine ? '<span class="voice cheap">安っ！</span>' : '';
            const lastText = l ? `${Math.round(l.sold / Math.max(1, l.open))}${l.lost ? ` <em class="lost">逃${Math.round(l.lost / Math.max(1, l.open))}</em>` : ''}${l.waste ? ` <em class="waste">廃${Math.round(l.waste / 7)}</em>` : ''}${l.kids ? ` <em class="kids">食${Math.round(l.kids / 7)}</em>` : ''}` : '-';
            return `<tr>
                <td class="icon">${p.icon}</td>
                <td class="pname">${p.name}${prefMark(p.id)}<small>${p.shelf ? `期限 ${p.shelf} 日` : `棚 ${Sim.capOf(s, p)}`}・仕入れ ${p.cost}円</small></td>
                <td class="qty price"><button data-price="${p.id}" data-d="-1">−</button><b>${s.prices[p.id]}円</b><button data-price="${p.id}" data-d="1">＋</button>${voice}</td>
                <td class="last">${lastText}</td>
                <td class="qty"><button data-step="${p.id}" data-d="-10">−</button><input type="number" min="0" step="10" data-order="${p.id}" value="${s.orders[p.id] || 0}"><button data-step="${p.id}" data-d="10">＋</button></td>
                <td><button class="mini" data-auto="${p.id}" title="先週 1 日に ほしがられた 数">目安 ${Sim.suggest(s, p.id)}</button></td>
            </tr>`;
        }).join('');
        const left = Sim.matsLeft(s);
        const mats = Object.entries(C.materials).map(([k, m]) => `<span class="mat">${m.icon} ${k === 'local' ? r.local.name : m.name} <b>${left[k]}</b>${left[k] !== s.mats[k] ? `<small>/${s.mats[k]}</small>` : ''}</span>`).join('');
        const recipes = C.recipes.map(rc => {
            const use = Object.entries(rc.use).map(([k, v]) => `${C.materials[k].icon}${v}`).join(' + ');
            return `<div class="recipe"><span class="ri">${rc.icon}</span><div><b>${rc.id === 'localBento' ? `${r.local.name.replace(/^.*の /, '')}弁当` : rc.name}</b><small>${use} → ${rc.make} こ・${rc.price}円${rc.rep ? '・評判 アップ' : ''}</small></div>
                <span class="qty"><button data-craft="${rc.id}" data-d="-1">−</button><b>${s.craft[rc.id] || 0}</b><button data-craft="${rc.id}" data-d="1"${Sim.craftable(s, rc.id) ? '' : ' disabled'}>＋</button></span></div>`;
        }).join('');
        $('tab-order').innerHTML = `${ev}${next ? `<div class="event next">来週は ${next.name}${next.text ? `: ${next.text}` : ''}</div>` : ''}
            <div class="forecast"><span class="lbl">天気予報</span>${fc}</div>
            <div class="order-head"><span>値段と 1 日に 入れる 数</span><button id="auto-all" class="mini">ぜんぶ 目安に</button></div>
            <div class="table-wrap"><table class="orders"><thead><tr><th></th><th>商品</th><th>値段</th><th>先週/日</th><th>発注/日</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
            <p class="note">逃 = 品切れで 買えなかった・廃 = 廃棄・食 = 子ども食堂へ。↑↓ = この 地域の 好み (売って いくと 分かる)。</p>
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
        const need = Sim.estSlots(s), caps = [0, 1, 2].map(t => Sim.slotCap(s, t));
        const summary = C.slotNames.map((n, t) => `<div class="slot-sum ${caps[t] < need[t] ? 'short' : ''}"><b>${n}</b><span>${caps[t]} / ${need[t]} 人</span></div>`).join('');
        const cards = s.staff.map(m => {
            const d = Sim.staffDef(m.id), st = Sim.stats(s, m);
            const stats = ['接客', '品出し', '調理', '探索'].map((n, i) => `<span>${n}${bar(st[i], 6)}</span>`).join('');
            let work;
            if (m.job === 'dungeon') {
                const dg = C.dungeons.find(x => x.id === m.dungeon);
                work = `<div class="away">🗺 ${dg.name}へ (${m.left ? `帰りまで あと ${m.back} 週` : '今週 出発'})${m.left ? '' : ` <button class="mini" data-recall="${m.id}">やめる</button>`}</div>`;
            } else {
                work = `<div class="slots">${C.slotNames.map((n, t) => `<button class="slotb${m.slots[t] ? ' on' : ''}" data-slot="${m.id}" data-t="${t}">${n}</button>`).join('')}
                    ${d.boss ? '' : `<select data-dungeon="${m.id}"><option value="">ダンジョンへ…</option>${C.dungeons.map(dg => `<option value="${dg.id}">${dg.name} (${dg.weeks} 週)</option>`).join('')}</select>`}</div>`;
            }
            const n = m.job === 'shop' ? m.slots.filter(Boolean).length : 2;
            const moodNote = m.job === 'shop' ? (n === 3 ? '働きすぎ' : n === 0 ? '休み' : '') : '';
            return `<div class="staff-card${m.job === 'dungeon' ? ' out' : ''}">${img(d.art, 48)}<div class="sc-main">
                <div class="sc-head"><b>${d.name}</b>${m.tired ? '<span class="tag bad">つかれ</span>' : ''}${C.trio.includes(m.id) && Sim.trioOn(s) ? '<span class="tag good">3 人 連携</span>' : ''}<small>${d.boss ? '店長' : `給料 ${man(Sim.wageOf(m))}/週`}</small></div>
                <div class="stats">${stats}</div>
                <div class="mood">やる気 ${bar(m.mood, 100)} ${Math.round(m.mood)} <small class="${n === 3 ? 'bad' : ''}">${moodNote}</small></div>
                ${work}</div>${d.boss || m.job === 'dungeon' ? '' : `<button class="mini fire" data-fire="${m.id}" title="やめて もらう">×</button>`}</div>`;
        }).join('');
        const cand = C.staff.filter(d => !s.staff.some(m => m.id === d.id));
        const hire = cand.map(d => `<div class="hire">${img(d.art, 36)}<div><b>${d.name}</b><small>${d.text}・接${d.st[0]} 品${d.st[1]} 調${d.st[2]} 探${d.st[3]}・給料 ${man(d.wage)}/週</small></div><button class="mini" data-hire="${d.id}"${s.staff.length >= C.maxStaff || s.cash < d.wage ? ' disabled' : ''}>やとう</button></div>`).join('');
        const items = Object.entries(C.items).map(([k, it]) => `<div class="hire"><span class="ri">${it.icon}</span><div><b>${it.name} ×${s.items[k]}</b><small>${it.text}${s.effects[k] ? `・あと ${s.effects[k]} 週` : ''}</small></div><button class="mini" data-item="${k}"${s.items[k] ? '' : ' disabled'}>つかう</button></div>`).join('');
        $('tab-staff').innerHTML = `<h3>シフト (1 日の 客 / 見こみ・土曜くらい)</h3><div class="slot-sums">${summary}</div>
            <p class="note">朝・昼・夜の 3 コマ。接客 1 で 1 コマ ${C.serve} 人 さばける。3 コマ 入ると 働きすぎで やる気が 下がり、やめて しまう ことも。やす・たむ・だけ の 3 人が 店に そろうと 連携ボーナス。</p>
            <div class="staff-list">${cards}</div>
            <h3>ダンジョン</h3><p class="note">${C.dungeons.map(d => `<b>${d.name}</b> ${d.weeks} 週 (${Object.keys(d.rewards).map(k => C.materials[k].name).join('・')}${d.maboroshi ? '・幻の 食材' : ''})`).join('<br>')}<br>探索が 高いほど 多く 持って 帰る。帰った 次の 週は つかれて 仕事が 下手に なる。</p>
            <h3>便利アイテム</h3><div class="hire-list">${items}</div>
            <h3>スタッフを やとう (${s.staff.length}/${C.maxStaff})</h3><div class="hire-list">${hire || '<small>もう いない</small>'}</div>`;
    }

    function renderShop() {
        const used = s.facilities.length;
        $('tab-shop').innerHTML = `<p class="note">店の 広さは ${C.slots} マス (いま ${used} マス)。施設ごとに 集まる 客が ちがう。はずすと ${Math.round(C.sellBack * 100)}% もどる。</p><div class="shop">${C.facilities.map(f => {
            const have = Sim.hasFac(s, f.id), cost = Sim.facCost(s, f.id);
            return `<div class="item${have ? ' have' : ''}"><span class="ui">${f.icon}</span><div><b>${f.name}</b><small>${f.text}${f.warn ? `<br><span class="warn">⚠ ${f.warn}</span>` : ''}</small></div>
                ${have ? `<button class="mini" data-remove="${f.id}">はずす</button>` : `<button data-buy="${f.id}"${s.cash < cost || used >= C.slots ? ' disabled' : ''}>${man(cost)}</button>`}</div>`;
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
        $('tab-area').innerHTML = `<h3>${r.icon} ${r.name}</h3><p>${r.text}<br>家賃 ${man(r.rent)}/週・特産品 ${r.local.icon} ${r.local.name}</p>
            <p>先週の 客 (1 日): ${segText}</p>
            <p>常連 <b>${s.regulars}</b> 人</p>
            <h3>この 地域の 好み</h3><div class="prefs">${prefs}</div><p class="note">${C.knowWeeks} 週 売ると 分かる。↑ よく 売れる・↓ 売れにくい</p>
            <h3>移転</h3><p class="note">店は 1 軒だけ。お金を 払えば 別の 地域へ 移れる。施設と 地域の 知識は のこる。常連は ${Math.round(C.moveKeepRegulars * 100)}% だけ ついて くる。</p><div class="shop">${others}</div>`;
    }

    function renderRank() {
        const list = Sim.ranking(s);
        $('tab-rank').innerHTML = `<h3>コンビニランキング</h3><ol class="rank">${list.map((x, i) => {
            const cr = C.rivals.find(r => r.name === x.name);
            return `<li class="${x.me ? 'me' : ''}"><span class="no">${i + 1}</span>${img(x.me ? 'koori' : x.owner, 36)}<div><b>${esc(x.name)}</b><small>${x.me ? '店長 こおりくん' : `${cr.boss}「${cr.line}」`}</small></div><span class="sum">${x.score} 点</span></li>`;
        }).join('')}</ol><p class="note">点 = 直近 ${C.rankWeeks} 週の 売上の 平均 (万円) + 評判 × 0.5。毎週 発表。1 位に なったら クリア！ のこり ${C.weeks - s.week} 週。</p>`;
    }

    function updateCost() {
        const buy = C.products.reduce((a, p) => a + (Sim.available(s, p.id) ? (s.orders[p.id] || 0) * p.cost * 7 : 0), 0);
        const fees = C.partners.filter(p => !p.perUse && s.partners[p.id].on).reduce((a, p) => a + Sim.partnerFee(s, p.id), 0) + (s.eventDay >= 0 ? Sim.partnerFee(s, 'event') : 0);
        $('cost-note').innerHTML = `仕入れ 約${man(buy)}・給料 ${man(Sim.wages(s))}・家賃 ${man(Sim.regionOf(s).rent)}${fees ? `・連携 ${man(fees)}` : ''}`;
    }

    // ----- 操作 -----
    document.querySelector('.tabs').addEventListener('click', e => {
        const b = e.target.closest('button[data-tab]');
        if (!b) return;
        tab = b.dataset.tab;
        document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
        document.querySelectorAll('#game .panel').forEach(p => { p.hidden = p.id !== `tab-${tab}`; });
    });
    $('game').addEventListener('click', e => {
        if (running) return;
        const t = e.target.closest('button');
        if (!t) return;
        const d = t.dataset;
        if (d.step) { s.orders[d.step] = Math.max(0, (s.orders[d.step] || 0) + Number(d.d)); const inp = document.querySelector(`input[data-order="${d.step}"]`); if (inp) inp.value = s.orders[d.step]; updateCost(); }
        else if (d.auto) { s.orders[d.auto] = Sim.suggest(s, d.auto); renderOrder(Sim.weekInfo(s.week)); updateCost(); }
        else if (t.id === 'auto-all') { for (const p of C.products) if (Sim.available(s, p.id)) s.orders[p.id] = Sim.suggest(s, p.id); renderOrder(Sim.weekInfo(s.week)); updateCost(); }
        else if (d.price) {
            const p = Sim.product(d.price);
            s.prices[p.id] = Math.max(Math.round(p.price * C.priceRange[0] / 10) * 10, Math.min(Math.round(p.price * C.priceRange[1] / 10) * 10, s.prices[p.id] + Number(d.d) * C.priceStep));
            renderOrder(Sim.weekInfo(s.week));
        }
        else if (d.craft) { Sim.addCraft(s, d.craft, Number(d.d)); renderOrder(Sim.weekInfo(s.week)); }
        else if (d.slot) { Sim.toggleSlot(s, d.slot, Number(d.t)); renderStaff(); updateCost(); }
        else if (d.recall) { Sim.recall(s, d.recall); renderStaff(); }
        else if (d.fire) { if (confirm(`${Sim.staffDef(d.fire).name}に やめて もらう？`)) { Sim.fire(s, d.fire); render(); } }
        else if (d.hire) { if (Sim.hire(s, d.hire)) { say(Sim.staffDef(d.hire).art, `${Sim.staffDef(d.hire).name}です！ よろしく おねがいします！`); render(); } }
        else if (d.item) { if (Sim.useItem(s, d.item)) { say('koori', `${C.items[d.item].name}を つかった！ ${C.items[d.item].text}`); render(); } }
        else if (d.buy) { const f = Sim.facility(d.buy); if (Sim.buyFacility(s, f.id)) { say('koori', `「${f.name}」を 置いたよ！ ${f.text}`); render(); } }
        else if (d.remove) { if (confirm(`「${Sim.facility(d.remove).name}」を はずす？`)) { Sim.removeFacility(s, d.remove); render(); } }
        else if (d.partner) { const st = s.partners[d.partner]; Sim.setPartner(s, d.partner, !st.on); const p = Sim.partner(d.partner); if (st.on && p.art) say(p.art, p.id === 'ad' ? 'まかせろ！！ おかおか じゅうに 店の 名前を さけんで くるぜ！！' : 'よろしく！'); render(); }
        else if (d.repay) { Sim.repay(s, d.repay === 'all' ? s.debt : Number(d.repay)); if (s.debt <= 0) say('onioni', 'ぐぬぬ… ぜんぶ 返しおった…！'); render(); }
        else if ('borrow' in d) { if (confirm(`${man(C.bank.borrow)} 借りる？ 利息が 月 ${((s.rate + C.bank.borrowRate) * 100).toFixed(0)}% に 上がる`)) { Sim.borrow(s); say('onioni', 'がっはっは！ 毎度 あり！'); render(); } }
        else if (d.move) { const r = C.regions.find(x => x.id === d.move); if (confirm(`${r.name}へ 移転する？ ${man(C.moveCost)} かかる`)) { Sim.relocate(s, r.id); say('furukawa', `${r.name}へ 移転した！ 新しい 地域の 客に 合わせよう。`); render(); } }
        else return;
        save();
    });
    $('game').addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.order) { s.orders[t.dataset.order] = Math.max(0, Math.round(Number(t.value) || 0)); t.value = s.orders[t.dataset.order]; updateCost(); }
        else if (t.name === 'markdown') { s.markdown = Number(t.value); renderOrder(Sim.weekInfo(s.week)); }
        else if (t.id === 'kids') { s.kids = t.checked; renderOrder(Sim.weekInfo(s.week)); }
        else if (t.dataset.dungeon && t.value) { const dg = C.dungeons.find(x => x.id === t.value); if (Sim.sendDungeon(s, t.dataset.dungeon, t.value)) say(Sim.staffDef(t.dataset.dungeon).art, `${dg.name}に 行って きます！ (${dg.weeks} 週)`); renderStaff(); updateCost(); }
        else if ('dj' in t.dataset) { Sim.bookEvent(s, Number(t.value)); if (s.eventDay >= 0) say('okagappa', `${C.dayNames[s.eventDay]}曜日は まかせとけ！ YO！`); updateCost(); }
        save();
    });

    // ----- 1 週間 営業 -----
    const wait = ms => new Promise(r => setTimeout(r, skip ? 0 : ms));
    $('go-button').addEventListener('click', async () => {
        if (running) return;
        if (!s.staff.some(m => m.job === 'shop' && m.slots.some(Boolean))) { say('koori', 'だれも シフトに 入って ないよ！'); return; }
        running = true;
        skip = skip || params.get('fast') === '1';
        $('go-button').disabled = true;
        const report = Sim.runWeek(s);
        lastReport = report;
        save();
        $('ticker').hidden = false;
        $('skip-button').hidden = false;
        let total = 0;
        for (let d = 0; d < 7; d++) {
            const day = report.days[d], dt = Sim.dateOf(report.week * 7 + d);
            total += day.sales;
            Scene.setDay({ w: day.w, temp: day.temp, gold: day.gold, label: `${dt.month}/${dt.date}` }, Math.min(1, day.customers / 900));
            if (day.flags.high) Scene.say('高っ…', '#c03030');
            if (day.flags.cheap) Scene.say('安っ！', '#2a8a3a');
            if (day.flags.out) Scene.say('品切れ？', '#7a5a10');
            if (day.walkAway > 30) Scene.say('レジ ならびすぎ…', '#555');
            if (day.gold) Scene.say('ゴールド金面犬だ！', '#b08000');
            if (day.dj) Scene.say('YO！ DJ かっぱ！', '#2050c0');
            if (Object.values(report.limited).some(x => x.sold)) Scene.say('限定だ！', '#8030a0');
            $('ticker').innerHTML = `<b>${dt.month}/${dt.date} (${C.dayNames[d]})</b> ${C.weather[day.w].icon} ${day.temp}℃　客 ${day.customers.toLocaleString()} 人${day.walkAway > 20 ? ` <em>(${day.walkAway} 人 帰った)</em>` : ''}　売上 ${man(day.sales)}<br><small>今週の 売上 ${man(total)}</small>`;
            await wait(1100);
        }
        $('ticker').hidden = true;
        $('skip-button').hidden = true;
        running = false;
        skip = false;
        $('go-button').disabled = false;
        showReport(report);
    });
    $('skip-button').addEventListener('click', () => { skip = true; });

    // ふるカワの ひとこと
    function furukawa(r) {
        const waste = Object.values(r.products).reduce((a, p) => a + p.waste, 0), ordered = Object.values(r.products).reduce((a, p) => a + p.ordered, 0);
        const lost = Object.values(r.products).reduce((a, p) => a + p.lost, 0), sold = Object.values(r.products).reduce((a, p) => a + p.sold, 0);
        if (r.rank === 1) return 'やった…！ ついに おかおか 1 だ！';
        if (r.walkAway > r.customers * 0.06) return `レジが まにあわなくて ${r.walkAway.toLocaleString()} 人も 帰っちゃった。シフトを 見なおそう。`;
        if (lost > sold * 0.15) return '品切れが 多いね。発注を ふやそう。天気予報も 見てね。';
        if (waste > ordered * 0.15) return '廃棄が 多いよ。発注を へらすか、値下げや 子ども食堂も 考えて。';
        if (r.high > r.cheap && r.high > 50) return '「高っ…」って 声が 聞こえたよ。この 地域には ちょっと 高いのかも。';
        if (r.profit < 0) return '今週は 赤字だ。お金に 気を つけて。';
        if (r.regAfter > r.regBefore + 3) return `常連さんが ふえて きたね (${r.regAfter} 人)。いい 調子！`;
        return ['いい 1 週間 だった。この 調子で いこう！', 'ランキングも 少しずつ 見えて きたね。', '地域の 好みを 見て 品ぞろえを かえて みよう。'][r.week % 3];
    }

    function showReport(r) {
        const prow = C.products.filter(p => r.products[p.id]).map(p => {
            const x = r.products[p.id];
            return `<tr><td>${p.icon} ${p.name}</td><td>${x.ordered}</td><td>${x.sold}${x.marked ? `<small> (値下げ ${x.marked})</small>` : ''}</td><td class="${x.lost ? 'lost' : ''}">${x.lost}</td><td class="${x.waste ? 'waste' : ''}">${x.waste}${x.kids ? `<small class="kids"> 食${x.kids}</small>` : ''}</td><td>${man(x.sales)}</td></tr>`;
        }).join('') + Object.entries(r.limited).map(([rid, x]) => { const rc = Sim.recipe(rid); return `<tr class="limited"><td>${rc.icon} ${rc.name}</td><td>${x.made}</td><td>${x.sold}</td><td>${x.lost}</td><td>${x.waste}</td><td>${man(x.sales)}</td></tr>`; }).join('');
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
        $('modal-box').innerHTML = `<h2>今週の まとめ <small>第 ${r.week + 1} 週${r.info.event ? `・${r.info.event.name}` : ''}</small></h2>
            <div class="forecast">${days}</div>
            <div class="sum-grid">
                <div><span>売上</span><b>${man(r.sales)}</b></div>
                <div><span>もうけ</span><b class="${r.profit < 0 ? 'bad' : 'good'}">${man(r.profit)}</b></div>
                <div><span>客</span><b>${r.customers.toLocaleString()} 人</b></div>
                <div><span>評判</span><b>${Math.round(r.repAfter)} <small class="${repD >= 0 ? 'good' : 'bad'}">${repD >= 0 ? '▲' : '▼'}${Math.abs(repD).toFixed(1)}</small></b></div>
                <div><span>常連</span><b>${r.regAfter} 人 <small class="${r.regAfter >= r.regBefore ? 'good' : 'bad'}">${r.regAfter >= r.regBefore ? '+' : ''}${r.regAfter - r.regBefore}</small></b></div>
                <div><span>ランキング</span><b>${r.rank} 位 <small>${r.score} 点</small></b></div>
            </div>
            <details><summary>お金の くわしい ところ</summary><p class="money">売上 ${yen(r.sales)}<br>仕入れ −${yen(r.buy + r.limitedCost)} (うち 廃棄 ${yen(r.wasteYen)})<br>給料 −${yen(r.wages)}<br>家賃 −${yen(r.rent)}<br>本部へ (売上の ${Math.round(C.royalty * 100)}%) −${yen(r.royalty)}${r.fees ? `<br>連携 −${yen(r.fees)}` : ''}<br>資金 ${yen(s.cash)}</p></details>
            <div class="table-wrap"><table class="orders small"><thead><tr><th>商品</th><th>入荷</th><th>売れた</th><th>品切れ</th><th>廃棄</th><th>売上</th></tr></thead><tbody>${prow}</tbody></table></div>
            ${evs}${month}
            <div class="talk in">${img('furukawa', 44)}<p><b>ふるカワ</b>「${furukawa(r)}」</p></div>
            <button id="next-button" class="big">${s.over ? 'つづき ▶' : 'つぎの 週へ'}</button>`;
        $('modal').hidden = false;
        $('modal-box').scrollTop = 0;
        $('next-button').addEventListener('click', () => {
            $('modal').hidden = true;
            if (s.over) ending();
            else {
                render();
                const ev = Sim.weekInfo(s.week).event;
                say('koori', ev ? `今週は ${ev.name}！ ${ev.text || '発注を 考えよう。'}` : s.occupy ? 'おにおにが 店に 居座ってる… お客さんが こわがってる…' : '天気予報を 見て 発注を きめよう！');
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
        clearSave();
        story(e.lines, () => {
            show('game');
            const list = Sim.ranking(s);
            $('modal-box').innerHTML = `<h2 class="end-title">${e.head}</h2><canvas id="end-art" width="320" height="120"></canvas>
                <div class="sum-grid">
                    <div><span>週</span><b>第 ${s.week} 週</b></div>
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

    Scene.init($('scene'));
    title();
    // 画面の 確認用: ?play=kokura (すぐ はじめる)・&tab=staff・&weeks=10 (自動で すすめる)・&report=1・&end=clear|normal|bad・&story=1
    const play = params.get('play');
    if (play) {
        s = Sim.newGame('こおりマート', Number(params.get('seed') || 5), C.regions.some(r => r.id === play) ? play : 'tsugaku');
        const weeks = Number(params.get('weeks') || 0);
        for (let i = 0; i < weeks && !s.over; i++) {
            if (i === 1) { Sim.buyFacility(s, 'fryer'); Sim.hire(s, 'tamu'); Sim.hire(s, 'dake'); }
            if (i === 3) Sim.sendDungeon(s, 'dake', 'forest');
            for (const p of C.products) if (Sim.available(s, p.id)) s.orders[p.id] = Sim.suggest(s, p.id);
            lastReport = Sim.runWeek(s);
        }
        start();
        if (params.get('tab')) document.querySelector(`.tabs button[data-tab="${params.get('tab')}"]`).click();
        if (params.get('report') === '1') { skip = true; $('go-button').click(); }
        if (params.get('end')) { s.over = params.get('end'); ending(); if (params.get('story') !== '1') { storyIdx = 99; storyStep(); } }
        say('furukawa', '画面の 確認用の はじまり だよ。');
    } else if (params.get('story') === '1') $('new-button').click();
    else if (params.get('region') === '1') regionSelect();
})();
