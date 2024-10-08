# AsyncChunkJS: Near-Realtime Node.js Speech-to-Text App

AsyncChunkJS is a Node.js application that provides near-realtime speech-to-text transcription using chunked audio processing and asynchronous transcription. It leverages the power of AssemblyAI's async transcription API to deliver high-quality transcriptions at near real-time speeds.

## Features

- Real-time audio recording and chunking
- Voice Activity Detection (VAD) for intelligent chunk processing
- Asynchronous transcription using AssemblyAI API
- Ordered transcript logging
- Configurable chunk size and silence threshold
- Support for multiple languages

## Key Benefits

- Access to AssemblyAI's powerful Universal-1 model for English, Spanish, French, and German
- Support for all non-English languages available in AssemblyAI's async transcription service
- Higher accuracy compared to real-time transcription models
- More cost-effective than real-time transcription services
- Near real-time performance with the quality of async transcription

## Prerequisites

- Node.js (v12 or later recommended)
- Yarn package manager
- AssemblyAI API key

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/AssemblyAI-Solutions/async-chunk-js.git
   cd async-chunk-js
   ```

2. Install dependencies:
   ```
   yarn install
   ```

3. Create a `.env` file in the root directory and add your AssemblyAI API key:
   ```
   ASSEMBLYAI_API_KEY=your_api_key_here
   ```

## Usage

1. Start the application:
   ```
   node index.js
   ```

2. Speak into your microphone. The application will record and transcribe your speech in near-realtime.

3. Press Ctrl+C to stop the recording and see the final transcript.

## Configuration

You can modify the following parameters in `index.js`:

- `CHUNK_SIZE`: Duration of each audio chunk in milliseconds (default: 5000ms)
- `SILENCE_THRESHOLD`: Duration of silence required to trigger chunk processing (default: 600ms)

To change the language or enable language detection, modify the `transcriptionWorker.js` file:

- Set `language_code: 'en'` to the desired language code, or
- Uncomment `language_detection: true` and comment out the `language_code` line to enable automatic language detection

## Voice Activity Detection (VAD)

This project uses the `speech-recorder` library for VAD. You can adjust VAD parameters by modifying the `SpeechRecorder` configuration in `index.js`. For more information on VAD parameters, visit the [speech-recorder GitHub repository](https://github.com/serenadeai/speech-recorder/tree/master).

## Project Structure

- `index.js`: Main application file handling audio recording, chunking, and coordination.
- `transcriptionWorker.js`: Worker for handling transcription tasks using AssemblyAI API.
- `audioThread.js`: Worker for managing voice activity detection.

## Acknowledgments

- [speech-recorder](https://github.com/serenadeai/speech-recorder) for the Voice Activity Detection functionality

## Troubleshooting

If you encounter any issues with audio recording or transcription, ensure that:

1. Your microphone is properly connected and selected as the input device.
2. Your AssemblyAI API key is correctly set in the `.env` file.
3. You have a stable internet connection for API communication.

For any other issues, please check the console output for error messages and refer to the documentation of the individual dependencies if needed.