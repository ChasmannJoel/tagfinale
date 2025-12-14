// ============================================
// DETECTOR DE PRIMER MENSAJE Y HORA
// ============================================

const MessageDetector = {
  
  /**
   * Obtiene el contenedor de mensajes de la conversación abierta
   * @returns {HTMLElement|null} Contenedor de mensajes
   */
  getMessagesContainer() {
    // El contenedor principal de mensajes
    const container = document.querySelector('.MuiBox-root.mui-ylizsf');
    
    if (!container) {
      console.warn('[MessageDetector] ❌ No se encontró el contenedor de mensajes');
      return null;
    }
    
    console.log('[MessageDetector] ✅ Contenedor de mensajes encontrado');
    return container;
  },
  
  /**
   * Obtiene el primer mensaje de la conversación
   * @returns {HTMLElement|null} Elemento del primer mensaje
   */
  getFirstMessage() {
    const container = this.getMessagesContainer();
    
    if (!container) {
      return null;
    }
    
    // Buscar el primer div con id que comience con "message-"
    const firstMessage = container.querySelector('div[id^="message-"]');
    
    if (!firstMessage) {
      console.warn('[MessageDetector] ❌ No se encontró el primer mensaje');
      return null;
    }
    
    console.log('[MessageDetector] ✅ Primer mensaje encontrado:', firstMessage.id);
    return firstMessage;
  },
  
  /**
   * Extrae la URL del primer mensaje (enlace de Facebook Ads)
   * @returns {string|null} URL del primer mensaje
   */
  getFirstMessageURL() {
    const firstMessage = this.getFirstMessage();
    
    if (!firstMessage) {
      return null;
    }
    
    // Buscar el enlace <a> con clase .mui-b0xk03 o cualquier enlace dentro del mensaje
    const linkElement = firstMessage.querySelector('a[href^="https://fb.me"]') || 
                       firstMessage.querySelector('.message-content a[href]');
    
    if (!linkElement) {
      console.warn('[MessageDetector] ❌ No se encontró URL en el primer mensaje');
      return null;
    }
    
    const url = linkElement.getAttribute('href');
    console.log('[MessageDetector] ✅ URL del primer mensaje:', url);
    
    return url;
  },
  
  /**
   * Obtiene la información de tiempo del primer mensaje
   * @returns {Object|null} {relativeTime, timestamp, formattedTime}
   */
  getFirstMessageTime() {
    const firstMessage = this.getFirstMessage();
    
    if (!firstMessage) {
      return null;
    }
    
    // Buscar el div con aria-label que contiene la fecha/hora
    const timeContainer = firstMessage.querySelector('.MuiBox-root.mui-186zjq8[aria-label]');
    
    if (!timeContainer) {
      console.warn('[MessageDetector] ❌ No se encontró información de tiempo');
      return null;
    }
    
    // El aria-label contiene la fecha completa: "09/12/2025 a las 06:42 PM"
    const fullTimestamp = timeContainer.getAttribute('aria-label');
    
    // Buscar el texto de tiempo relativo ("20 minutos", "1 hora", etc.)
    const timeElements = timeContainer.querySelectorAll('p.MuiTypography-root.mui-2ehu0i');
    let relativeTime = null;
    
    // El último elemento suele contener el tiempo relativo
    for (let i = timeElements.length - 1; i >= 0; i--) {
      const text = timeElements[i].textContent.trim();
      if (text.includes('minuto') || text.includes('hora') || text.includes('día')) {
        relativeTime = text;
        break;
      }
    }
    
    console.log('[MessageDetector] ✅ Tiempo encontrado:', {
      fullTimestamp,
      relativeTime
    });
    
    return {
      fullTimestamp,      // "09/12/2025 a las 06:42 PM"
      relativeTime,       // "20 minutos"
      calculatedTime: this.calculateExactTime(relativeTime)
    };
  },
  
  /**
   * Calcula la hora exacta basándose en el tiempo relativo
   * @param {string} relativeTime - Ej: "20 minutos", "1 hora", "2 días"
   * @returns {string} Hora en formato "HH:MM" (Argentina timezone)
   */
  calculateExactTime(relativeTime) {
    if (!relativeTime) {
      return null;
    }
    
    // Obtener hora actual en Argentina (UTC-3)
    const now = new Date();
    
    // Extraer número y unidad
    const match = relativeTime.match(/(\d+)\s*(minuto|hora|día|mes|año)/i);
    
    if (!match) {
      console.warn('[MessageDetector] ⚠️ No se pudo parsear tiempo relativo:', relativeTime);
      return null;
    }
    
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    // Calcular diferencia en milisegundos
    let diff = 0;
    switch (unit) {
      case 'minuto':
        diff = amount * 60 * 1000;
        break;
      case 'hora':
        diff = amount * 60 * 60 * 1000;
        break;
      case 'día':
        diff = amount * 24 * 60 * 60 * 1000;
        break;
      case 'mes':
        diff = amount * 30 * 24 * 60 * 60 * 1000;
        break;
      case 'año':
        diff = amount * 365 * 24 * 60 * 60 * 1000;
        break;
    }
    
    // Restar el tiempo para obtener la hora del mensaje
    const messageDate = new Date(now.getTime() - diff);
    
    // Formatear como HH:MM
    const hours = messageDate.getHours().toString().padStart(2, '0');
    const minutes = messageDate.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;
    
    console.log('[MessageDetector] 🕐 Hora calculada:', formattedTime);
    
    return formattedTime;
  },
  
  /**
   * Obtiene toda la información del primer mensaje
   * @returns {Object|null} {url, timestamp, relativeTime, calculatedTime}
   */
  getFirstMessageInfo() {
    console.log('\n[MessageDetector] 🔍 Extrayendo información del primer mensaje...\n');
    
    const url = this.getFirstMessageURL();
    const timeInfo = this.getFirstMessageTime();
    
    if (!url && !timeInfo) {
      console.warn('[MessageDetector] ❌ No se pudo extraer información del mensaje');
      return null;
    }
    
    const result = {
      url: url,
      fullTimestamp: timeInfo?.fullTimestamp || null,
      relativeTime: timeInfo?.relativeTime || null,
      calculatedTime: timeInfo?.calculatedTime || null
    };
    
    console.log('[MessageDetector] ✅ Información extraída:', result);
    
    return result;
  },
  
  /**
   * Método visual: resalta el primer mensaje y su información
   */
  highlightFirstMessage() {
    const firstMessage = this.getFirstMessage();
    
    if (firstMessage) {
      firstMessage.style.border = '3px solid blue';
      firstMessage.style.backgroundColor = 'rgba(0, 0, 255, 0.1)';
      
      const linkElement = firstMessage.querySelector('a[href]');
      if (linkElement) {
        linkElement.style.border = '2px solid red';
        linkElement.style.padding = '5px';
      }
      
      const timeContainer = firstMessage.querySelector('.mui-186zjq8');
      if (timeContainer) {
        timeContainer.style.backgroundColor = 'yellow';
        timeContainer.style.padding = '5px';
        timeContainer.style.fontWeight = 'bold';
      }
      
      console.log('[MessageDetector] ✅ Primer mensaje resaltado');
      
      // Restaurar después de 5 segundos
      setTimeout(() => {
        firstMessage.style.border = '';
        firstMessage.style.backgroundColor = '';
        if (linkElement) {
          linkElement.style.border = '';
          linkElement.style.padding = '';
        }
        if (timeContainer) {
          timeContainer.style.backgroundColor = '';
          timeContainer.style.padding = '';
          timeContainer.style.fontWeight = '';
        }
        console.log('[MessageDetector] 🔄 Estilos restaurados');
      }, 5000);
    } else {
      console.warn('[MessageDetector] ❌ No se pudo resaltar (mensaje no encontrado)');
    }
  }
};

// ============================================
// INSTRUCCIONES DE USO
// ============================================

console.log(`
╔════════════════════════════════════════════════════════════╗
║   📨 MESSAGE DETECTOR - EXTRACTOR DE MENSAJES             ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  INSTRUCCIONES:                                            ║
║  1. Abre una conversación en Clientify                    ║
║  2. Ejecuta los siguientes comandos:                       ║
║                                                            ║
║  📌 OBTENER TODO (RECOMENDADO):                           ║
║     MessageDetector.getFirstMessageInfo()                 ║
║                                                            ║
║  📌 SOLO URL:                                             ║
║     MessageDetector.getFirstMessageURL()                  ║
║                                                            ║
║  📌 SOLO HORA:                                            ║
║     MessageDetector.getFirstMessageTime()                 ║
║                                                            ║
║  📌 RESALTAR PRIMER MENSAJE:                              ║
║     MessageDetector.highlightFirstMessage()               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

// Exportar para uso global
window.MessageDetector = MessageDetector;

console.log('✅ MessageDetector cargado y listo para usar');
