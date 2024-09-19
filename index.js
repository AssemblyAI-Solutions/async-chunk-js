// index.js
const { Worker } = require('worker_threads');
const mic = require('mic');
const wav = require('wav');
const { Readable } = require('stream');
const { SpeechRecorder } = require("speech-recorder");

// Configuration
const CHUNK_SIZE = 5000; // 5 seconds
const SILENCE_THRESHOLD = 600; // 0.6 seconds

let chunkStartTime = null;
let chunkNumber = 0;
let currentSilenceDuration = 0;
let isVoiceActive = false;
let allTranscriptsReceived = false;
let lastVoiceActivityTime = Date.now();
let isRecording = true;

let pendingChunks = new Set();
let receivedTranscripts = [];
let lastLoggedChunk = -1;

console.log('[Main] Initializing workers');
const audioWorker = new Worker('./audioThread.js');
const transcriptionWorker = new Worker('./transcriptionWorker.js');

let currentChunk = [];
let wavWriter;
let vadStream;

const micInstance = mic({
  rate: '16000',
  channels: '1',
  fileType: 'wav'
});

let micInputStream;

function startNewRecording() {
  if (micInputStream) {
    micInputStream.unpipe(wavWriter);
  }

  micInputStream = micInstance.getAudioStream();

  // Create a new WAV writer
  wavWriter = new wav.Writer({
    channels: 1,
    sampleRate: 16000,
    bitDepth: 16
  });

  micInputStream.pipe(wavWriter);

  wavWriter.on('data', (data) => {
    if (!isRecording) return;

    if (!chunkStartTime) {
      chunkStartTime = Date.now();
      console.log('[Main] Started new chunk');
    }

    currentChunk.push(data);
    vadStream.push(data);

    const currentTime = Date.now();
    const chunkDuration = currentTime - chunkStartTime;

    // Update silence duration
    if (!isVoiceActive) {
      currentSilenceDuration = currentTime - lastVoiceActivityTime;
    }

    if (chunkDuration >= CHUNK_SIZE) {
      // console.log(`[Main] Chunk duration reached: ${chunkDuration}ms`);
      // console.log(`[Main] Current silence duration: ${currentSilenceDuration}ms`);
      
      if (currentSilenceDuration >= SILENCE_THRESHOLD) {
        console.log('[Main] Silence threshold reached, sending chunk');
        sendChunk();
      } else {
        // console.log('[Main] Waiting for silence before sending chunk');
      }
    }
  });
}

// Create a Readable stream for SpeechRecorder
vadStream = new Readable({
  read() {}
});

audioWorker.on('message', (message) => {
  switch (message.type) {
    case 'voiceStatus':
      isVoiceActive = message.isActive;
      if (isVoiceActive) {
        lastVoiceActivityTime = Date.now();
        currentSilenceDuration = 0;
        // console.log('[Main] Voice detected, resetting silence duration');
      }
      break;
  }
});

transcriptionWorker.on('message', (message) => {
  if (message.type === 'transcriptComplete') {
    console.log(`[Main] Received transcript for chunk #${message.chunkNumber}. Time Length: ${message.audioLength.toFixed(2)}s, Turnaround Time: ${message.turnaroundTime.toFixed(2)}s`);
    receivedTranscripts[message.chunkNumber] = {
      text: message.text || '(empty)',
      audioLength: message.audioLength,
      turnaroundTime: message.turnaroundTime
    };
    pendingChunks.delete(message.chunkNumber);
    logOrderedTranscripts();
  } else if (message.type === 'transcriptError') {
    console.error(`[Main] Error transcribing chunk #${message.chunkNumber}:`, message.error);
    receivedTranscripts[message.chunkNumber] = {
      text: `(error: ${message.error})`,
      audioLength: 0,
      turnaroundTime: 0
    };
    pendingChunks.delete(message.chunkNumber);
    logOrderedTranscripts();
  } else if (message.type === 'allTranscripts') {
    console.log('[Main] Individual chunk transcripts:');
    message.individualTranscripts.forEach((transcript, index) => {
      console.log(`Chunk #${index}: ${transcript || '(empty)'}`);
    });
    console.log('\n[Main] Full transcript:');
    console.log(message.transcripts);
    allTranscriptsReceived = true;
  }
});

function logOrderedTranscripts() {
  let i = lastLoggedChunk + 1;
  while (receivedTranscripts[i] !== undefined) {
    const transcript = receivedTranscripts[i];
    console.log(`Chunk #${i}. Time Length: ${transcript.audioLength.toFixed(2)}s, Turnaround Time: ${transcript.turnaroundTime.toFixed(2)}s`);
    console.log(`Chunk #${i}: ${transcript.text}`);
    lastLoggedChunk = i;
    i++;
  }
}

function sendChunk() {
  const audioBuffer = Buffer.concat(currentChunk);
  const chunkDuration = (Date.now() - chunkStartTime) / 1000; // Convert to seconds

  console.log(`[Main] Chunk #${chunkNumber} sent. Length: ${chunkDuration.toFixed(2)} seconds`);

  pendingChunks.add(chunkNumber);

  transcriptionWorker.postMessage({
    type: 'transcribe',
    chunkNumber: chunkNumber,
    audio: audioBuffer
  });

  chunkNumber++;

  // Reset for next chunk
  currentChunk = [];
  chunkStartTime = null;
  currentSilenceDuration = 0;
  lastVoiceActivityTime = Date.now();

  // Start a new recording
  if (isRecording) {
    startNewRecording();
  }
}

console.log("[Main] Starting audio recording...");
startNewRecording();
micInstance.start();

// Create a speech recorder instance for VAD
// https://github.com/serenadeai/speech-recorder/tree/master
// See docs for VAD parameters, default is most aggressive VAD
const speechRecorder = new SpeechRecorder({
  onChunkStart: () => {
    // console.log("[VAD] Voice detected");
    audioWorker.postMessage({ type: 'voiceStatus', isActive: true });
  },
  onChunkEnd: () => {
    // console.log("[VAD] No voice detected");
    audioWorker.postMessage({ type: 'voiceStatus', isActive: false });
  },
});

speechRecorder.start(vadStream);

process.on('SIGINT', async () => {
  console.log('[Main] Stopping recording...');
  isRecording = false;
  micInstance.stop();
  speechRecorder.stop();
  vadStream.push(null); // End the VAD stream

  console.log('[Main] Waiting for pending transcriptions to complete...');
  
  // Send any remaining audio
  if (currentChunk.length > 0) {
    sendChunk();
  }

  // Wait for all pending chunks to be processed
  const waitForPendingChunks = () => {
    if (pendingChunks.size === 0) {
      console.log('[Main] All chunks processed, requesting final transcript...');
      transcriptionWorker.postMessage({ type: 'getAll' });
    } else {
      console.log(`[Main] Waiting for ${pendingChunks.size} chunks to be processed...`);
      setTimeout(waitForPendingChunks, 1000); // Check every second
    }
  };

  // Start waiting for pending chunks
  waitForPendingChunks();

  // Wait for the final transcript
  const waitForTranscripts = () => {
    if (allTranscriptsReceived) {
      console.log('[Main] Terminating workers');
      audioWorker.terminate();
      transcriptionWorker.terminate();
      console.log('[Main] Exiting process');
      process.exit(0);
    } else {
      setTimeout(waitForTranscripts, 500); // Check every 500ms
    }
  };

  // Start waiting for the final transcript
  waitForTranscripts();
});

console.log('[Main] Setup complete, recording audio...');