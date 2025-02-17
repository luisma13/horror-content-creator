const path = require('path');
const dotenv = require('dotenv');

// Cargar el archivo .env desde el directorio raíz del proyecto
const envPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.warn(`
⚠️  No se encontró el archivo .env en la ruta: ${envPath}
    
Por favor, crea un archivo .env en la raíz del proyecto con el siguiente contenido:

OPENROUTER_API_KEY=tu_clave_de_openrouter_aquí
PEXELS_API_KEY=tu_clave_de_pexels_aquí

# Opcional para Amazon Polly (si deseas usar TTS de Amazon)
AWS_ACCESS_KEY_ID=tu_clave_de_aws_aquí
AWS_SECRET_ACCESS_KEY=tu_clave_secreta_de_aws_aquí
AWS_REGION=us-east-1

# Servicio de TTS a utilizar ('google' o 'amazon')
TTS_SERVICE=google

Error: ${result.error.message}
`);
}

// Configuración por defecto
const config = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    PEXELS_API_KEY: process.env.PEXELS_API_KEY,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    TTS_SERVICE: process.env.TTS_SERVICE || 'google'
};

// Verificar configuración requerida
const requiredKeys = ['OPENROUTER_API_KEY', 'PEXELS_API_KEY'];
const missingKeys = requiredKeys.filter(key => !config[key]);

if (missingKeys.length > 0) {
    console.error(`
❌ Error: Faltan variables de entorno requeridas

Las siguientes variables son necesarias para el funcionamiento del bot:
${missingKeys.map(key => `   - ${key}`).join('\n')}

Por favor, asegúrate de que tu archivo .env contenga estas variables.
La ruta del archivo .env debe ser: ${envPath}

Ejemplo de contenido mínimo necesario:

OPENROUTER_API_KEY=tu_clave_de_openrouter_aquí
PEXELS_API_KEY=tu_clave_de_pexels_aquí
`);
    process.exit(1);
}

module.exports = config; 