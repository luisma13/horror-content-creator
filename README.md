# 🎬 Horror Story Video Generator Bot

An automated video generator that creates vertical format (9:16) horror stories for social media. It combines generative AI for storytelling, text-to-speech for narration, and video processing to create engaging and atmospheric content.

## 🌟 Features

- AI-powered horror story generation in Spanish using DeepSeek-R1
- Multiple text-to-speech options (Google TTS or Amazon Polly)
- Automatic atmospheric background video download from Pexels
- FFmpeg video processing for vertical format (1080x1920)
- Synchronized and styled subtitles
- Batch processing system with unique IDs

## 📋 Prerequisites

- Node.js (v14 or higher)
- FFmpeg installed on the system
- Required API keys:
  - OpenRouter API (for story generation)
  - Pexels API (for background videos)
  - AWS (optional, if using Amazon Polly for TTS)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone [REPOSITORY_URL]
cd bot-content-creator
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables in a `.env` file:
```env
PEXELS_API_KEY=your_pexels_key
OPENROUTER_API_KEY=your_openrouter_key

# Optional for Amazon Polly
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region

# TTS Service Configuration ('google' or 'amazon')
TTS_SERVICE=google
```

## 🚀 Usage

To generate a new video:

```bash
npm start
```

The process includes:
1. Generation of a unique horror story
2. Converting the story to narrated audio
3. Downloading an atmospheric background video
4. Combining audio, video, and subtitles
5. Generating the final vertical format video

## 📁 Project Structure

```
src/
├── index.js           # Main entry point
├── storyGenerator.js  # AI story generation
├── textToSpeech.js   # Text-to-speech conversion
├── videoHandler.js    # Background video management
├── mediaProcessor.js  # Media processing and combination
└── output/           # Generated files directory
    ├── stories/     # Generated stories
    ├── audio/       # Audio files
    ├── video/       # Background videos
    ├── temp/        # Temporary files
    └── final/       # Processed final videos
```

## ⚙️ Configuration

### Video Format
- Resolution: 1080x1920 (9:16)
- Codec: H.264
- Audio: AAC 192k
- FPS: 30

### Subtitles
- Font: System default
- Size: 40px
- Color: White with black outline
- Position: Centered at bottom

## 🤝 Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

## 📝 Notes

- The project is optimized for Spanish content generation
- Generated videos are ideal for TikTok, Instagram Reels, and YouTube Shorts
- The system includes error handling and temporary file cleanup
- All stories are generated in Spanish with Spanish narration

## ⚠️ Known Limitations

- Final video duration is limited by the generated audio length
- Requires stable internet connection for video downloads and content generation
- Generation process may take several minutes depending on story length
- Currently only supports Spanish language output

## 📄 License

ISC License - See LICENSE file for details. 