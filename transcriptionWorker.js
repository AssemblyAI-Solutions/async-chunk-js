// transcriptionWorker.js
const { parentPort } = require('worker_threads');
const { AssemblyAI } = require("assemblyai");

require('dotenv').config();

const API_KEY = process.env.ASSEMBLYAI_API_KEY;

if (!API_KEY) {
  console.error('AssemblyAI API key not found. Please set ASSEMBLYAI_API_KEY in your .env file.');
  process.exit(1);
}

const client = new AssemblyAI({
  apiKey: API_KEY,
});

let transcripts = [];

parentPort.on('message', async (message) => {
  if (message.type === 'transcribe') {
    const { chunkNumber, audio } = message;
    console.log(`[Worker] Received chunk #${chunkNumber} for transcription`);
    try {
      console.log(`[Worker] Starting transcription for chunk #${chunkNumber}`);
      const startTime = Date.now();
      const transcript = await client.transcripts.transcribe({
        audio: audio,
        language_code:'en'
        // language_detection: true --> uncomment for lang detection and comment lang code line above
      });
      const endTime = Date.now();
      const turnaroundTime = (endTime - startTime) / 1000; // Convert to seconds
      
      console.log(`[Worker] Transcription completed for chunk #${chunkNumber}`);
      
      // Calculate audio length in seconds (assuming audio is a Buffer)
      const audioLengthSeconds = audio.length / (16000 * 2); // Assuming 16kHz 16-bit audio
      
      transcripts[chunkNumber] = transcript.text || '';
      
      parentPort.postMessage({ 
        type: 'transcriptComplete', 
        chunkNumber: chunkNumber,
        text: transcript.text || '',
        audioLength: audioLengthSeconds,
        turnaroundTime: turnaroundTime
      });
      
    } catch (error) {
      console.error(`[Worker] Transcription error for chunk #${chunkNumber}:`, error);
      parentPort.postMessage({ 
        type: 'transcriptError', 
        chunkNumber: chunkNumber,
        error: error.message 
      });
    }
  } else if (message.type === 'getAll') {
    const fullTranscript = transcripts
      .filter(t => t && t.trim() !== '') // Remove empty or whitespace-only transcripts
      .join(' ') // Join non-empty transcripts with a space
      .trim(); // Remove leading/trailing spaces
    parentPort.postMessage({ 
      type: 'allTranscripts', 
      transcripts: fullTranscript,
      individualTranscripts: transcripts.map(t => t || '')
    });
  }
});

console.log('[Worker] Transcription worker initialized');