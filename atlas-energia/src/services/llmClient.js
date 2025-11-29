/**
 * Cliente LLM para integración con Gemini API
 * ==================================================
 * Servicio reutilizable para realizar consultas al modelo de lenguaje
 * con contexto especializado en energías renovables para Colombia
 * 
 * @module llmClient
 * @author Atlas Energético
 */

/**
 * Realizar consulta al LLM de Gemini con contexto especializado
 * @param {Object} params - Parámetros de la consulta
 * @param {Array<{role: string, text: string}>} params.messages - Historial de mensajes
 * @param {string} params.systemPrompt - Prompt del sistema con instrucciones
 * @returns {Promise<string>} - Respuesta del modelo en texto plano
 * @throws {Error} - Si hay error en la API o en el procesamiento
 */
export async function askEnergyLLM({ messages, systemPrompt }) {
  try {
    // Obtener API key desde variables de entorno
    const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!API_KEY) {
      throw new Error('API key no configurada. Verifica tu archivo .env');
    }

    // Endpoint de Gemini con API key como query parameter
    const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    // Construir el array de contenidos en formato Gemini
    // La API de Gemini requiere alternar roles: user -> model -> user -> model
    const contents = buildGeminiContents(messages, systemPrompt);
    
    // Realizar la petición a la API
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      }),
    });

    // Validar respuesta HTTP
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error?.message || `HTTP ${response.status}`;
      throw new Error(`Error en la API de Gemini: ${errorMessage}`);
    }

    // Parsear respuesta JSON
    const data = await response.json();
    
    // Extraer el texto de la respuesta del modelo
    // Estructura: data.candidates[0].content.parts[0].text
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('La API no devolvió candidatos de respuesta');
    }

    const candidate = data.candidates[0];
    
    // Verificar si la respuesta fue bloqueada por filtros de seguridad
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('La respuesta fue bloqueada por filtros de seguridad');
    }

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('La respuesta del modelo está vacía');
    }

    const botReply = candidate.content.parts[0].text;
    
    return botReply;

  } catch (error) {
    // Log del error para debugging (sin exponer API key)
    console.error('Error en askEnergyLLM:', {
      message: error.message,
      name: error.name,
      // NO logear API_KEY por seguridad
    });

    // Lanzar error con mensaje amigable
    if (error.message.includes('API key')) {
      throw new Error('Configuración de API incorrecta');
    } else if (error.message.includes('fetch')) {
      throw new Error('No se pudo conectar con el servicio de IA');
    } else if (error.message.includes('JSON')) {
      throw new Error('Error procesando la respuesta del modelo');
    } else {
      throw error; // Re-lanzar el error original
    }
  }
}

/**
 * Construir el array de contenidos en formato esperado por Gemini
 * Gemini requiere que los mensajes alternen entre 'user' y 'model'
 * 
 * @param {Array<{role: string, text: string}>} messages - Mensajes del usuario/bot
 * @param {string} systemPrompt - Instrucciones del sistema
 * @returns {Array<{role: string, parts: Array<{text: string}>}>}
 */
function buildGeminiContents(messages, systemPrompt) {
  const contents = [];

  // Si hay un system prompt, incluirlo como primer mensaje del usuario
  // con las instrucciones del sistema
  if (systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: systemPrompt }]
    });
    
    // Gemini requiere que después de un user venga un model
    // Agregamos una confirmación breve del modelo
    contents.push({
      role: 'model',
      parts: [{ text: 'Entendido. Actuaré como asistente especializado en energías renovables para Colombia, siguiendo las instrucciones proporcionadas.' }]
    });
  }

  // Mapear los mensajes de la conversación
  for (const msg of messages) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    });
  }

  return contents;
}

/**
 * Construir el prompt del sistema con instrucciones especializadas
 * @param {string} userType - Tipo de usuario: 'ejecutivo' | 'tecnico' | 'ciudadano'
 * @param {string} technicalContext - Contexto técnico con datos del departamento
 * @returns {string} - System prompt completo
 */
export function buildSystemPrompt(userType, technicalContext = '') {
  const baseInstructions = `Eres un asistente especializado en energías renovables para Colombia, con conocimiento profundo del contexto territorial colombiano.

CONTEXTO TÉCNICO:
${technicalContext}

REGLAS GENERALES:
1. Usa SIEMPRE los datos proporcionados en el contexto técnico como fuente principal
2. Indica claramente el potencial energético dominante (solar, eólico o híbrido)
3. Explica brevemente las razones basadas en factores climáticos y geográficos
4. Proporciona recomendaciones prácticas de inversión cuando sea relevante
5. Advierte explícitamente cuando los datos tengan alta incertidumbre
6. Menciona si la región tiene zonas no interconectadas (ZNI) cuando aplique
7. Mantén un tono profesional pero accesible
8. Responde en español colombiano
9. Si no tienes información suficiente, dilo claramente`;

  // Ajustar el tono según el tipo de usuario
  let toneInstructions = '';

  switch (userType) {
    case 'ejecutivo':
      toneInstructions = `
TONO EJECUTIVO:
- Respuestas concisas y orientadas a negocio
- Enfoca en ROI, CAPEX, payback period
- Menciona escalas de proyecto (kW, MW)
- Resalta incentivos fiscales y oportunidades de mercado
- Usa términos financieros: rentabilidad, retorno de inversión, viabilidad económica
- Ejemplo: "El departamento presenta un ROI estimado de 6-8 años para instalaciones solares de 100kW+"`;
      break;

    case 'tecnico':
      toneInstructions = `
TONO TÉCNICO:
- Proporciona detalles técnicos relevantes
- Menciona valores específicos: radiación (kWh/m²/día), velocidad del viento (m/s), temperatura (°C)
- Explica factores geográficos: altitud, clima, coordenadas
- Usa terminología técnica apropiada: irradiación, factor de capacidad, eficiencia
- Menciona consideraciones de diseño e instalación
- Ejemplo: "Con radiación promedio de 4.8 kWh/m²/día y altitud de 1,500 msnm, se estima un factor de capacidad de 18-20% para sistemas fotovoltaicos"`;
      break;

    case 'ciudadano':
    default:
      toneInstructions = `
TONO CIUDADANO:
- Usa explicaciones sencillas y ejemplos cotidianos
- Evita jerga técnica excesiva
- Compara con situaciones familiares (ej: "suficiente para alimentar X hogares")
- Enfoca en beneficios prácticos: ahorro en factura, autonomía energética, medio ambiente
- Usa lenguaje accesible y motivador
- Ejemplo: "Esta región tiene excelente brillo solar, similar a tener el equivalente a 5 horas de sol intenso cada día, ideal para paneles en casas o fincas"`;
      break;
  }

  return `${baseInstructions}\n${toneInstructions}`;
}
