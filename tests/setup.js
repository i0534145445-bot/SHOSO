import '@testing-library/dom';
// Silence media element APIs that jsdom does not implement.
window.HTMLMediaElement.prototype.play = function play() { return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function pause() {};
window.HTMLMediaElement.prototype.load = function load() {};
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
if (!window.speechSynthesis) {
  window.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [] };
}
