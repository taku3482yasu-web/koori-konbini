// お店の 中を 見下ろす 絵 (企画書: 棚・レジ・施設が ならび、スタッフと 客が 歩きまわる。客の 頭の 上に ひとこと)
// 2026-11-17 ユーザー指定 (指示書 その1):
//   3 章 = 営業の ようすを 見せる (客が 入る → 棚から 取る → レジに ならぶ → 出る。品切れで 帰る 客・行列で イライラ する 客。天気・行事・キャラの できごと)
//   6 章 = 床の マスに 合わせて 通路を はさんで 棚を ならべる。施設は その マスに。品切れの 棚は 空っぽ、期限が 近いと 色
//   10 章 = 棚・施設を タップすると 調べられる (hit)。品切れ・期限が 近い 棚に しるし (!)
// 絵の 動きは Math.random (計算の 乱数 state.rs とは 別)
const Scene = (() => {
    const W = 640, H = 340;
    let cv, g, s = null, t = 0, busy = 0.2, bubbles = [], day = null, live = null;
    const walkers = [];
    const DOOR = { x: 330, y: 318 };
    const REG = { x: 70, y: 252 };
    const AREA = { x: 146, y: 40, w: 488, h: 184 };
    const SHELF_COLOR = { chilled: ['#cfe9f7', '#7fb8de'], drinkcase: ['#b8dcf5', '#4a90c8'], freezer: ['#eef8ff', '#8fc6e6'], ambient: ['#d8c6a4', '#a08a62'], goods: ['#e2d2ee', '#a58bc0'], rack: ['#efe0bc', '#b8a070'] };
    const COLS = { 12: 6, 18: 6, 26: 9, 36: 12 };

    // ----- 床の マス (店の 大きさで 列が かわる)。棚 → 施設 → あき の じゅん -----
    function cells() {
        if (!s) return [];
        const floor = Sim.floorCap(s);
        const cols = COLS[floor] || Math.ceil(floor / 3), rows = Math.ceil(floor / cols);
        const aisle = rows > 1 ? Math.min(30, (AREA.h - rows * 40) / (rows - 1)) : 0;
        const ch = Math.min(46, (AREA.h - aisle * (rows - 1)) / rows);
        const cw = Math.min(70, AREA.w / cols);
        const x0 = AREA.x + (AREA.w - cw * cols) / 2;
        const list = [];
        for (const p of Sim.C.products) if (!p.cook && !p.self) for (let i = 0; i < Sim.shelfUnits(s, p.id); i++) list.push({ kind: 'shelf', id: p.id, p });
        for (const id of s.facilities) list.push({ kind: 'fac', id });
        while (list.length < floor) list.push({ kind: 'empty' });
        return list.slice(0, floor).map((c, i) => {
            const r = Math.floor(i / cols), k = i % cols;
            // 2 列 ずつ 背中あわせ (通路から 取れる): 偶数の 段は 下が 通路、奇数の 段は 上が 通路
            return { ...c, x: x0 + k * cw, y: AREA.y + r * (ch + aisle), w: cw, h: ch, row: r, front: r % 2 === 0 ? AREA.y + r * (ch + aisle) + ch + Math.min(14, aisle / 2 + 2) : AREA.y + r * (ch + aisle) - Math.min(10, aisle / 2) };
        });
    }

    function init(canvas) {
        cv = canvas;
        g = cv.getContext('2d');
        requestAnimationFrame(loop);
    }
    const setState = st => { s = st; };
    function setDay(d, b) { day = d; if (b !== undefined) busy = b; }
    // 営業中の ようす (null = 営業して いない)。{ slot: 0〜2, outs: [id], alerts: Set(id) }
    function setLive(v) { live = v; }
    // ひとこと (画面の どこかの 客の 上に 出す)
    function say(text, color, who) {
        const w = who || pick(walkers.filter(x => x.phase > 0 && x.phase < 6));
        bubbles.push({ text, color: color || '#13203a', life: 110, who: w, x: w ? w.x : 200 + Math.random() * 200, y: w ? w.y : 200 });
    }
    const pick = a => (a.length ? a[Math.floor(Math.random() * a.length)] : null);
    const CUSTOMERS = ['yamamou', 'sasaki', 'kotani', 'ueno', 'ikekimu', 'furukawa', 'ishii', 'harigeneral', 'okagappa', 'hibikimakuri', 'hyougaryu', 'tamu', 'dake', 'kakigoora', 'tsukiusagi'];

    // ----- 1 コマ ぶんの 客を 出す (3 章) -----
    // slot = Sim.runSlot の かえり値、ms = この コマを 見せる 時間
    let plan = [], lastBeep = 0;
    function playSlot(slot, ms, extra = {}) {
        const n = Math.max(2, Math.min(16, Math.round(slot.customers / 28)));
        const outRate = slot.outs.length ? Math.min(0.45, 0.08 + slot.outs.length * 0.06) : 0;
        const angry = slot.want ? Math.min(0.6, slot.walkAway / slot.want * 3) : 0;
        plan = [];
        for (let i = 0; i < n; i++) {
            const role = Math.random() < outRate ? 'out' : Math.random() < angry ? 'angry' : 'buy';
            plan.push({ at: t + Math.round((i / n) * (ms / 16.7) * 0.8), role });
        }
        if (extra.special) plan.push({ at: t + 10, role: 'buy', id: extra.special, say: extra.specialSay });
        if (slot.callout) { const k = s && s.staff.find(m => m.id === 'koori'); if (k) say('いらっしゃいませー！', '#1b5fae'); }
        liveOuts = slot.outs;
    }
    let liveOuts = [];
    function spawn(role = 'buy', id, sayText) {
        const cs = cells().filter(c => c.kind === 'shelf');
        let target = pick(cs);
        if (role === 'out') target = pick(cs.filter(c => liveOuts.includes(c.id))) || target;
        if (!target) target = { x: 360, y: 150, w: 30, front: 170 };
        const w = { id: id || (day && day.gold && Math.random() < 0.2 ? 'goldDog' : pick(CUSTOMERS)), x: DOOR.x + (Math.random() - 0.5) * 20, y: H + 10, phase: 0, tx: target.x + target.w / 2 + (Math.random() - 0.5) * 10, ty: target.front, wait: 0, f: 0, role, shelf: target.id };
        walkers.push(w);
        if (sayText) setTimeout(() => say(sayText, '#b08000', w), 400);
        return w;
    }
    // レジの 行列 (ならんで いる じゅん)
    const queue = () => walkers.filter(w => w.phase === 3 || w.phase === 4).sort((a, b) => a.qt - b.qt);
    function step(w, tx, ty, v = 1.4) {
        const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy);
        if (d < v) { w.x = tx; w.y = ty; return true; }
        w.x += dx / d * v; w.y += dy / d * v; w.f += 0.15;
        return false;
    }
    function loop() {
        t++;
        if (live) { while (plan.length && plan[0].at <= t) { const p = plan.shift(); if (walkers.length < 22) spawn(p.role, p.id, p.say); } }
        else if (Math.random() < busy * 0.05 && walkers.length < 10) spawn();
        const q = queue();
        for (const w of walkers) {
            if (w.phase === 0 && step(w, DOOR.x, DOOR.y - 22)) w.phase = 1;
            else if (w.phase === 1 && step(w, w.tx, w.ty)) { w.phase = 2; w.wait = 30 + Math.random() * 40; }
            else if (w.phase === 2 && --w.wait <= 0) {
                if (w.role === 'out') { say('品切れ？', '#7a5a10', w); w.phase = 6; }
                else { w.phase = 3; w.qt = t; }
            }
            else if (w.phase === 3) {
                const i = q.indexOf(w);
                if (step(w, REG.x + 40 + i * 16, REG.y + 34 + (i % 2) * 3)) {
                    if (i === 0) { w.phase = 4; w.wait = 26; }
                    else if (w.role === 'angry' && !w.said && i >= 2) { w.said = true; say(pick(['まだ？', 'ならびすぎ…', 'イライラ…']), '#c03030', w); w.wait = 60; }
                    else if (w.said && --w.wait <= 0) { w.phase = 6; }
                }
            }
            else if (w.phase === 4 && --w.wait <= 0) { w.phase = 5; if (live && typeof Sound !== 'undefined' && t - lastBeep > 8) { lastBeep = t; Sound.se('beep'); } }
            else if ((w.phase === 5 || w.phase === 6) && step(w, DOOR.x + (w.phase === 6 ? 20 : -20), H + 20, w.phase === 6 ? 1.7 : 1.4)) w.dead = true;
        }
        for (let i = walkers.length - 1; i >= 0; i--) if (walkers[i].dead) walkers.splice(i, 1);
        for (const b of bubbles) { b.life--; if (b.who) { b.x = b.who.x; b.y = b.who.y; } }
        bubbles = bubbles.filter(b => b.life > 0);
        draw();
        requestAnimationFrame(loop);
    }

    function draw() {
        // 床
        g.fillStyle = '#e9e4d8'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#ddd7c8';
        for (let y = 30; y < 300; y += 20) for (let x = (y / 20) % 2 ? 20 : 0; x < W; x += 40) g.fillRect(x, y, 20, 20);
        // かべ
        g.fillStyle = '#3d8fd6'; g.fillRect(0, 0, W, 30);
        g.fillStyle = '#8fdcff'; g.fillRect(0, 24, W, 6);
        g.fillStyle = '#fff'; g.font = '14px "DotGothic16", monospace'; g.textAlign = 'left';
        g.fillText(s ? s.name : '', 12, 19);
        if (s) { g.textAlign = 'right'; const r = Sim.regionOf(s); g.fillText(`${Sim.levelOf(s).name}・${r.icon} ${r.name}`, W - 12, 19); }
        // 外 (歩道) と 入り口
        g.fillStyle = '#b9b2a4'; g.fillRect(0, 300, W, H - 300);
        g.fillStyle = '#6d7a8c'; g.fillRect(0, 298, W, 4);
        g.fillStyle = '#9fd4f5'; g.fillRect(DOOR.x - 30, 296, 60, 8);
        // 床の マス (棚・施設・あき)
        const cs = cells();
        for (const c of cs) {
            if (c.kind === 'shelf') drawUnit(c);
            else if (c.kind === 'fac') drawFacility(c);
            else { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.setLineDash([4, 4]); g.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6); g.setLineDash([]); }
        }
        // レジ横の ケース (コーヒー・ホットスナック・おでん・中華まん)
        if (s) Sim.C.products.filter(p => (p.cook || p.self) && Sim.available(s, p.id)).forEach((p, i) => {
            g.fillStyle = '#f2e6d0'; g.fillRect(REG.x - 54 + i * 28, REG.y - 30, 26, 22);
            g.font = '15px sans-serif'; g.textAlign = 'center'; g.fillText(p.icon, REG.x - 41 + i * 28, REG.y - 13);
            if (live && live.marks && live.marks[p.id]) mark(REG.x - 30 + i * 28, REG.y - 32, live.marks[p.id]);
        });
        // レジ
        g.fillStyle = '#8a6a48'; g.fillRect(REG.x - 60, REG.y, 150, 22);
        g.fillStyle = '#c9a77a'; g.fillRect(REG.x - 60, REG.y, 150, 6);
        g.fillStyle = '#2b3a4f'; g.fillRect(REG.x + 54, REG.y - 8, 18, 12);
        if (s) {
            // 倉庫 (左上)。箱の 数で 在庫が 分かる
            const used = Sim.wareUse(s) / Sim.wareCap(s);
            g.fillStyle = '#cdbf9f'; g.fillRect(8, 36, 128, 120);
            g.fillStyle = '#8a7a5a'; g.fillRect(8, 36, 128, 4);
            g.fillStyle = '#5a4a32'; g.font = '11px "M PLUS Rounded 1c", sans-serif'; g.textAlign = 'left';
            g.fillText(`倉庫 ${Math.round(used * 100)}%`, 14, 150);
            const boxes = Math.round(used * 24);
            for (let i = 0; i < boxes; i++) { g.fillStyle = i % 3 ? '#c8945a' : '#b07a42'; g.fillRect(16 + (i % 6) * 19, 112 - Math.floor(i / 6) * 18, 15, 15); g.fillStyle = '#e8c88a'; g.fillRect(16 + (i % 6) * 19 + 6, 112 - Math.floor(i / 6) * 18, 3, 15); }
            // スタッフは 持ち場の 場所に 立つ (営業中は その コマの 人だけ)
            const aisles = cs.filter(c => c.kind === 'shelf');
            const spot = {
                register: i => [REG.x - 40 + i * 26, REG.y + 2],
                stock: i => { const c = aisles[(i * 5 + 2) % Math.max(1, aisles.length)]; return c ? [c.x + c.w / 2, c.front + 4] : [300, 200]; },
                check: i => [30 + i * 30, 104], cook: i => [REG.x - 40 + i * 28, REG.y - 34]
            };
            const count = {};
            s.staff.filter(m => m.job === 'shop' && (live ? m.slots[live.slot] && !(live.callout && m.id === 'koori') : m.slots.some(Boolean))).forEach((m, k) => {
                const role = m.role || 'register';
                const i = count[role] = (count[role] || 0) + 1;
                const [x, y] = spot[role](i - 1);
                const sway = role === 'stock' ? Math.sin((t + k * 40) / 50) * 14 : 0;
                Art.draw(g, Sim.staffDef(m.id).art, x + sway, y, { height: 30, frame: Math.floor((t + k * 13) / 28) });
            });
            // 呼びこみ中の こおりくん (店の 前)
            if (live && live.callout) Art.draw(g, 'koori', DOOR.x + 70, 318, { height: 34, frame: Math.floor(t / 14) });
            // おにおにが 居座り
            if (s.occupy) Art.draw(g, 'onioni', DOOR.x - 80, 316, { height: 44, frame: Math.floor(t / 20) });
        }
        // 客
        for (const w of [...walkers].sort((a, b) => a.y - b.y)) Art.draw(g, w.id, w.x, w.y, { height: 28, frame: Math.floor(w.f) });
        // 天気 (雨・雪) と 時間 (夜は 暗く)
        if (day && (day.w === 'rain' || day.w === 'typhoon')) {
            g.strokeStyle = 'rgba(80,120,200,0.55)'; g.lineWidth = 1;
            for (let i = 0; i < (day.w === 'typhoon' ? 60 : 30); i++) { const x = (i * 53 + t * (day.w === 'typhoon' ? 9 : 4)) % W, y = 300 + (i * 17 + t * 3) % 40; g.beginPath(); g.moveTo(x, y); g.lineTo(x - (day.w === 'typhoon' ? 8 : 2), y + 7); g.stroke(); }
        } else if (day && day.w === 'snow') {
            g.fillStyle = '#fff';
            for (let i = 0; i < 30; i++) g.fillRect((i * 41 + Math.sin(t / 30 + i) * 8 + W) % W, 300 + (i * 13 + t) % 40, 3, 3);
        }
        if (live && live.slot === 2) { g.fillStyle = 'rgba(10,20,60,0.22)'; g.fillRect(0, 0, W, H); }
        // ひとこと
        g.font = '13px "M PLUS Rounded 1c", sans-serif';
        g.textAlign = 'center';
        for (const b of bubbles) {
            const wdt = g.measureText(b.text).width + 14, x = Math.max(wdt / 2, Math.min(W - wdt / 2, b.x)), y = b.y - 40 - (110 - b.life) * 0.1;
            g.globalAlpha = Math.min(1, b.life / 20);
            g.fillStyle = '#fff'; roundRect(x - wdt / 2, y - 16, wdt, 22, 8); g.fill();
            g.beginPath(); g.moveTo(x - 4, y + 6); g.lineTo(x + 4, y + 6); g.lineTo(x, y + 12); g.fill();
            g.fillStyle = b.color; g.fillText(b.text, x, y);
            g.globalAlpha = 1;
        }
        // 天気・日にち (左上に 小さく)
        if (day) {
            const label = `${Sim.C.weather[day.w].icon} ${day.temp}℃ ${day.label || ''}`;
            g.font = '13px "M PLUS Rounded 1c", sans-serif';
            const lw = g.measureText(label).width + 16;
            g.fillStyle = 'rgba(11,18,34,0.75)'; roundRect(8, 36, Math.max(112, lw), 26, 8); g.fill();
            g.fillStyle = '#fff'; g.textAlign = 'left';
            g.fillText(label, 16, 54);
            if (day.event) { g.fillStyle = 'rgba(160,30,60,0.85)'; roundRect(8, 66, Math.max(112, g.measureText(day.event).width + 16), 22, 8); g.fill(); g.fillStyle = '#fff'; g.fillText(day.event, 16, 82); }
        }
    }
    function roundRect(x, y, w, h, r) {
        g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }
    // しるし (!): out = 品切れ、soon = 品切れ しそう、expire = 期限が 近い
    function mark(x, y, kind) {
        const col = kind === 'expire' ? '#f0a020' : '#e04040';
        const bob = Math.sin(t / 8) * 2;
        g.fillStyle = col; g.beginPath(); g.arc(x, y + bob, 8, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText('!', x, y + 4 + bob);
    }
    // 棚 1 台: 種類の 色・商品の 絵・のこりの 量。空っぽは 空っぽに 見える。期限が 近いと 色 (緑 → 黄 → 赤。日持ちする 商品は 青)
    function drawUnit(c) {
        const p = c.p, [c1, c2] = SHELF_COLOR[p.type] || SHELF_COLOR.ambient;
        const x = c.x + 2, y = c.y + 2, w = c.w - 4, h = c.h - 4;
        g.fillStyle = c1; g.fillRect(x, y, w, h);
        g.fillStyle = c2; g.fillRect(x, c.row % 2 === 0 ? y + h - 4 : y, w, 4);
        const st = Sim.groupStock(s, p.id).filter(b => b.q > 0).sort((a, b) => b.age - a.age); // 種類を ぜんぶ (古い じゅん)
        const total = st.reduce((a, b) => a + b.q, 0);
        const units = Math.max(1, Sim.shelfUnits(s, p.id));
        const full = Math.min(1, total / Math.max(1, Sim.capOf(s, p)));
        // 商品の 山 (のこりの 量で へる)
        const slots = Math.max(2, Math.floor(w / 9));
        const show = Math.round(full * slots * 2);
        let col = p.shelf ? '#5bbf6a' : '#3d8fd6';
        if (p.shelf && st.length) { const left = p.shelf - st[0].age; col = left <= 1 ? '#e05a5a' : left === 2 ? '#f0c040' : '#5bbf6a'; }
        for (let i = 0; i < show; i++) { g.fillStyle = i % 2 ? col : shade(col); g.fillRect(x + 3 + (i % slots) * 9, y + 6 + Math.floor(i / slots) * 7, 7, 5); }
        g.font = `${Math.min(18, h * 0.4)}px sans-serif`; g.textAlign = 'center';
        g.globalAlpha = total ? 1 : 0.35;
        g.fillText(p.icon, x + w / 2, y + h - 7);
        g.globalAlpha = 1;
        if (!total) { g.fillStyle = 'rgba(120,40,40,0.75)'; g.font = '10px "M PLUS Rounded 1c", sans-serif'; g.fillText('から', x + w / 2, y + 14); }
        void units;
        if (live && live.marks && live.marks[p.id]) mark(x + w - 6, y + 4, live.marks[p.id]);
    }
    function shade(hex) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.round(v * 0.8)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
    function drawFacility(c) {
        const f = Sim.facility(c.id);
        const x = c.x + 2, y = c.y + 2, w = c.w - 4, h = c.h - 4;
        g.fillStyle = '#f7f3ea'; g.fillRect(x, y, w, h);
        g.strokeStyle = '#c8bfae'; g.strokeRect(x, y, w, h);
        if (c.id === 'smoke') { g.fillStyle = 'rgba(160,170,180,0.5)'; g.fillRect(x + 3, y + 3, w - 6, h - 6); }
        else if (c.id === 'parking') { g.fillStyle = '#5b6170'; g.fillRect(x + 3, y + 3, w - 6, h - 6); g.fillStyle = '#fff'; g.fillRect(x + w / 2 - 1, y + 5, 2, h - 10); }
        else if (c.id === 'eatin') { g.fillStyle = '#c9a77a'; g.fillRect(x + 4, y + h / 2 - 3, w - 8, 6); }
        g.font = `${Math.min(17, h * 0.4)}px sans-serif`; g.textAlign = 'center';
        g.fillText(f.icon, x + w / 2, y + h / 2 + 2);
        g.fillStyle = '#13203a'; g.font = '9px "M PLUS Rounded 1c", sans-serif';
        g.fillText(f.name.slice(0, Math.max(3, Math.floor(w / 9))), x + w / 2, y + h - 3);
        if (live && live.marks && live.marks[`fac:${c.id}`]) mark(x + w - 6, y + 4, live.marks[`fac:${c.id}`]);
    }
    // タップした ところの 棚・施設 (10 章)。cx, cy = 画面の 座標
    function hit(cx, cy) {
        if (!cv || !s) return null;
        const r = cv.getBoundingClientRect();
        const x = (cx - r.left) * W / r.width, y = (cy - r.top) * H / r.height;
        for (const c of cells()) if (c.kind !== 'empty' && x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) return { kind: c.kind, id: c.id };
        // レジ横の ケース
        const cases = Sim.C.products.filter(p => (p.cook || p.self) && Sim.available(s, p.id));
        for (let i = 0; i < cases.length; i++) if (x >= REG.x - 54 + i * 28 && x < REG.x - 28 + i * 28 && y >= REG.y - 30 && y < REG.y - 8) return { kind: 'shelf', id: cases[i].id };
        return null;
    }
    return { init, setState, setDay, setLive, say, playSlot, spawn, hit };
})();
