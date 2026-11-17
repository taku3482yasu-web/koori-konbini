// お店の 絵 (canvas)。店長 こおりくんと、来店する シリーズの キャラ
const Scene = (() => {
    let cv, g, state = null, day = null, busy = 0.25, t = 0;
    const W = 640, H = 260, GROUND = 214;
    const walkers = [];
    let drops = [];

    function init(canvas) {
        cv = canvas;
        g = cv.getContext('2d');
        for (let i = 0; i < 90; i++) drops.push({ x: Math.random() * W, y: Math.random() * H, v: 0.6 + Math.random() * 0.6 });
        requestAnimationFrame(loop);
    }
    const setState = s => { state = s; };
    // day = { w: 天気, temp, month } / busy = 0〜1 (お客さんの 多さ)
    function setDay(d, b) { day = d; if (b !== undefined) busy = b; }

    function spawn() {
        const ids = CONFIG.guests;
        const fromLeft = Math.random() < 0.5;
        walkers.push({ id: ids[Math.floor(Math.random() * ids.length)], x: fromLeft ? -20 : W + 20, dir: fromLeft ? 1 : -1, v: 0.7 + Math.random() * 0.5, enter: Math.random() < 0.7, phase: 0, wait: 0, f: Math.random() * 10 });
    }

    function loop() {
        t++;
        if (Math.random() < busy * 0.06 && walkers.length < 14) spawn();
        for (const w of walkers) {
            w.f += 0.12;
            if (w.phase === 0) {
                w.x += w.v * w.dir;
                if (w.enter && Math.abs(w.x - DOOR) < 2) { w.phase = 1; w.wait = 50 + Math.random() * 60; }
            } else if (w.phase === 1) { if (--w.wait <= 0) { w.phase = 2; } }
            else w.x += w.v * w.dir;
        }
        for (let i = walkers.length - 1; i >= 0; i--) if (walkers[i].x < -40 || walkers[i].x > W + 40) walkers.splice(i, 1);
        draw();
        requestAnimationFrame(loop);
    }

    const DOOR = 330;
    function draw() {
        const w = day ? day.w : 'sun';
        const month = day ? day.month : 4;
        // 空
        const sky = { sun: ['#7fc8ff', '#d8f1ff'], cloud: ['#9fb4c8', '#dfe7ef'], rain: ['#5c6f86', '#a9b7c6'], typhoon: ['#2e3a4c', '#58687c'], snow: ['#b6c4d6', '#eef3fa'] }[w];
        const sg = g.createLinearGradient(0, 0, 0, GROUND);
        sg.addColorStop(0, sky[0]); sg.addColorStop(1, sky[1]);
        g.fillStyle = sg;
        g.fillRect(0, 0, W, H);
        if (w === 'sun') { g.fillStyle = '#ffe680'; g.beginPath(); g.arc(560, 40, 22, 0, Math.PI * 2); g.fill(); }
        // 遠くの 街
        g.fillStyle = 'rgba(40,60,100,0.25)';
        [[0, 90, 60], [70, 70, 50], [130, 110, 40], [480, 80, 70], [560, 60, 80]].forEach(([x, y, ww]) => g.fillRect(x, y, ww, GROUND - y));
        // 季節の 木
        const leaf = month >= 3 && month <= 4 ? '#ffb7d0' : month >= 10 && month <= 11 ? '#e8823c' : month === 12 || month <= 2 ? '#c9d6e0' : '#4fae5a';
        for (const x of [60, 600]) {
            g.fillStyle = '#6b4a2e'; g.fillRect(x - 4, 150, 8, GROUND - 150);
            g.fillStyle = leaf; g.beginPath(); g.arc(x, 140, 28, 0, Math.PI * 2); g.fill();
        }
        // 歩道
        g.fillStyle = '#c9c3b8'; g.fillRect(0, GROUND, W, H - GROUND);
        for (let x = 0; x < W; x += 40) { g.fillStyle = '#bab3a6'; g.fillRect(x, GROUND, 2, H - GROUND); }
        if (state && state.upgrades.parking) {
            g.fillStyle = '#5b6170'; g.fillRect(470, GROUND - 4, 170, 6);
            drawCar(560, GROUND);
        }
        drawStore();
        // こおりくん (店長) は 入り口の よこ
        Art.draw(g, 'koori', DOOR + 52, GROUND + 2, { height: 46, frame: Math.floor(t / 30) });
        // お客さん
        for (const p of walkers) {
            if (p.phase === 1) continue; // お店の 中
            Art.draw(g, p.id, p.x, GROUND + 4 + (p.dir > 0 ? 0 : 10), { height: 40, flip: p.dir < 0, frame: Math.floor(p.f) });
        }
        // 天気
        if (w === 'rain' || w === 'typhoon') {
            g.strokeStyle = 'rgba(220,235,255,0.55)';
            g.lineWidth = 1;
            const slant = w === 'typhoon' ? 9 : 2;
            g.beginPath();
            for (const d of drops) { d.y += 9 * d.v; d.x += slant * 0.6; if (d.y > H) { d.y = -10; d.x = Math.random() * W; } g.moveTo(d.x, d.y); g.lineTo(d.x + slant, d.y + 12); }
            g.stroke();
        }
        if (w === 'snow') {
            g.fillStyle = 'rgba(255,255,255,0.9)';
            for (const d of drops) { d.y += 1.2 * d.v; d.x += Math.sin((t + d.y) / 30) * 0.4; if (d.y > H) { d.y = -5; d.x = Math.random() * W; } g.fillRect(d.x, d.y, 3, 3); }
        }
    }

    function drawStore() {
        const x0 = 170, x1 = 470, top = 70;
        g.fillStyle = '#f4f7fb'; g.fillRect(x0, top, x1 - x0, GROUND - top);
        // 氷いろの 帯 (こおりマートの 色)
        g.fillStyle = '#3d8fd6'; g.fillRect(x0, top + 30, x1 - x0, 8);
        g.fillStyle = '#8fdcff'; g.fillRect(x0, top + 38, x1 - x0, 6);
        g.fillStyle = '#ffd75e'; g.fillRect(x0, top + 44, x1 - x0, 3);
        // 看板
        const led = state && state.upgrades.kanban;
        g.fillStyle = led ? '#ffffff' : '#e8eef6';
        g.fillRect(x0 + 10, top + 4, x1 - x0 - 20, 24);
        if (led) { g.shadowColor = '#8fdcff'; g.shadowBlur = 14; }
        g.fillStyle = '#1b3566';
        g.font = '15px "DotGothic16", monospace';
        g.textAlign = 'center';
        g.fillText(state ? state.name : CONFIG.defaultName, (x0 + x1) / 2, top + 21);
        g.shadowBlur = 0;
        // 窓 (中に 棚)
        g.fillStyle = '#bfe6ff'; g.fillRect(x0 + 12, top + 56, 128, GROUND - top - 70);
        g.fillStyle = '#bfe6ff'; g.fillRect(DOOR + 72, top + 56, x1 - DOOR - 84, GROUND - top - 70);
        g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x0 + 20, top + 60, 10, GROUND - top - 80);
        const colors = ['#ff8a8a', '#ffd75e', '#8fd18f', '#8fb8ff', '#f7a8e0'];
        for (let r = 0; r < 3; r++) {
            g.fillStyle = '#8a95a8'; g.fillRect(x0 + 16, top + 78 + r * 22, 120, 3);
            for (let i = 0; i < 12; i++) { g.fillStyle = colors[(i + r) % colors.length]; g.fillRect(x0 + 18 + i * 10, top + 68 + r * 22, 7, 10); }
        }
        // 設備の 見た目
        if (state && state.upgrades.atm) { g.fillStyle = '#3d8fd6'; g.fillRect(DOOR + 80, top + 74, 22, 40); g.fillStyle = '#d8f1ff'; g.fillRect(DOOR + 84, top + 80, 14, 9); }
        if (state && state.upgrades.eatin) { g.fillStyle = '#c58a52'; g.fillRect(DOOR + 108, top + 100, 26, 4); g.fillRect(DOOR + 112, top + 104, 3, 16); g.fillRect(DOOR + 127, top + 104, 3, 16); }
        if (state && state.upgrades.coffee) { g.fillStyle = '#5a3b26'; g.fillRect(x0 + 112, top + 120, 20, 22); g.fillStyle = '#ffd75e'; g.fillRect(x0 + 116, top + 124, 12, 4); }
        if (state && state.upgrades.oden && day && day.month >= 10 || state && state.upgrades.oden && day && day.month <= 3) { g.fillStyle = '#c0a060'; g.fillRect(x0 + 80, top + 128, 26, 12); }
        // 入り口
        g.fillStyle = '#9fd4f5'; g.fillRect(DOOR - 24, top + 60, 48, GROUND - top - 60);
        g.fillStyle = '#5d6f86'; g.fillRect(DOOR - 1, top + 60, 2, GROUND - top - 60);
        // のぼり (行事の 週)
        if (day && day.event) {
            g.fillStyle = '#e04a4a'; g.fillRect(x0 - 26, 120, 18, 76);
            g.fillStyle = '#5d4a3a'; g.fillRect(x0 - 28, 116, 2, 98);
            g.fillStyle = '#fff'; g.font = '12px "DotGothic16", monospace';
            [...day.event.slice(0, 5)].forEach((ch, i) => g.fillText(ch, x0 - 17, 136 + i * 14));
        }
    }
    function drawCar(x, y) {
        g.fillStyle = '#e05a5a'; g.fillRect(x - 34, y - 24, 68, 16); g.fillRect(x - 20, y - 36, 40, 14);
        g.fillStyle = '#bfe6ff'; g.fillRect(x - 16, y - 33, 14, 10); g.fillRect(x + 2, y - 33, 14, 10);
        g.fillStyle = '#222'; g.beginPath(); g.arc(x - 20, y - 6, 7, 0, 7); g.arc(x + 20, y - 6, 7, 0, 7); g.fill();
    }
    return { init, setState, setDay };
})();
