// audioThread.js
const { parentPort } = require('worker_threads');

let isVoiceActive = false;

parentPort.on('message', (message) => {
  if (message.type === 'voiceStatus') {
    isVoiceActive = message.isActive;
    parentPort.postMessage({ type: 'voiceStatus', isActive: isVoiceActive });
  }
});

console.log('[Audio Thread] Voice activity detection initialized');