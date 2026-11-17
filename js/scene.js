// お店の 中を 見下ろす 絵 (企画書: 棚・レジ・施設が ならび、スタッフと 客が 歩きまわる。客の 頭の 上に ひとこと)
const Scene = (() => {
    const W = 640, H = 340, T = 20;
    let cv, g, s = null, t = 0, busy = 0.2, bubbles = [], day = null;
    const walkers = [];
    const DOOR = { x: 320, y: 318 };
    const REG = { x: 70, y: 250 };
    // 棚は 台数ぶん ならべる (2026-11-17: 棚の 種類・店の 大きさ)。10 列 × 3 段 (あいだは 通路)
    const SX = 150, SY = 42, CW = 32, CH = 66, UH = 38, COLS = 10, ROWS = 3;
    const SHELF_COLOR = { chilled: ['#cfe9f7', '#7fb8de'], drinkcase: ['#b8dcf5', '#4a90c8'], freezer: ['#eef8ff', '#8fc6e6'], ambient: ['#d8c6a4', '#a08a62'], goods: ['#e2d2ee', '#a58bc0'], rack: ['#efe0bc', '#b8a070'] };
    function units() {
        if (!s) return [];
        const out = [];
        for (const p of Sim.C.products) if (!p.cook && !p.self) for (let i = 0; i < Sim.shelfUnits(s, p.id); i++) out.push(p);
        return out.slice(0, COLS * ROWS).map((p, i) => ({ p, x: SX + (i % COLS) * CW, y: SY + Math.floor(i / COLS) * CH }));
    }
    // 施設は 右に 2 列 × 6 段
    const SLOT_POS = Array.from({ length: 12 }, (_, i) => ({ x: 516 + (i % 2) * 80, y: 38 + Math.floor(i / 2) * 43 }));
    const FH = 40; // 施設の 絵の 高さ

    function init(canvas) {
        cv = canvas;
        g = cv.getContext('2d');
        requestAnimationFrame(loop);
    }
    const setState = st => { s = st; };
    function setDay(d, b) { day = d; if (b !== undefined) busy = b; }
    // ひとこと (画面の どこかの 客の 上に 出す)
    function say(text, color) {
        const w = walkers.filter(x => x.phase > 0 && x.phase < 4);
        const who = w.length ? w[Math.floor(Math.random() * w.length)] : null;
        bubbles.push({ text, color: color || '#13203a', life: 110, who, x: who ? who.x : 200 + Math.random() * 200, y: who ? who.y : 200 });
    }

    function spawn() {
        const ids = ['yamamou', 'sasaki', 'kotani', 'shibata', 'ueno', 'ikekimu', 'furukawa', 'ishii', 'harigeneral', 'okagappa', 'hibikimakuri', 'hyougaryu'];
        const us = units();
        const u = us.length ? us[Math.floor(Math.random() * us.length)] : { x: 300, y: 150 };
        const id = day && day.gold && Math.random() < 0.15 ? 'goldDog' : ids[Math.floor(Math.random() * ids.length)];
        walkers.push({ id, x: DOOR.x, y: H + 10, phase: 0, tx: u.x + CW / 2, ty: u.y + UH + 22, wait: 0, f: 0 });
    }
    function step(w, tx, ty, v = 1.3) {
        const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy);
        if (d < v) { w.x = tx; w.y = ty; return true; }
        w.x += dx / d * v; w.y += dy / d * v; w.f += 0.15;
        return false;
    }
    function loop() {
        t++;
        if (Math.random() < busy * 0.07 && walkers.length < 16) spawn();
        for (const w of walkers) {
            if (w.phase === 0 && step(w, DOOR.x, DOOR.y - 20)) w.phase = 1;
            else if (w.phase === 1 && step(w, w.tx, w.ty)) { w.phase = 2; w.wait = 40 + Math.random() * 50; }
            else if (w.phase === 2 && --w.wait <= 0) w.phase = 3;
            else if (w.phase === 3 && step(w, REG.x + 70 + Math.random() * 4, REG.y + 26)) { w.phase = 4; w.wait = 30; }
            else if (w.phase === 4 && --w.wait <= 0) w.phase = 5;
            else if (w.phase === 5 && step(w, DOOR.x, H + 20)) w.dead = true;
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
        for (let y = 30; y < 300; y += T) for (let x = (y / T) % 2 ? T : 0; x < W; x += T * 2) g.fillRect(x, y, T, T);
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
        // 棚 (種類ごとの 色)
        for (const u of units()) drawUnit(u);
        // レジ横の ケース (コーヒー・ホットスナック・おでん・中華まん)
        if (s) Sim.C.products.filter(p => (p.cook || p.self) && Sim.available(s, p.id)).forEach((p, i) => {
            g.fillStyle = '#f2e6d0'; g.fillRect(REG.x + 128 + i * 30, REG.y - 4, 26, 22);
            g.font = '15px sans-serif'; g.textAlign = 'center'; g.fillText(p.icon, REG.x + 141 + i * 30, REG.y + 13);
        });
        // レジ
        g.fillStyle = '#8a6a48'; g.fillRect(REG.x - 50, REG.y, 160, 22);
        g.fillStyle = '#c9a77a'; g.fillRect(REG.x - 50, REG.y, 160, 6);
        g.fillStyle = '#2b3a4f'; g.fillRect(REG.x + 74, REG.y - 8, 18, 12);
        // スタッフ (店に いる 人は レジの うしろ)
        if (s) {
            // 倉庫 (左上)。箱の 数で 在庫が 分かる
            const used = Sim.wareUse(s) / Sim.wareCap(s);
            g.fillStyle = '#cdbf9f'; g.fillRect(10, 36, 120, 120);
            g.fillStyle = '#8a7a5a'; g.fillRect(10, 36, 120, 4);
            g.fillStyle = '#5a4a32'; g.font = '11px "M PLUS Rounded 1c", sans-serif'; g.textAlign = 'left';
            g.fillText(`倉庫 ${Math.round(used * 100)}%`, 16, 150);
            const boxes = Math.round(used * 24);
            for (let i = 0; i < boxes; i++) { g.fillStyle = i % 3 ? '#c8945a' : '#b07a42'; g.fillRect(18 + (i % 6) * 18, 112 - Math.floor(i / 6) * 18, 15, 15); g.fillStyle = '#e8c88a'; g.fillRect(18 + (i % 6) * 18 + 6, 112 - Math.floor(i / 6) * 18, 3, 15); }
            // スタッフは 持ち場の 場所に 立つ
            const spot = { register: (i) => [REG.x - 30 + i * 26, REG.y + 2], stock: (i) => [190 + i * 110, 104 + (i % 2) * 66], check: (i) => [40 + i * 30, 104], cook: (i) => [REG.x + 140 + i * 30, REG.y + 40] };
            const count = {};
            s.staff.filter(m => m.job === 'shop' && m.slots.some(Boolean)).forEach((m, k) => {
                const role = m.role || 'register';
                const i = count[role] = (count[role] || 0) + 1;
                const [x, y] = spot[role](i - 1);
                const sway = role === 'stock' ? Math.sin((t + k * 40) / 50) * 40 : 0;
                Art.draw(g, Sim.staffDef(m.id).art, x + sway, y, { height: 30, frame: Math.floor((t + k * 13) / 28) });
            });
            // 施設
            s.facilities.forEach((id, i) => drawFacility(id, SLOT_POS[i]));
            const free = Math.min(Sim.floorCap(s) - Sim.floorUsed(s), Sim.facCap(s) - s.facilities.length);
            for (let i = s.facilities.length; i < s.facilities.length + free; i++) {
                const p = SLOT_POS[i];
                g.strokeStyle = 'rgba(0,0,0,0.18)'; g.setLineDash([4, 4]); g.strokeRect(p.x - 36, p.y, 72, FH); g.setLineDash([]);
            }
            // おにおにが 居座り
            if (s.occupy) { Art.draw(g, 'onioni', DOOR.x + 60, 300, { height: 44, frame: Math.floor(t / 20) }); }
        }
        // 客
        for (const w of [...walkers].sort((a, b) => a.y - b.y)) Art.draw(g, w.id, w.x, w.y, { height: 28, frame: Math.floor(w.f) });
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
        // 天気 (左上に 小さく)
        if (day) {
            g.fillStyle = 'rgba(11,18,34,0.7)'; roundRect(8, 36, 112, 26, 8); g.fill();
            g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = '13px "M PLUS Rounded 1c", sans-serif';
            g.fillText(`${Sim.C.weather[day.w].icon} ${day.temp}℃ ${day.label || ''}`, 16, 54);
        }
    }
    function roundRect(x, y, w, h, r) {
        g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }
    // 棚 1 台: 種類の 色・商品の 絵・のこりの 量 (新しい = 緑・そろそろ = 黄・今日まで = 赤。日持ちする 商品は 青)
    function drawUnit(u) {
        const p = u.p, [c1, c2] = SHELF_COLOR[p.type] || SHELF_COLOR.ambient;
        g.fillStyle = c1; g.fillRect(u.x + 1, u.y + 1, CW - 3, UH - 2);
        g.fillStyle = c2; g.fillRect(u.x + 1, u.y + UH - 5, CW - 3, 4);
        const st = s.stock[p.id] || [];
        const total = st.reduce((a, b) => a + b.q, 0);
        const full = Math.min(1, total / Math.max(1, Sim.capOf(s, p)));
        let col = p.shelf ? '#5bbf6a' : '#3d8fd6';
        if (p.shelf && st.length) { const left = p.shelf - st[0].age; col = left <= 1 ? '#e05a5a' : left === 2 ? '#f0c040' : '#5bbf6a'; }
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(u.x + 3, u.y + 4, CW - 7, 5);
        g.fillStyle = col; g.fillRect(u.x + 3, u.y + 4, (CW - 7) * full, 5);
        g.font = '15px sans-serif'; g.textAlign = 'center';
        g.fillText(p.icon, u.x + CW / 2 - 1, u.y + 28);
    }
    function drawFacility(id, p) {
        const f = Sim.facility(id);
        g.fillStyle = '#f7f3ea'; g.fillRect(p.x - 36, p.y, 72, FH);
        g.strokeStyle = '#c8bfae'; g.strokeRect(p.x - 36, p.y, 72, FH);
        if (id === 'smoke') { g.fillStyle = 'rgba(160,170,180,0.5)'; g.fillRect(p.x - 28, p.y + 2, 56, FH - 4); }
        else if (id === 'parking') { g.fillStyle = '#5b6170'; g.fillRect(p.x - 28, p.y + 2, 56, FH - 4); g.fillStyle = '#fff'; g.fillRect(p.x - 1, p.y + 4, 2, FH - 8); }
        g.font = '17px sans-serif'; g.textAlign = 'center';
        g.fillText(f.icon, p.x, p.y + 22);
        g.fillStyle = '#13203a'; g.font = '10px "M PLUS Rounded 1c", sans-serif';
        g.fillText(f.name.slice(0, 7), p.x, p.y + FH - 4);
    }
    return { init, setState, setDay, say };
})();
