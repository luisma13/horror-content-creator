const fs = require('fs').promises;
const path = require('path');
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const googleTTS = require('google-tts-api');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const axios = require('axios');
const config = require('./config');

// Configure ffmpeg and ffprobe
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// Create Polly client
const pollyClient = new PollyClient({
    region: config.AWS_REGION,
    credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY
    }
});

// Function to add timeout to promises
const withTimeout = (promise, ms) => {
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]);
};

async function synthesizeSpeechAmazon(text) {
    try {
        console.log('Requesting speech synthesis from Amazon Polly...');
        
        const command = new SynthesizeSpeechCommand({
            Engine: 'neural',
            LanguageCode: 'es-ES',
            OutputFormat: 'mp3',
            SampleRate: '24000',
            Text: text,
            TextType: 'text',
            VoiceId: 'Jorge' // Spanish male voice
        });

        const response = await withTimeout(
            pollyClient.send(command),
            30000 // 30 seconds timeout
        );

        if (response.AudioStream instanceof Uint8Array) {
            return Buffer.from(response.AudioStream);
        } else {
            throw new Error('Invalid audio stream received from Polly');
        }
    } catch (error) {
        console.error('Error synthesizing speech with Amazon Polly:', error);
        throw error;
    }
}

// Function to split text into chunks at sentence boundaries
function splitTextIntoChunks(text, maxLength = 200) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxLength) {
            currentChunk += sentence;
        } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks;
}

// Function to combine audio buffers
async function combineAudioBuffers(buffers, outputPath) {
    return new Promise((resolve, reject) => {
        // Create temporary files for each buffer
        const tempFiles = buffers.map((_, index) => path.join(__dirname, 'output', 'temp', `chunk_${index}.mp3`));
        
        // Write all buffers to temporary files
        Promise.all(buffers.map((buffer, index) => 
            fs.writeFile(tempFiles[index], buffer)
        )).then(() => {
            // Create ffmpeg command
            const command = ffmpeg();
            
            // Add all input files
            tempFiles.forEach(file => {
                command.input(file);
            });

            // Concatenate files
            command
                .on('error', async (err) => {
                    // Clean up temp files
                    await Promise.all(tempFiles.map(file => fs.unlink(file).catch(() => {})));
                    reject(err);
                })
                .on('end', async () => {
                    // Clean up temp files
                    await Promise.all(tempFiles.map(file => fs.unlink(file).catch(() => {})));
                    resolve();
                })
                .mergeToFile(outputPath);
        }).catch(reject);
    });
}

async function synthesizeSpeechGoogle(text) {
    try {
        console.log('Requesting speech synthesis from Google TTS...');
        
        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, 'output', 'temp');
        await fs.mkdir(tempDir, { recursive: true });

        // Split text into chunks
        const chunks = splitTextIntoChunks(text);
        console.log(`Text split into ${chunks.length} chunks`);

        // Get audio for each chunk
        const audioBuffers = await Promise.all(chunks.map(async (chunk) => {
            const url = googleTTS.getAudioUrl(chunk, {
                lang: 'es',
                slow: false,
                host: 'https://translate.google.com',
            });

            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer',
                timeout: 30000
            });

            return Buffer.from(response.data);
        }));

        // If only one chunk, return it directly
        if (audioBuffers.length === 1) {
            return audioBuffers[0];
        }

        // Combine all audio chunks
        const tempOutputPath = path.join(__dirname, 'output', 'temp', `combined_${Date.now()}.mp3`);
        await combineAudioBuffers(audioBuffers, tempOutputPath);
        
        // Read the combined file
        const finalBuffer = await fs.readFile(tempOutputPath);
        
        // Delete the temporary combined file
        await fs.unlink(tempOutputPath);

        return finalBuffer;
    } catch (error) {
        console.error('Error synthesizing speech with Google TTS:', error);
        throw error;
    }
}

async function synthesizeSpeech(text) {
    const ttsService = config.TTS_SERVICE.toLowerCase();
    
    switch (ttsService) {
        case 'google':
            return await synthesizeSpeechGoogle(text);
        case 'amazon':
            return await synthesizeSpeechAmazon(text);
        default:
            throw new Error(`Unsupported TTS service: ${ttsService}`);
    }
}

async function convertStoryToSpeech(storyPath) {
    try {
        console.log('Reading story file...');
        const story = await fs.readFile(storyPath, 'utf-8');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const audioFilename = `audio_${timestamp}.mp3`;
        const outputPath = path.join(__dirname, 'output', 'audio', audioFilename);

        const ttsService = config.TTS_SERVICE.toLowerCase();
        console.log(`Converting story to speech using ${ttsService.toUpperCase()}...`);
        
        const audioBuffer = await synthesizeSpeech(story);

        // Ensure directory exists
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        // Save the audio
        await fs.writeFile(outputPath, audioBuffer);
        console.log('Audio file saved successfully');

        return outputPath;
    } catch (error) {
        console.error('Error converting story to speech:', error);
        throw error;
    }
}

module.exports = { convertStoryToSpeech }; 