const { generateStory } = require('./storyGenerator');
const { convertStoryToSpeech } = require('./textToSpeech');
const { downloadVideo } = require('./videoHandler');
const { combineAudioVideo } = require('./mediaProcessor');
const fs = require('fs');
const config = require('./config');

// Función para generar el identificador de proceso
function generateProcessId() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

async function processStory(processId) {
    try {
        // Generar historia
        console.log('\n🖋️  Generating story...');
        const storyPath = await generateStory(processId);
        console.log('✅ Story generated successfully');

        // Leer y limpiar el texto de la historia
        let storyText = await fs.promises.readFile(storyPath, 'utf-8');
        
        // Limpiar el texto de marcadores markdown y otros caracteres especiales
        storyText = storyText.replace(/\*\*/g, '') // Eliminar **negrita**
                            .replace(/\*/g, '')    // Eliminar *cursiva*
                            .replace(/^#.*$/gm, '') // Eliminar encabezados
                            .replace(/^\s*[\r\n]/gm, '') // Eliminar líneas vacías
                            .trim();
        
        console.log('\n📝 Story preview:', storyText.substring(0, 100) + '...');

        // Guardar el texto limpio
        await fs.promises.writeFile(storyPath, storyText, 'utf-8');

        // Convertir a audio
        console.log('\n🎤 Converting story to speech...');
        const audioPath = await convertStoryToSpeech(storyPath);
        console.log('✅ Story converted to speech successfully');

        // Generar video
        console.log('\n🎬 Generating background video...');
        const videoPath = await downloadVideo(processId);
        console.log('✅ Background video generated successfully');

        // Combinar audio y video con subtítulos
        console.log('\n🎯 Combining audio and video with subtitles...');
        const finalVideoPath = await combineAudioVideo(audioPath, videoPath, storyText, processId);
        console.log('✅ Media combined successfully');
        console.log('\n📺 Final video saved at:', finalVideoPath);

        return finalVideoPath;
    } catch (error) {
        console.error('\n❌ Error in story processing:', error);
        throw error;
    }
}

async function main() {
    try {
        console.log('\n🎬 Horror Story Video Generator');
        console.log('===============================');
        
        const processId = generateProcessId();
        console.log('\n🔄 Process ID:', processId);

        // Crear directorios necesarios
        const directories = [
            'output',
            'output/stories',
            'output/audio',
            'output/video',
            'output/temp',
            'output/final'
        ];

        console.log('\n📁 Creating necessary directories...');
        for (const dir of directories) {
            await fs.promises.mkdir(dir, { recursive: true });
        }
        console.log('✅ Directories created successfully');

        const finalVideoPath = await processStory(processId);
        console.log('\n🎉 Process completed successfully!');
        console.log('🎥 Final video available at:', finalVideoPath);
        console.log('\nThank you for using Horror Story Video Generator!\n');
    } catch (error) {
        console.error('\n❌ An error occurred:', error);
        process.exit(1);
    }
}

// Si se ejecuta directamente (no como módulo)
if (require.main === module) {
    main();
}

module.exports = { processStory, generateProcessId }; 