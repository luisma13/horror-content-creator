const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const https = require('https');
const config = require('./config');

// Lista de términos de búsqueda para videos de terror/ambiente
const HORROR_THEMES = [
    'dark forest mist',
    'foggy night',
    'rainy dark window',
    'abandoned hallway',
    'dark stormy clouds',
    'creepy dark house',
    'dark corridor',
    'misty graveyard',
    'dark forest',
    'dark haunted house',
    'dark forest mist',
];

// Función para obtener un tema aleatorio
function getRandomTheme() {
    return HORROR_THEMES[Math.floor(Math.random() * HORROR_THEMES.length)];
}

async function downloadVideo(processId) {
    try {
        console.log('Starting video download process...');
        // Usar Pexels para obtener video de ambiente
        console.log('Searching for ambient horror footage...');
        const searchQuery = getRandomTheme();
        console.log('Using theme:', searchQuery);

        const options = {
            headers: {
                'Authorization': config.PEXELS_API_KEY
            }
        };

        const pexelsUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(searchQuery)}&per_page=15&orientation=landscape`;
        
        const response = await fetch(pexelsUrl, options);
        const data = await response.json();

        if (!data.videos || data.videos.length === 0) {
            throw new Error('No suitable videos found on Pexels');
        }

        // Filtrar videos por duración (entre 10 y 60 segundos)
        const suitableVideos = data.videos.filter(video => 
            video.duration >= 10 && video.duration <= 60
        );

        if (suitableVideos.length === 0) {
            throw new Error('No videos with suitable duration found');
        }

        // Seleccionar un video aleatorio de los disponibles
        const selectedVideo = suitableVideos[Math.floor(Math.random() * suitableVideos.length)];
        console.log('Selected video duration:', selectedVideo.duration, 'seconds');

        // Obtener la mejor calidad disponible (preferiblemente HD)
        const videoFile = selectedVideo.video_files
            .sort((a, b) => (b.width * b.height) - (a.width * a.height))
            .find(file => file.width >= 1280 && file.quality !== '4k');

        if (!videoFile) {
            throw new Error('No suitable quality version found');
        }

        // Descargar el video
        const outputPath = path.join(__dirname, 'output', 'video', `video_${processId}.mp4`);

        console.log('Downloading video file...');
        await new Promise((resolve, reject) => {
            const file = fs.createWriteStream(outputPath);
            https.get(videoFile.link, (response) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log('Video download completed');
                    resolve(outputPath);
                });
            }).on('error', (err) => {
                fs.unlink(outputPath, () => reject(err));
            });
        });

        return outputPath;
    } catch (error) {
        console.error('Error in video download process:', error);
        throw error;
    }
}

// Función auxiliar para descargar de YouTube (por si se necesita)
async function downloadYouTubeVideo(url, processId) {
    console.log('Downloading YouTube video...');
    const outputPath = path.join(__dirname, 'output', 'video', `video_${processId}.mp4`);

    return new Promise((resolve, reject) => {
        const video = ytdl(url, {
            quality: 'highestvideo',
            filter: format => format.container === 'mp4'
        });

        const writeStream = fs.createWriteStream(outputPath);
        video.pipe(writeStream);

        writeStream.on('finish', () => {
            console.log('YouTube video download completed');
            resolve(outputPath);
        });

        writeStream.on('error', (error) => {
            reject(error);
        });
    });
}

module.exports = { downloadVideo }; 