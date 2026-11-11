import '@testing-library/dom';
// Silence media element APIs that jsdom does not implement.
window.HTMLMediaElement.prototype.play = function play() { return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function pause() {};
window.HTMLMediaElement.prototype.load = function load() {};
if (!window.AudioContext) {
  window.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createGain() { return { gain: { value: 1, setTargetAtTime() {} }, connect() {}, }; }
    createBiquadFilter() { return { type: 'peaking', frequency: { value: 0 }, Q: { value: 0 }, gain: { value: 0, setTargetAtTime() {} }, connect() {} }; }
    createMediaElementSource() { return { connect() {} }; }
    createAnalyser() { return { fftSize: 512, smoothingTimeConstant: 0, frequencyBinCount: 256, connect() {}, getByteFrequencyData() {} }; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  };
}
let objectUrlCounter = 0;
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = () => `blob:shoso/${++objectUrlCounter}`;
}
if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = () => {};
}

if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
}
