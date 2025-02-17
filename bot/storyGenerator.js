const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
const config = require('./config');
require('dotenv').config({ path: '../.env' });

const openai = new OpenAI({
    apiKey: config.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
        'HTTP-Referer': 'https://github.com/yourusername/your-repo',
        'X-Title': 'Horror Story Generator'
    }
});

// Función para añadir timeout a las promesas
const withTimeout = (promise, ms) => {
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]);
};

async function generateStory(processId) {
    console.log('=== Story Generation Process Started ===');
    console.log('Using OpenRouter API with DeepSeek-R1 model');
    
    try {
        const prompt = `Escribe una historia de terror cautivadora siguiendo estos requisitos:
- Debe comenzar exactamente con esta línea: "Las sombras susurraron esta noche, y por primera vez en mi vida, les respondí."
- Longitud entre 100-150 palabras
- Incluir detalles atmosféricos y descripciones vívidas
- Construir la tensión gradualmente a lo largo de la historia
- Incluir elementos de horror psicológico
- Terminar con una revelación impactante o perturbadora
- Hacerla perfecta para narración dramática
- Debe ser en español

Escribe la historia directamente y toda en español.`;

        const response = await withTimeout(
            openai.chat.completions.create({
                model: "deepseek/deepseek-r1:free",
                messages: [{
                    role: "system",
                    content: "You are a skilled horror story writer. You excel at creating atmospheric, psychological horror stories with compelling narratives and shocking twists. Your stories are perfect for dramatic narration. Write the story in Spanish."
                }, {
                    role: "user",
                    content: prompt
                }],
                temperature: 0.9,
                top_p: 1.0,
                top_k: 0,
                frequency_penalty: 0,
                presence_penalty: 0,
                repetition_penalty: 1.0,
            }),
            180000 // 3 minutos de timeout
        );

        if (!response || !response.choices || !response.choices.length || !response.choices[0].message) {
            console.error('Invalid response structure:', response);
            throw new Error('Invalid response from OpenRouter API');
        }

        let story = response.choices[0].message.content.trim();
        
        if (!story) {
            console.error('Empty story received from API');
            throw new Error('Empty story received from API');
        }

        // Asegurarse de que la historia comience con la frase deseada
        if (!story.toLowerCase().includes("las sombras susurraron")) {
            story = "Las sombras susurraron esta noche, y por primera vez en mi vida, les respondí. " + story;
        }

        console.log(`Generated text (first 100 chars): ${story.substring(0, 100)}...`);
        console.log('Successfully generated story using DeepSeek-R1');
        console.log('Story length:', story.length, 'characters');
        console.log('Word count:', story.split(/\s+/).length);

        // Save the story
        const filename = `story_${processId}.txt`;
        const filepath = path.join(__dirname, 'output', 'stories', filename);

        await fs.writeFile(filepath, story, 'utf-8');
        console.log('Story saved to:', filepath);
        return filepath;
    } catch (error) {
        console.error('Story generation failed:', error);
        throw error;
    }
}

module.exports = { generateStory };