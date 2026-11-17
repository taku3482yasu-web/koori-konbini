// お店の 中を 見下ろす 絵 (企画書: 棚・レジ・施設が ならび、スタッフと 客が 歩きまわる。客の 頭の 上に ひとこと)
const Scene = (() => {
    const W = 640, H = 340, T = 20;
    let cv, g, s = null, t = 0, busy = 0.2, bubbles = [], day = null;
    const walkers = [];
    const DOOR = { x: 320, y: 318 };
    const REG = { x: 70, y: 250 };
    // 棚 (商品の id と 場所)
    const SHELVES = [
        { ids: ['onigiri', 'bento'], x: 190, y: 120, w: 120 },
        { ids: ['bread', 'hotsnack'], x: 330, y: 120, w: 120 },
        { ids: ['snack', 'daily'], x: 190, y: 185, w: 120 },
        { ids: ['oden', 'coffee'], x: 330, y: 185, w: 120 }
    ];
    const FRIDGE = { ids: ['drink', 'ice'], x: 160, y: 46, w: 300 };
    const SLOT_POS = [{ x: 500, y: 44 }, { x: 570, y: 44 }, { x: 500, y: 128 }, { x: 570, y: 128 }, { x: 500, y: 212 }, { x: 570, y: 212 }];
    const FH = 76; // 施設の 絵の 高さ

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
        const sh = Math.random() < 0.3 ? FRIDGE : SHELVES[Math.floor(Math.random() * SHELVES.length)];
        const id = day && day.gold && Math.random() < 0.15 ? 'goldDog' : ids[Math.floor(Math.random() * ids.length)];
        walkers.push({ id, x: DOOR.x, y: H + 10, phase: 0, tx: sh.x + Math.random() * sh.w, ty: sh.y + (sh === FRIDGE ? 26 : 34), wait: 0, f: 0 });
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
        if (s) { g.textAlign = 'right'; const r = Sim.regionOf(s); g.fillText(`${r.icon} ${r.name}`, W - 12, 19); }
        // 外 (歩道) と 入り口
        g.fillStyle = '#b9b2a4'; g.fillRect(0, 300, W, H - 300);
        g.fillStyle = '#6d7a8c'; g.fillRect(0, 298, W, 4);
        g.fillStyle = '#9fd4f5'; g.fillRect(DOOR.x - 30, 296, 60, 8);
        // 冷蔵ケース
        drawShelf(FRIDGE, true);
        SHELVES.forEach(sh => drawShelf(sh, false));
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
            const spot = { register: (i) => [REG.x - 30 + i * 26, REG.y + 2], stock: (i) => [200 + i * 130, 170], check: (i) => [40 + i * 30, 104], cook: (i) => [REG.x + 120 + i * 24, REG.y + 2] };
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
            const free = Math.min(Sim.C.floor - Sim.floorUsed(s), Sim.C.maxFacilities - s.facilities.length);
            for (let i = s.facilities.length; i < s.facilities.length + free; i++) {
                const p = SLOT_POS[i];
                g.strokeStyle = 'rgba(0,0,0,0.18)'; g.setLineDash([4, 4]); g.strokeRect(p.x - 30, p.y, 60, FH); g.setLineDash([]);
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
    // 棚: 商品の 色で 期限が 分かる (新しい = 緑・そろそろ = 黄・今日まで = 赤)。日持ちする 商品は 青
    function drawShelf(sh, fridge) {
        g.fillStyle = fridge ? '#cfe9f7' : '#9aa6b8';
        g.fillRect(sh.x, sh.y, sh.w, fridge ? 22 : 26);
        g.fillStyle = fridge ? '#8fc6e6' : '#7a869a';
        g.fillRect(sh.x, sh.y + (fridge ? 18 : 22), sh.w, 4);
        const half = sh.w / sh.ids.length;
        sh.ids.forEach((id, k) => {
            const p = Sim.product(id);
            if (!s || !Sim.available(s, id)) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(sh.x + k * half + 4, sh.y + 4, half - 8, 12); return; }
            const units = Sim.shelfUnits(s, id);
            if (units > 1 && !p.cook && !p.self) { g.fillStyle = '#13203a'; g.font = '10px "M PLUS Rounded 1c", sans-serif'; g.textAlign = 'right'; g.fillText(`×${units}`, sh.x + (k + 1) * half - 2, sh.y - 2); }
            const st = s.stock[id] || [];
            const total = st.reduce((a, b) => a + b.q, 0);
            const full = Math.min(1, total / Math.max(1, p.shelf ? (s.orders[id] || 1) * 1.2 : Sim.capOf(s, p) * 0.5));
            const n = Math.round(full * 8);
            for (let i = 0; i < 8; i++) {
                let col = '#5b6b80';
                if (i < n) {
                    if (!p.shelf) col = fridge ? '#3d8fd6' : '#6aa0e8';
                    else {
                        const b = st[Math.min(st.length - 1, Math.floor(i / 8 * st.length))];
                        const left = b ? p.shelf - b.age : p.shelf;
                        col = left <= 1 ? '#e05a5a' : left === 2 ? '#f0c040' : '#5bbf6a';
                    }
                } else col = 'rgba(0,0,0,0.12)';
                g.fillStyle = col;
                g.fillRect(sh.x + k * half + 5 + i * (half - 10) / 8, sh.y + 5, (half - 10) / 8 - 2, 11);
            }
            g.font = '14px sans-serif'; g.textAlign = 'center';
            g.fillText(p.icon, sh.x + k * half + half / 2, sh.y + (fridge ? 38 : 42));
        });
    }
    function drawFacility(id, p) {
        const f = Sim.facility(id);
        g.fillStyle = '#f7f3ea'; g.fillRect(p.x - 30, p.y, 60, FH);
        g.strokeStyle = '#c8bfae'; g.strokeRect(p.x - 30, p.y, 60, FH);
        if (id === 'eatin') { g.fillStyle = '#c58a52'; g.fillRect(p.x - 22, p.y + 24, 44, 16); g.fillStyle = '#8a5a32'; [[-22, 44], [12, 44], [-22, 14], [12, 14]].forEach(([dx, dy]) => g.fillRect(p.x + dx, p.y + dy, 10, 7)); }
        else if (id === 'smoke') { g.fillStyle = 'rgba(160,170,180,0.5)'; g.fillRect(p.x - 28, p.y + 2, 56, FH - 4); }
        else if (id === 'parking') { g.fillStyle = '#5b6170'; g.fillRect(p.x - 28, p.y + 2, 56, FH - 4); g.fillStyle = '#fff'; g.fillRect(p.x - 1, p.y + 6, 2, FH - 12); }
        else if (id === 'atm') { g.fillStyle = '#3d8fd6'; g.fillRect(p.x - 12, p.y + 14, 24, 34); g.fillStyle = '#d8f1ff'; g.fillRect(p.x - 8, p.y + 20, 16, 9); }
        g.font = '22px sans-serif'; g.textAlign = 'center';
        g.fillText(f.icon, p.x, p.y + 42);
        g.fillStyle = '#13203a'; g.font = '11px "M PLUS Rounded 1c", sans-serif';
        g.fillText(f.name.slice(0, 7), p.x, p.y + FH - 6);
    }
    return { init, setState, setDay, say };
})();
