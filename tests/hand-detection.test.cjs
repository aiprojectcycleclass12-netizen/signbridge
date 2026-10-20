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
