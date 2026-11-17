// 音 (2026-11-17 ユーザー指定: 指示書 その1 の 4 章)
// 効果音は ぜんぶ 合成 (Web Audio)。BGM は ほかの こおりくんシリーズと 同じく「sounds/bgm/<場面>.mp3 が あれば それ、なければ 合成の 曲」。
// 場面: day (通常の 昼) / night (夜) / report (まとめ) / bank (月末の 返済) / ending (エンディング)
// 曲は 8分音符 単位の 音名の 並び ('.' は 休符)。メロディ (矩形波) と ベース (三角波)
const Sound = (() => {
    const KEY = 'koori-konbini-sound';
    const TRACKS = {
        // 昼: のんびり した お店の 曲
        day: { bpm: 120, melody: ['C5', 'E5', 'G5', 'E5', 'F5', 'A5', 'G5', '.', 'E5', 'D5', 'C5', 'D5', 'E5', '.', 'G4', '.', 'A4', 'C5', 'F5', 'E5', 'D5', 'C5', 'D5', '.', 'G5', 'F5', 'E5', 'D5', 'C5', '.', '.', '.'],
            bass: ['C3', '.', 'G3', '.', 'F2', '.', 'C3', '.', 'A2', '.', 'E3', '.', 'G2', '.', 'D3', '.', 'F2', '.', 'C3', '.', 'G2', '.', 'D3', '.', 'G2', '.', 'B2', '.', 'C3', '.', 'G2', '.'] },
        // 夜: しずかな 曲
        night: { bpm: 92, melody: ['A4', '.', 'C5', '.', 'E5', '.', 'D5', 'C5', 'B4', '.', '.', '.', 'G4', '.', 'B4', '.', 'A4', '.', 'C5', '.', 'F5', '.', 'E5', 'D5', 'E5', '.', '.', '.', '.', '.', '.', '.'],
            bass: ['A2', '.', '.', '.', 'E2', '.', '.', '.', 'G2', '.', '.', '.', 'E2', '.', '.', '.', 'F2', '.', '.', '.', 'D2', '.', '.', '.', 'E2', '.', '.', '.', 'A2', '.', '.', '.'] },
        // まとめ: 1 週間 おつかれさま
        report: { bpm: 108, melody: ['G4', 'C5', 'E5', 'G5', '.', 'E5', 'G5', '.', 'A5', 'G5', 'F5', 'E5', 'D5', '.', '.', '.', 'F4', 'A4', 'D5', 'F5', '.', 'D5', 'F5', '.', 'G5', 'F5', 'E5', 'D5', 'C5', '.', '.', '.'],
            bass: ['C3', 'G3', 'C3', 'G3', 'A2', 'E3', 'A2', 'E3', 'F2', 'C3', 'F2', 'C3', 'G2', 'D3', 'G2', 'D3', 'D3', 'A3', 'D3', 'A3', 'B2', 'F3', 'B2', 'F3', 'G2', 'D3', 'G2', 'D3', 'C3', 'G3', 'C3', '.'] },
        // 月末の 返済: おにおにが 取り立てに 来る
        bank: { bpm: 132, melody: ['E4', 'E4', '.', 'E4', 'F4', '.', 'E4', '.', 'D#4', '.', 'E4', '.', 'B3', '.', '.', '.', 'E4', 'E4', '.', 'E4', 'G4', '.', 'F4', '.', 'E4', '.', 'D#4', '.', 'E4', '.', '.', '.'],
            bass: ['E2', 'E2', 'E3', 'E2', 'E2', 'E3', 'E2', 'E3', 'B1', 'B1', 'B2', 'B1', 'B1', 'B2', 'B1', 'B2', 'E2', 'E2', 'E3', 'E2', 'C2', 'C3', 'C2', 'C3', 'B1', 'B2', 'B1', 'B2', 'E2', 'E3', 'E2', '.'] },
        // エンディング
        ending: { bpm: 100, melody: ['C5', '.', 'D5', 'E5', 'G5', '.', 'E5', '.', 'F5', '.', 'E5', 'D5', 'C5', '.', '.', '.', 'A4', '.', 'C5', 'D5', 'E5', '.', 'C5', '.', 'D5', '.', 'G4', 'B4', 'C5', '.', '.', '.'],
            bass: ['C3', 'G3', 'E3', 'G3', 'A2', 'E3', 'C3', 'E3', 'F2', 'C3', 'A2', 'C3', 'G2', 'D3', 'B2', 'D3', 'F2', 'C3', 'A2', 'C3', 'E2', 'B2', 'G2', 'B2', 'G2', 'D3', 'F3', 'D3', 'C3', 'G3', 'C3', '.'] }
    };
    const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    const freq = n => { const m = /^([A-G]#?)(\d)$/.exec(n); return 440 * Math.pow(2, ((Number(m[2]) + 1) * 12 + NOTE[m[1]] - 69) / 12); };
    let ctx = null, seBus = null, bgmBus = null, track = null, step = 0, next = 0, timer = null;
    let st = { vol: 0.6, mute: false };
    try { st = { ...st, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch (e) { /* なし */ }
    const files = {};
    function saveSt() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* なし */ } }

    // さいしょに 画面を さわった ときに 音を 出せる ように する (ブラウザの きまり)
    function unlock() {
        if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        seBus = ctx.createGain(); seBus.connect(ctx.destination);
        bgmBus = ctx.createGain(); bgmBus.connect(ctx.destination);
        apply();
        timer = setInterval(schedule, 25);
        if (track) play(track, true);
    }
    function apply() {
        const v = st.mute ? 0 : st.vol;
        if (seBus) seBus.gain.value = v * 0.5;
        if (bgmBus) bgmBus.gain.setTargetAtTime(fileOn() ? 0 : v * 0.1, ctx.currentTime, 0.03);
        for (const [name, f] of Object.entries(files)) {
            if (name === track && !f.failed && ctx && !st.mute) { f.audio.volume = Math.min(1, v * 0.8); if (f.audio.paused) f.audio.play().catch(() => { /* まだ */ }); }
            else if (!f.audio.paused) f.audio.pause();
        }
    }
    const fileOn = () => !!(track && files[track] && !files[track].failed && files[track].ready);
    function fileOf(name) {
        if (files[name] || typeof Audio === 'undefined') return files[name];
        const a = new Audio(), f = { audio: a, failed: false, ready: false };
        a.loop = true; a.preload = 'auto';
        a.addEventListener('error', () => { f.failed = true; apply(); });
        a.addEventListener('canplay', () => { f.ready = true; apply(); });
        a.src = `sounds/bgm/${name}.mp3`;
        files[name] = f;
        return f;
    }
    // 場面の 曲に かえる
    function play(name, force) {
        if (!TRACKS[name] || (name === track && !force)) return;
        track = name; step = 0;
        fileOf(name);
        if (ctx) { next = ctx.currentTime + 0.08; apply(); }
    }
    function schedule() {
        if (!ctx || !track || fileOn() || st.mute) return;
        const tr = TRACKS[track], dur = 60 / tr.bpm / 2;
        while (next < ctx.currentTime + 0.15) {
            const i = step % tr.melody.length;
            if (tr.melody[i] !== '.') tone(tr.melody[i], next, dur * 0.9, 'square', 0.5, bgmBus);
            if (tr.bass[i] !== '.') tone(tr.bass[i], next, dur * 0.95, 'triangle', 0.9, bgmBus);
            next += dur; step++;
        }
    }
    function tone(n, at, dur, type, vol, bus) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = typeof n === 'number' ? n : freq(n);
        g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
        o.connect(g); g.connect(bus || seBus); o.start(at); o.stop(at + dur + 0.02);
    }
    // ----- 効果音 (合成) -----
    const SE = {
        beep: () => { const t = ctx.currentTime; tone(1980, t, 0.08, 'square', 0.25); },                                    // レジの ピッ
        stock: () => { const t = ctx.currentTime; tone(220, t, 0.06, 'triangle', 0.5); tone(330, t + 0.07, 0.06, 'triangle', 0.4); }, // 品出し (トン トン)
        chime: () => { const t = ctx.currentTime; ['E5', 'C5', 'D5', 'G4', '.', 'G4', 'D5', 'E5', 'C5'].forEach((n, i) => { if (n !== '.') tone(n, t + i * 0.18, 0.32, 'sine', 0.35); }); }, // 入店の チャイム
        coin: () => { const t = ctx.currentTime; tone('B5', t, 0.07, 'square', 0.25); tone('E6', t + 0.07, 0.3, 'square', 0.25); },       // お金が 増える
        rankup: () => { const t = ctx.currentTime; ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(n, t + i * 0.09, i === 3 ? 0.4 : 0.12, 'square', 0.25)); }, // ランキングが 上がった
        onioni: () => { const t = ctx.currentTime; ['E3', 'D#3', 'D3', 'C#3'].forEach((n, i) => tone(n, t + i * 0.16, 0.2, 'sawtooth', 0.22)); tone('A1', t + 0.7, 0.5, 'sawtooth', 0.3); }, // おにおにの 取り立て
        click: () => { tone(880, ctx.currentTime, 0.03, 'square', 0.12); },
        alert: () => { const t = ctx.currentTime; tone('A5', t, 0.1, 'square', 0.2); tone('A5', t + 0.14, 0.1, 'square', 0.2); }
    };
    function se(name) { if (!ctx || st.mute || !SE[name]) return; try { SE[name](); } catch (e) { /* なし */ } }
    function setVol(v) { st.vol = Math.max(0, Math.min(1, v)); saveSt(); if (ctx) apply(); }
    function setMute(m) { st.mute = !!m; saveSt(); if (ctx) apply(); }
    ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, unlock, { once: false, passive: true }));
    return { play, se, setVol, setMute, get vol() { return st.vol; }, get mute() { return st.mute; }, tracks: Object.keys(TRACKS) };
})();
