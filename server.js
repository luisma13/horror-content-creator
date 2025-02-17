const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 8080;

// Configurar headers de seguridad
app.use((req, res, next) => {
    // Headers necesarios para SharedArrayBuffer y CORS
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Headers adicionales de seguridad
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Si es una solicitud OPTIONS, responder inmediatamente
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    next();
});

// Configurar body parser para JSON
app.use(express.json());

// Endpoint para text-to-speech
app.post('/api/tts', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Se requiere el texto' });
        }

        // Hacer la petición a Google TTS
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=es&client=tw-ob`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Error al obtener el audio');
        }

        // Obtener el buffer de audio
        const buffer = await response.buffer();

        // Enviar el audio como respuesta
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(buffer);
    } catch (error) {
        console.error('Error en TTS:', error);
        res.status(500).json({ error: 'Error al generar el audio' });
    }
});

// Servir archivos estáticos con las cabeceras correctas
app.use(express.static('public', {
    setHeaders: (res, path) => {
        // Asegurarse de que los archivos JavaScript se sirven con el tipo MIME correcto
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        }
    }
}));

// Configuración SSL
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'certificates', 'cert.key')),
    cert: fs.readFileSync(path.join(__dirname, 'certificates', 'cert.crt'))
};

// Crear servidor HTTPS
const server = https.createServer(sslOptions, app);

// Manejar errores del servidor
server.on('error', (error) => {
    console.error('Error en el servidor:', error);
});

// Iniciar el servidor
server.listen(PORT, () => {
    console.log(`Servidor seguro ejecutándose en https://localhost:${PORT}`);
    console.log('Headers de seguridad configurados:');
    console.log('- Cross-Origin-Opener-Policy: same-origin');
    console.log('- Cross-Origin-Embedder-Policy: require-corp');
    console.log('- Cross-Origin-Resource-Policy: cross-origin');
}); 