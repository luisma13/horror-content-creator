const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

// Configurar ffmpeg y ffprobe
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

async function getMediaDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata.format.duration);
        });
    });
}

// Función para generar subtítulos
async function generateSubtitles(text, audioDuration) {
    console.log('Generando subtítulos...');
    
    // Dividir el texto en oraciones
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    console.log(`Divided text into ${sentences.length} sentences`);
    
    // Calcular duración aproximada por oración con un pequeño delay al inicio
    const startDelay = 0.5; // Medio segundo de delay inicial
    const availableDuration = audioDuration - startDelay;
    // Aumentar la duración por oración para que vaya más lento
    const durationPerSentence = (availableDuration / sentences.length) * 1.2;
    
    // Generar comandos de drawtext para cada oración
    let drawtextCommands = [];
    let currentStartTime = startDelay; // Comenzar después del delay
    
    sentences.forEach((sentence, index) => {
        let currentEndTime = currentStartTime + durationPerSentence - 0.3; // Pequeña pausa entre oraciones
        const escapedText = sentence.trim()
            .replace(/'/g, '')
            .replace(/"/g, '')
            .replace(/\[/g, '')
            .replace(/\]/g, '')
            .replace(/\\/g, '')
            .replace(/:/g, ' -')
            .replace(/\n/g, ' ')
            .trim();
        
        // Dividir el texto en líneas si es muy largo
        const maxCharsPerLine = 35; // Reducido para mejor ajuste en pantalla
        let words = escapedText.split(' ');
        let lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        });
        if (currentLine) lines.push(currentLine);
        
        // Ya no necesitamos invertir las líneas
        // lines.reverse();
        
        // Generar un comando drawtext para cada línea
        lines.forEach((line, lineIndex) => {
            // Calcular la posición Y desde abajo hacia arriba
            // El offset más grande será para las primeras líneas
            const yOffset = (lines.length - lineIndex - 1) * 60;
            const baseMargin = 150; // Margen base desde el fondo
            
            const command = `drawtext=text='${line}':` +
                          `fontsize=40:` +
                          `fontcolor=white:` +
                          `bordercolor=black:` +
                          `borderw=3:` +
                          `shadowcolor=black@0.8:` +
                          `shadowx=3:` +
                          `shadowy=3:` +
                          `x=(w-text_w)/2:` +
                          `y=h-${baseMargin + yOffset}:` +
                          `enable='between(t,${currentStartTime},${currentEndTime})'`;
            
            drawtextCommands.push(command);
        });
        
        console.log(`Subtitle ${index + 1} (${lines.length} lines):`, lines[0]);
        
        currentStartTime = currentEndTime + 0.3; // Aumentar la pausa entre oraciones
    });
    
    return drawtextCommands.join(',');
}

async function combineAudioVideo(audioPath, videoPath, storyText, processId) {
    try {
        console.log('Starting media combination process...');
        console.log('Audio path:', audioPath);
        console.log('Video path:', videoPath);
        console.log('Process ID:', processId);

        // Obtener duraciones
        const audioDuration = await getMediaDuration(audioPath);
        const videoDuration = await getMediaDuration(videoPath);
        console.log(`Audio duration: ${audioDuration}s, Video duration: ${videoDuration}s`);

        // Generar comandos de subtítulos
        const drawtextFilters = await generateSubtitles(storyText, audioDuration);
        console.log('Generated subtitle filters:', drawtextFilters.substring(0, 100) + '...');

        const outputPath = path.join(__dirname, 'output', 'final', `final_${processId}.mp4`);

        return new Promise((resolve, reject) => {
            let command = ffmpeg();
            let totalFrames = audioDuration * 30; // 30 fps
            let lastProgress = 0;

            // Calcular cuántas veces necesitamos repetir el video
            const loopCount = Math.ceil(audioDuration / videoDuration);
            console.log(`Video will loop ${loopCount} times`);

            // Configurar el input del video con loop si es necesario
            command
                .input(videoPath)
                .inputOptions([`-stream_loop ${loopCount - 1}`])
                // Añadir el audio
                .input(audioPath)
                // Mapear streams y configurar el formato vertical
                .outputOptions([
                    // Mantener el video del primer input
                    '-map 0:v:0',
                    // Mantener el audio del segundo input
                    '-map 1:a:0',
                    // Codecs
                    '-c:v libx264',
                    '-c:a aac',
                    // Calidad
                    '-b:a 192k',
                    // Asegurar que el video tenga la misma duración que el audio
                    `-t ${audioDuration}`,
                    // Forzar el framerate para evitar problemas de sincronización
                    '-r 30',
                    // Configuración para formato vertical (9:16) y subtítulos
                    '-vf',
                    `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${drawtextFilters}`,
                    // Configuración adicional para mejor calidad
                    '-preset medium',
                    '-crf 23',
                    '-movflags +faststart'
                ])
                .on('start', command => {
                    console.log('FFmpeg command:', command);
                })
                .on('progress', progress => {
                    // Calcular el progreso real basado en los frames procesados
                    if (progress.frames) {
                        const currentProgress = Math.min(100, (progress.frames / totalFrames) * 100);
                        if (currentProgress > lastProgress + 1) { // Solo mostrar cambios mayores al 1%
                            console.log(`Processing: ${currentProgress.toFixed(1)}%`);
                            lastProgress = currentProgress;
                        }
                    }
                })
                .on('error', (err, stdout, stderr) => {
                    console.error('Error:', err);
                    console.error('FFmpeg stderr:', stderr);
                    reject(err);
                })
                .on('end', async () => {
                    console.log('Media combination completed successfully');
                    resolve(outputPath);
                });

            // Iniciar el proceso
            command.save(outputPath);
        });
    } catch (error) {
        console.error('Error in media combination:', error);
        throw error;
    }
}

module.exports = { combineAudioVideo }; 