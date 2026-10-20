const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function app({ failFrame = false, failModel = false } = {}) {
    const elements = new Map();
    let requests = 0;
    let stopped = 0;
    let frames = 0;
    const context2d = new Proxy({}, { get: () => () => {} });
    const element = id => {
        if (!elements.has(id)) elements.set(id, {
            innerText: '', textContent: '', classList: { add() {}, remove() {} },
            getContext: () => context2d, play: async () => {},
            videoWidth: 640, videoHeight: 480, readyState: 2
        });
        return elements.get(id);
    };
    const context = vm.createContext({
        document: { getElementById: element }, window: {}, console: { error() {} },
        navigator: { mediaDevices: { getUserMedia: async () => {
            requests++;
            return { getTracks: () => [{ stop() { stopped++; } }] };
        } } },
        performance: { now: () => 1 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
        Hands: class {
            setOptions() {} onResults() {}
            async initialize() { if (failModel) throw Error('model unavailable'); }
            async send() { frames++; if (failFrame) throw Error('processing failed'); }
        }
    });
    const html = fs.readFileSync('index.html', 'utf8');
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map(match => match[1]).find(code => code.includes('let webcamActive'));
    vm.runInContext(script, context);
    return { run: code => vm.runInContext(code, context), element,
        counts: () => ({ requests, stopped, frames }) };
}

test('one camera stream processes frames and stops on toggle', async () => {
    const a = app();
    await a.run('toggleWebcam()');
    await a.run('processCameraFrame()');
    assert.deepEqual(a.counts(), { requests: 1, stopped: 0, frames: 1 });
    await a.run('toggleWebcam()');
    assert.equal(a.counts().stopped, 1);
    assert.equal(a.run('webcamActive'), false);
});

test('hand results draw without external helpers and distinguish an unknown sign', async () => {
    const a = app();
    await a.run('toggleWebcam()');
    a.run(`classifyGesture = () => 'UNKNOWN';
        onHandResults({multiHandLandmarks: [Array.from({length: 21}, () => ({x: .5, y: .5}))]})`);
    assert.equal(a.element('floating-gesture').innerText, 'Hand detected');
    a.run('onHandResults({multiHandLandmarks: []})');
    assert.equal(a.element('floating-gesture').innerText, 'No Hand');
});

test('both hands are drawn and the count follows two, one, and no hands', async () => {
    const a = app();
    await a.run('toggleWebcam()');
    a.run(`
        let drawnHands = [];
        const originalDrawHand = drawHand;
        drawHand = landmarks => { drawnHands.push(landmarks); originalDrawHand(landmarks); };
        const firstHand = Array.from({length: 21}, () => ({x: .25, y: .5}));
        const secondHand = Array.from({length: 21}, () => ({x: .75, y: .5}));
        onHandResults({multiHandLandmarks: [firstHand, secondHand]});
    `);
    assert.equal(a.run('drawnHands.length'), 2);
    assert.equal(a.run('drawnHands[0] === firstHand && drawnHands[1] === secondHand'), true);
    assert.equal(a.element('landmarks-status').innerText, 'Landmarks: 2 hands detected');
    a.run('drawnHands = []; onHandResults({multiHandLandmarks: [secondHand]})');
    assert.equal(a.run('drawnHands.length'), 1);
    assert.equal(a.run('drawnHands[0] === secondHand'), true);
    assert.equal(a.element('landmarks-status').innerText, 'Landmarks: 1 hand detected');
    a.run('drawnHands = []; onHandResults({multiHandLandmarks: []})');
    assert.equal(a.run('drawnHands.length'), 0);
    assert.match(a.element('landmarks-status').innerText, /Show your whole hand/);
});

test('processing failure releases the camera and exposes retry status', async () => {
    const a = app({ failFrame: true });
    await a.run('toggleWebcam()');
    await a.run('processCameraFrame()');
    assert.equal(a.counts().stopped, 1);
    assert.equal(a.run('webcamActive'), false);
    assert.match(a.element('ai-model-status').textContent, /Restart the camera/);
});

test('model loading failure does not open the camera or claim readiness', async () => {
    const a = app({ failModel: true });
    await a.run('toggleWebcam()');
    assert.equal(a.counts().requests, 0);
    assert.equal(a.run('modelReady'), null);
    assert.match(a.element('ai-model-status').textContent, /unavailable/);
});

// Synthetic palm-facing landmarks exercise geometric invariance, not real-world accuracy.
function shape(extended, thumb = false, spread = .12) {
    const lm = Array.from({length: 21}, () => ({x: .5, y: .75}));
    lm[0] = {x: .5, y: .9};
    for (let f = 0; f < 4; f++) {
        const base = 5 + f * 4;
        const x = .35 + f * .1;
        lm[base] = {x, y: .65};
        lm[base+1] = {x, y: .5};
        lm[base+2] = {x, y: extended[f] ? .38 : .62};
        lm[base+3] = {x: x + (f === 1 && extended[f] ? spread - .1 : 0), y: extended[f] ? .25 : .75};
    }
    lm[1] = {x: .3, y: .8}; lm[2] = {x: .25, y: .7}; lm[3] = {x: .22, y: .6};
    lm[4] = thumb ? {x: .1, y: .6} : {x: .42, y: .7};
    return lm;
}

test('new shapes survive mirroring, rotation, and scaling', () => {
    const a = app();
    for (const [expected, fingers, thumb] of [
        ['B', [1,1,1,1], false], ['OPEN PALM', [1,1,1,1], true],
        ['L', [1,0,0,0], true], ['I', [0,0,0,1], false],
        ['Y', [0,0,0,1], true], ['I LOVE YOU', [1,0,0,1], true],
        ['W', [1,1,1,0], false], ['V', [1,1,0,0], false]
    ]) {
        const points = shape(fingers, thumb);
        for (const transformed of [points, points.map(p => ({x: 1-p.x, y:p.y})),
            points.map(p => ({x: .5 - (p.y-.5)*.75, y: .5 + (p.x-.5)*4/3})),
            points.map(p => ({x: .2+p.x*.6, y:.2+p.y*.6}))]) {
            assert.equal(a.run(`classifyGesture(${JSON.stringify(transformed)})`), expected);
        }
    }
    assert.equal(a.run('classifyGesture([])'), 'UNKNOWN');
    assert.equal(a.run('classifyGesture(Array.from({length:21},()=>({x:.5,y:.5})))'), 'UNKNOWN');
});

test('a held sign adds once and a deliberate release allows a repeat', async () => {
    const a = app();
    await a.run('toggleWebcam()');
    a.run(`let testTime = 0; performance.now = () => testTime;
        classifyGesture = () => 'L';
        const result = {multiHandLandmarks: [Array.from({length:21},()=>({x:.5,y:.5}))]};
        onHandResults(result); testTime=650; onHandResults(result);
        testTime=2000; onHandResults(result);`);
    assert.equal(a.run('translatedWords.join()'), 'L');
    a.run(`testTime=2100; onHandResults({multiHandLandmarks:[]});
        testTime=2500; onHandResults({multiHandLandmarks:[]});
        testTime=2600; onHandResults(result); testTime=3300; onHandResults(result);`);
    assert.equal(a.run('translatedWords.join()'), 'L,L');
});


test('A, D, F, and U have distinct geometric paths', () => {
    const a = app();
    const cases = [];
    const fist = shape([0,0,0,0]); fist[4] = {x:.32,y:.67}; cases.push(['A', fist]);
    cases.push(['D', shape([1,0,0,0])]);
    cases.push(['U', shape([1,1,0,0], false, .03)]);
    const pinch = shape([0,1,1,1]); pinch[8] = {...pinch[4]}; cases.push(['F', pinch]);
    for (const [expected, points] of cases) {
        assert.equal(a.run(`classifyGesture(${JSON.stringify(points)})`), expected);
        assert.equal(a.run(`classifyGesture(${JSON.stringify(points.map(p => ({x:1-p.x,y:p.y})))})`), expected);
    }
});
