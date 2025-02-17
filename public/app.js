// Importar FFmpeg
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ 
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    workerPath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js'
});

// Configuración de OpenAI
const OPENAI_CONFIG = {
    apiKey: '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',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
        'HTTP-Referer': 'https://github.com/yourusername/your-repo',
        'X-Title': 'Horror Story Generator'
    }
};

// Configuración de Pexels
const PEXELS_CONFIG = {
    apiKey: 'VUrfTsubhEzz9XlmQz65JMlLCfReB5uz3NadkeWsPPmivIaYRkdnn8Sk'
};

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

document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const generateBtn = document.getElementById('generateBtn');
    const progressContainer = document.querySelector('.progress-container');
    const resultContainerElement = document.querySelector('.result-container');
    const progressBar = document.querySelector('.progress');
    const statusCircle = document.querySelector('.status-circle');
    const statusText = document.querySelector('.status-text');
    const steps = document.querySelectorAll('.step');
    const downloadBtn = document.getElementById('downloadBtn');
    const shareBtn = document.getElementById('shareBtn');
    const storyPrompt = document.getElementById('storyPrompt');
    const manualStory = document.getElementById('manualStory');
    const storyContainer = document.querySelector('.story-container');
    const generatedStory = document.getElementById('generatedStory');
    const previewAudioBtn = document.getElementById('previewAudioBtn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Estado de la aplicación
    let currentVideoUrl = '';
    let isGenerating = false;
    let ffmpegLoaded = false;
    let currentStory = '';
    let currentMode = 'ia'; // 'ia' o 'manual'

    // Prompt por defecto
    const DEFAULT_PROMPT = `Escribe una historia de terror cautivadora siguiendo estos requisitos:
- Longitud alrededor de 100 palabras
- Incluir detalles atmosféricos y descripciones vívidas
- Construir la tensión gradualmente a lo largo de la historia
- Incluir elementos de horror psicológico
- Terminar con una revelación impactante o perturbadora
- Hacerla perfecta para narración dramática
- Debe ser en español`;

    storyPrompt.value = DEFAULT_PROMPT;

    // Manejar cambio de pestañas
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // Actualizar botones
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Actualizar contenido
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tab}Tab`) {
                    content.classList.add('active');
                }
            });
            
            currentMode = tab;
        });
    });

    // Función para verificar si el navegador soporta las características necesarias
    function checkBrowserSupport() {
        const missingFeatures = [];
        
        if (!window.SharedArrayBuffer) {
            missingFeatures.push('SharedArrayBuffer');
        }
        if (!window.crossOriginIsolated) {
            missingFeatures.push('Cross-Origin Isolation');
        }
        if (!window.WebAssembly) {
            missingFeatures.push('WebAssembly');
        }
        
        return missingFeatures;
    }

    // Función para verificar permisos
    async function checkPermissions() {
        try {
            // Verificar soporte de Web Speech API
            if (!window.speechSynthesis) {
                throw new Error('Tu navegador no soporta la síntesis de voz');
            }

            return true;
        } catch (error) {
            console.error('Error al verificar permisos:', error);
            throw new Error('No se pudieron obtener los permisos necesarios: ' + error.message);
        }
    }

    // Intentar cargar FFmpeg y verificar permisos
    try {
        const missingFeatures = checkBrowserSupport();
        
        if (missingFeatures.length > 0) {
            throw new Error(`Tu navegador no soporta las siguientes características necesarias: ${missingFeatures.join(', ')}. 
                Por favor, usa un navegador moderno como Chrome o Firefox, o asegúrate de que el sitio se sirve con los headers de seguridad adecuados.`);
        }

        await Promise.all([
            ffmpeg.load(),
            checkPermissions()
        ]);

        ffmpegLoaded = true;
        updateStatus('Listo para generar');
    } catch (error) {
        console.error('Error cargando FFmpeg:', error);
        updateStatus('Error: ' + error.message, 'error');
        generateBtn.disabled = true;
        generateBtn.title = 'FFmpeg no está disponible';
    }

    // Función para actualizar el estado visual
    function updateStatus(message, type = 'success') {
        statusText.textContent = message;
        statusCircle.style.backgroundColor = 
            type === 'success' ? 'var(--success-color)' :
            type === 'warning' ? 'var(--warning-color)' :
            'var(--error-color)';
    }

    // Función para actualizar el progreso
    function updateProgress(step, percentage = 0) {
        steps.forEach(s => {
            if (s.dataset.step === step) {
                s.classList.add('active', 'processing');
                progressBar.style.width = `${percentage}%`;
            } else if (Array.from(steps).indexOf(s) < Array.from(steps).findIndex(x => x.dataset.step === step)) {
                s.classList.add('active');
                s.classList.remove('processing');
            } else {
                s.classList.remove('active', 'processing');
            }
        });
    }

    // Función para mostrar loading en el contenedor de video
    function showVideoLoading(container, show, text = 'Procesando...') {
        if (show) {
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">${text}</div>
            `;
            container.appendChild(overlay);
        } else {
            const overlay = container.querySelector('.loading-overlay');
            if (overlay) {
                overlay.remove();
            }
        }
    }

    // Función para convertir texto a voz usando Web Speech API
    async function textToSpeech(text) {
        updateProgress('audio', 66);
        return new Promise((resolve, reject) => {
            try {
                // Crear un elemento de audio para la síntesis
                const audio = new Audio();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'es-ES';
                utterance.rate = 1;
                utterance.pitch = 1;

                // Obtener la voz en español
                const voices = window.speechSynthesis.getVoices();
                const spanishVoice = voices.find(voice => voice.lang.includes('es'));
                if (spanishVoice) {
                    utterance.voice = spanishVoice;
                }

                // Crear un AudioContext y nodos necesarios
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const destination = audioContext.createMediaStreamDestination();
                const source = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                // Configurar el oscilador (silenciado)
                source.connect(gainNode);
                gainNode.connect(destination);
                gainNode.gain.value = 0;
                source.start();

                // Crear el MediaRecorder
                const mediaRecorder = new MediaRecorder(destination.stream);
                const audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    resolve(URL.createObjectURL(audioBlob));
                    source.stop();
                    audioContext.close();
                };

                // Iniciar grabación
                mediaRecorder.start();

                // Manejar eventos de la síntesis
                utterance.onstart = () => {
                    console.log('Iniciando síntesis de voz');
                };

                utterance.onend = () => {
                    console.log('Finalizando síntesis de voz');
                    setTimeout(() => mediaRecorder.stop(), 500); // Pequeño delay para asegurar que capturamos todo
                };

                utterance.onerror = (error) => {
                    console.error('Error en síntesis:', error);
                    mediaRecorder.stop();
                    reject(error);
                };

                // Iniciar síntesis
                window.speechSynthesis.speak(utterance);

                // Timeout de seguridad (15 segundos)
                setTimeout(() => {
                    if (mediaRecorder.state === 'recording') {
                        console.log('Deteniendo grabación por timeout');
                        mediaRecorder.stop();
                    }
                }, 15000);

            } catch (error) {
                console.error('Error en la síntesis de voz:', error);
                reject(error);
            }
        });
    }

    // Función para previsualizar el audio
    async function previewAudio(text) {
        try {
            // Detener cualquier síntesis en curso
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 1;
            utterance.pitch = 1;

            // Obtener la voz en español
            const voices = window.speechSynthesis.getVoices();
            const spanishVoice = voices.find(voice => voice.lang.includes('es'));
            if (spanishVoice) {
                utterance.voice = spanishVoice;
            }
            
            // Añadir manejadores de eventos para debugging
            utterance.onstart = () => console.log('Iniciando reproducción de audio');
            utterance.onend = () => console.log('Finalizada reproducción de audio');
            utterance.onerror = (error) => {
                console.error('Error en reproducción:', error);
                alert('Error al reproducir el audio: ' + error.message);
            };
            
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Error al reproducir el audio:', error);
            alert('Error al reproducir el audio: ' + error.message);
        }
    }

    // Función para generar historia
    async function generateStory() {
        updateProgress('story', 33);
        
        try {
            let story;
            
            if (currentMode === 'ia') {
                if (!OPENAI_CONFIG.apiKey) {
                    throw new Error('Se requiere una API key de OpenAI');
                }

                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        ...OPENAI_CONFIG.defaultHeaders,
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_CONFIG.apiKey}`
                    },
                    body: JSON.stringify({
                        model: "deepseek/deepseek-r1:free",
                        messages: [{
                            role: "system",
                            content: "You are a skilled horror story writer. You excel at creating atmospheric, psychological horror stories with compelling narratives and shocking twists. Your stories are perfect for dramatic narration. Write the story in Spanish."
                        }, {
                            role: "user",
                            content: storyPrompt.value || DEFAULT_PROMPT
                        }],
                        temperature: 0.9,
                        top_p: 1.0,
                        top_k: 0,
                        frequency_penalty: 0,
                        presence_penalty: 0,
                        repetition_penalty: 1.0,
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error?.message || 'Error en la API de OpenAI');
                }

                const data = await response.json();
                if (!data.choices || !data.choices.length) {
                    throw new Error('Respuesta inválida de la API');
                }

                story = data.choices[0].message.content.trim();
            } else {
                // Modo manual
                story = manualStory.value.trim();
                if (!story) {
                    throw new Error('Por favor, ingresa una historia en el modo manual');
                }
            }

            currentStory = story;

            // Mostrar la historia generada con título según el modo
            generatedStory.textContent = story;
            const storyTitle = storyContainer.querySelector('h3');
            storyTitle.innerHTML = currentMode === 'ia' ? 
                '<i class="fas fa-book"></i> Historia Generada' : 
                '<i class="fas fa-book"></i> Tu Historia';
            storyContainer.classList.remove('hidden');
            previewAudioBtn.disabled = false;

            return story;
        } catch (error) {
            console.error('Error generando historia:', error);
            throw error;
        }
    }

    // Función para cargar la fuente
    async function loadFont() {
        try {
            const fontResponse = await fetch('assets/Coolvetica Rg.otf');
            const fontData = await fontResponse.arrayBuffer();
            ffmpeg.FS('writeFile', 'font.otf', new Uint8Array(fontData));
            return true;
        } catch (error) {
            console.error('Error cargando la fuente:', error);
            return false;
        }
    }

    // Función para generar subtítulos
    async function generateSubtitles(text, audioDuration) {
        console.log('Generando subtítulos...');
        
        // Dividir el texto en oraciones
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        console.log(`Texto dividido en ${sentences.length} oraciones`);
        
        // Calcular duración aproximada por oración con un pequeño delay al inicio
        const startDelay = 0.5; // Medio segundo de delay inicial
        const availableDuration = audioDuration - startDelay;
        const durationPerSentence = (availableDuration / sentences.length) * 1.2;
        
        // Generar comandos de drawtext para cada oración
        let drawtextCommands = [];
        let currentStartTime = startDelay;
        
        sentences.forEach((sentence, index) => {
            const currentEndTime = currentStartTime + durationPerSentence - 0.3;
            
            // Limpiar y escapar el texto
            const escapedText = sentence.trim()
                .replace(/[\\'"]/g, '')
                .replace(/[[\]]/g, '')
                .replace(/:/g, ' -')
                .replace(/\n/g, ' ')
                .replace(/[^a-zA-Z0-9\s.,!?¡¿áéíóúÁÉÍÓÚñÑ-]/g, '')
                .trim();
            
            // Dividir en líneas más cortas
            const maxCharsPerLine = 35;
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
            
            // Generar comando para cada línea
            lines.forEach((line, lineIndex) => {
                const yOffset = (lines.length - lineIndex - 1) * 60;
                const baseMargin = 150;
                
                // Configuración de drawtext con la fuente Coolvetica
                const command = `drawtext=fontfile=font.otf:` +
                              `text='${line}':` +
                              `fontsize=40:` +
                              `fontcolor=white:` +
                              `box=1:` +
                              `boxcolor=black@0.5:` +
                              `boxborderw=5:` +
                              `x=(w-text_w)/2:` +
                              `y=h-${baseMargin + yOffset}:` +
                              `enable='between(t,${currentStartTime},${currentEndTime})'`;
                
                drawtextCommands.push(command);
            });
            
            currentStartTime = currentEndTime + 0.3;
        });
        
        return drawtextCommands.join(',');
    }

    // Función para procesar el video
    async function processVideo(audioUrl) {
        updateProgress('video', 0);
        
        if (!ffmpegLoaded) {
            throw new Error('FFmpeg no está disponible.');
        }

        try {
            // Cargar la fuente primero
            updateProgress('video', 10);
            const fontLoaded = await loadFont();
            if (!fontLoaded) {
                throw new Error('No se pudo cargar la fuente para los subtítulos');
            }

            // Buscar video en Pexels
            updateProgress('video', 20);
            const searchQuery = getRandomTheme();
            const pexelsUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(searchQuery)}&per_page=15&orientation=landscape`;
            const response = await fetch(pexelsUrl, {
                headers: {
                    'Authorization': PEXELS_CONFIG.apiKey
                }
            });

            if (!response.ok) {
                throw new Error('Error al buscar videos en Pexels');
            }

            const pexelsData = await response.json();
            if (!pexelsData.videos?.length) {
                throw new Error('No se encontraron videos adecuados');
            }

            // Filtrar videos por duración
            const suitableVideos = pexelsData.videos.filter(video => 
                video.duration >= 10 && video.duration <= 60
            );

            if (!suitableVideos.length) {
                throw new Error('No se encontraron videos con la duración adecuada');
            }

            // Seleccionar video aleatorio y descargar
            updateProgress('video', 30);
            const selectedVideo = suitableVideos[Math.floor(Math.random() * suitableVideos.length)];
            const videoFile = selectedVideo.video_files
                .sort((a, b) => (b.width * b.height) - (a.width * a.height))
                .find(file => file.width >= 1280 && file.quality !== '4k');

            if (!videoFile) {
                throw new Error('No se encontró una versión del video con calidad adecuada');
            }

            console.log('Descargando video y audio...');
            updateProgress('video', 40);
            
            // Primero el video
            const videoResponse = await fetch(videoFile.link, {
                mode: 'cors',
                credentials: 'omit'
            });

            if (!videoResponse.ok) {
                throw new Error('Error al descargar el video');
            }

            const videoData = await videoResponse.arrayBuffer();

            // Luego el audio
            const audioResponse = await fetch(audioUrl);
            if (!audioResponse.ok) {
                throw new Error('Error al descargar el audio');
            }

            const audioData = await audioResponse.arrayBuffer();

            // Escribir archivos
            updateProgress('video', 50);
            ffmpeg.FS('writeFile', 'background.mp4', new Uint8Array(videoData));
            ffmpeg.FS('writeFile', 'audio.wav', new Uint8Array(audioData));

            // Obtener duración del audio
            const audioDuration = await new Promise((resolve) => {
                const tempAudio = new Audio(audioUrl);
                tempAudio.addEventListener('loadedmetadata', () => {
                    resolve(tempAudio.duration);
                });
                tempAudio.addEventListener('error', () => {
                    console.warn('Error cargando audio, usando duración por defecto');
                    resolve(10);
                });
            });

            // Generar subtítulos con la duración correcta del audio
            updateProgress('video', 60);
            const subtitles = await generateSubtitles(currentStory, audioDuration);

            // Mostrar preview con loading
            const backgroundPreview = document.getElementById('backgroundPreview');
            const backgroundPreviewContainer = document.querySelector('.background-preview');
            backgroundPreview.src = URL.createObjectURL(new Blob([videoData], { type: 'video/mp4' }));
            backgroundPreviewContainer.classList.remove('hidden');
            showVideoLoading(backgroundPreviewContainer, true, 'Procesando video...');

            console.log('Procesando video final...');
            updateProgress('video', 70);
            try {
                // Primero, crear el video base con el audio
                await ffmpeg.run(
                    '-i', 'background.mp4',
                    '-i', 'audio.wav',
                    '-filter_complex', '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[v];[v]loop=loop=-1:size=2:start=0[v2]',
                    '-map', '[v2]',
                    '-map', '1:a',
                    '-shortest',
                    '-c:v', 'libx264',
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-pix_fmt', 'yuv420p',
                    '-y',
                    'temp.mp4'
                );

                // Verificar que el archivo temporal se creó correctamente
                const tempData = ffmpeg.FS('readFile', 'temp.mp4');
                if (!tempData || tempData.length === 0) {
                    throw new Error('Error al generar el video base');
                }

                // Ahora añadir los subtítulos al video con audio
                await ffmpeg.run(
                    '-i', 'temp.mp4',
                    '-vf', subtitles,
                    '-c:v', 'libx264',
                    '-c:a', 'copy',
                    '-preset', 'ultrafast',
                    '-movflags', '+faststart',
                    '-pix_fmt', 'yuv420p',
                    '-y',
                    'output.mp4'
                );

                updateProgress('video', 90);

                // Verificar el archivo de salida
                const outputData = ffmpeg.FS('readFile', 'output.mp4');
                if (!outputData || outputData.length === 0) {
                    throw new Error('El archivo de salida está vacío');
                }

                // Crear blob con el tipo MIME correcto
                const videoBlob = new Blob([outputData.buffer], { 
                    type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
                });

                // Crear URL para el video final
                const videoUrl = URL.createObjectURL(videoBlob);

                // Crear URL para el video de fondo
                const backgroundBlob = new Blob([videoData], { 
                    type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' 
                });
                const backgroundUrl = URL.createObjectURL(backgroundBlob);

                // Quitar loading del preview
                showVideoLoading(backgroundPreviewContainer, false);
                backgroundPreview.play().catch(console.error);

                // Limpiar archivos de ffmpeg
                ['background.mp4', 'audio.wav', 'output.mp4', 'temp.mp4', 'font.otf'].forEach(file => {
                    try {
                        ffmpeg.FS('unlink', file);
                    } catch (e) {
                        console.warn(`No se pudo eliminar ${file}:`, e);
                    }
                });

                updateProgress('video', 100);
                return {
                    videoUrl,
                    backgroundUrl
                };
            } catch (error) {
                showVideoLoading(backgroundPreviewContainer, false);
                console.error('Error en FFmpeg:', error);
                throw new Error('Error al procesar el video: ' + error.message);
            }
        } catch (error) {
            console.error('Error procesando video:', error);
            throw new Error(`Error al procesar el video: ${error.message}`);
        }
    }

    // Función principal para generar el video
    async function generateVideo() {
        if (isGenerating) return;
        
        try {
            isGenerating = true;
            updateStatus('Generando...', 'warning');
            progressContainer.classList.remove('hidden');
            resultContainerElement.classList.add('hidden');
            generateBtn.disabled = true;

            // Verificar API key
            if (!OPENAI_CONFIG.apiKey) {
                throw new Error('Por favor, ingresa tu API key de OpenAI');
            }

            // Verificar que FFmpeg esté cargado
            if (!ffmpegLoaded) {
                throw new Error('FFmpeg no está cargado correctamente. Por favor, recarga la página.');
            }

            updateStatus('Generando historia...');
            const story = await generateStory();
            
            updateStatus('Generando audio...');
            const audioUrl = await textToSpeech(story);
            
            updateStatus('Procesando video...');
            const { videoUrl, backgroundUrl } = await processVideo(audioUrl);
            
            // Mostrar resultado con loading
            const videoElement = document.querySelector('.result-container video');
            
            // Limpiar URL anterior si existe
            if (currentVideoUrl) {
                URL.revokeObjectURL(currentVideoUrl);
            }

            // Mostrar loading mientras se carga el video
            showVideoLoading(resultContainerElement, true, 'Cargando video final...');

            // Actualizar URL del video
            currentVideoUrl = videoUrl;
            videoElement.src = videoUrl;

            // Esperar a que el video se cargue
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Tiempo de espera agotado al cargar el video'));
                }, 10000);

                videoElement.onloadeddata = () => {
                    clearTimeout(timeoutId);
                    showVideoLoading(resultContainerElement, false);
                    resultContainerElement.classList.remove('hidden');
                    resolve();
                };

                videoElement.onerror = () => {
                    clearTimeout(timeoutId);
                    showVideoLoading(resultContainerElement, false);
                    reject(new Error('Error al cargar el video: ' + (videoElement.error?.message || 'Error desconocido')));
                };
            });

            updateStatus('¡Video generado con éxito!');
            return { videoUrl, backgroundUrl };
        } catch (error) {
            console.error('Error en generateVideo:', error);
            updateStatus('Error generando el video: ' + error.message, 'error');
            throw error;
        } finally {
            isGenerating = false;
            generateBtn.disabled = false;
        }
    }

    // Event Listeners
    generateBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await generateVideo();
        } catch (error) {
            console.error('Error al manejar el click del botón:', error);
        }
    });

    previewAudioBtn.addEventListener('click', () => {
        if (currentStory) {
            previewAudio(currentStory);
        }
    });

    downloadBtn.addEventListener('click', async () => {
        if (currentVideoUrl) {
            try {
                const response = await fetch(currentVideoUrl);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `horror_story_${Date.now()}.mp4`;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    document.body.removeChild(link);
                }, 100);
            } catch (error) {
                console.error('Error al descargar:', error);
                alert('Error al descargar el video. Por favor, intenta de nuevo.');
            }
        }
    });

    shareBtn.addEventListener('click', async () => {
        if (currentVideoUrl && navigator.share) {
            try {
                await navigator.share({
                    title: 'Historia de Terror Generada',
                    text: '¡Mira esta historia de terror generada por IA!',
                    url: currentVideoUrl
                });
            } catch (error) {
                console.error('Error compartiendo:', error);
            }
        }
    });

    // Inicialización
    updateStatus('Listo para generar');
}); 