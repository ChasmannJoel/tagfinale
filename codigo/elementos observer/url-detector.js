// ============================================
// URL DETECTOR - Extractor de URLs de mensajes
// ============================================

// Configuración de paneles (ID y nombres)
// Se usa búsqueda parcial para soportar variantes como "Goatgaming" y "Goatgaming2"
let PANELES_CONFIG = [
  {id: 10, nombres: ["Goatgaming", "Goatgaming2"]},
  {id: 12, nombres: ["ThiagoP", "ThiagoP2"]},
  {id: 1, nombres: ["Oporto"]},
  {id: 18, nombres: ["PruebaPY"]},
  {id: 22, nombres: ["Prueba2"]},
  {id: 23, nombres: ["TestRespond"]},
  {id: 24, nombres: ["Manga"]},
  {id: 26, nombres: ["Scalo"]},
  {id: 27, nombres: ["Pruebagg"]},
  {id: 5, nombres: ["Trebol", "Treboldorado", "Treboldorado2"]},
  {id: 20, nombres: ["Cocan"]},
  {id: 16, nombres: ["Scaloneta"]},
  {id: 32, nombres: ["Opulix"]},
  {id: 19, nombres: ["Denver"]},
  {id: 33, nombres: ["Godzilla"]},
  {id: 34, nombres: ["Nova"]},
  {id: 35, nombres: ["Martina"]},
  {id: 36, nombres: ["Florida"]}
];

// URL de la API para obtener paneles
const PANELES_API_URL = 'http://148.230.72.182:3066/paneles?secret=tu_clave_super_secreta';

const urlDetector = {
  panelesCache: null, // Cache de paneles de la API
  cacheCargado: false,
  
  /**
   * Carga los paneles desde la API y los cachea
   * @returns {Promise<Array>}
   */
  async cargarPanelesDesdeAPI() {
    if (this.cacheCargado && this.panelesCache) {
      return this.panelesCache;
    }
    
    try {
      console.log('🔄 Cargando paneles desde API...');
      const response = await fetch(PANELES_API_URL);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transformar formato de API a formato interno
      // La API devuelve: {ok: true, paneles: [{id: 10, nombre: "Goatgaming2"}, ...]}
      if (data.ok && data.paneles && Array.isArray(data.paneles)) {
        this.panelesCache = data.paneles.map(p => ({
          id: p.id,
          nombres: [p.nombre]
        }));
        this.cacheCargado = true;
        console.log(`✅ ${this.panelesCache.length} paneles cargados desde API`);
        return this.panelesCache;
      }
      
      console.warn('⚠️ Formato de respuesta inesperado de la API');
      return [];
    } catch (error) {
      console.error('❌ Error cargando paneles desde API:', error);
      return [];
    }
  },
  
  /**
   * Busca un panel por nombre en la configuración local y en la API
   * @param {string} nombreNormalizado - Nombre del panel normalizado
   * @returns {Promise<Object|null>} {id, nombre} o null si no se encuentra
   */
  async buscarPanelPorNombre(nombreNormalizado) {
    // 1. Buscar primero en configuración local
    for (const panel of PANELES_CONFIG) {
      for (const nombre of panel.nombres) {
        if (nombreNormalizado.toLowerCase().includes(nombre.toLowerCase()) ||
            nombre.toLowerCase().includes(nombreNormalizado.toLowerCase())) {
          return { id: panel.id, nombre: nombre };
        }
      }
    }
    
    // 2. Si no se encuentra, buscar en la API
    console.log(`🔍 Panel "${nombreNormalizado}" no encontrado localmente, consultando API...`);
    const panelesAPI = await this.cargarPanelesDesdeAPI();
    
    for (const panel of panelesAPI) {
      for (const nombre of panel.nombres) {
        if (nombreNormalizado.toLowerCase().includes(nombre.toLowerCase()) ||
            nombre.toLowerCase().includes(nombreNormalizado.toLowerCase())) {
          console.log(`✅ Panel encontrado en API: ${nombre} (ID: ${panel.id})`);
          
          // Agregar a la configuración local para futuras búsquedas
          PANELES_CONFIG.push(panel);
          
          return { id: panel.id, nombre: nombre };
        }
      }
    }
    
    return null; // No encontrado
  },
  
  /**
   * Extrae TODAS las URLs de Meta del chat que sean de HOY
   * Si no hay URLs pero el primer mensaje es de hoy, genera nomenclatura sin letra
   * @returns {Object|null} {url, panel, timestamp, nomenclatura, urlsDeHoy}
   */
  async extractUrlFromChat() {
    // Verificar que hay un chat abierto
    const chatWindow = document.querySelector('.mui-npbckn');
    if (!chatWindow) {
      return null;
    }
    
    const panel = this.getPanelName();
    
    // Buscar TODOS los mensajes con URLs de Meta que sean de HOY
    const urlsDeHoy = this.getAllMetaUrlsFromToday();
    
    // Si no hay URLs de Meta, verificar si el PRIMER mensaje es de hoy
    if (urlsDeHoy.length === 0) {
      const primerMensajeInfo = this.getFirstMessageTime();
      
      if (primerMensajeInfo && this.esMensajeDeHoy(primerMensajeInfo)) {
        console.log('📝 [URL Detector] Sin URLs de Meta, pero primer mensaje es de HOY');
        
        // Generar nomenclatura sin letra de campaña
        const nomenclaturaBase = await this.generarNomenclatura(panel);
        
        // Verificar si el cliente cargó
        const clienteCargo = this.detectarMensajeDeCarga();
        const nomenclaturaFinal = clienteCargo ? `${nomenclaturaBase}!` : nomenclaturaBase;
        
        const estadoCarga = clienteCargo ? '✅ CARGÓ' : '⏳ Pendiente';
        console.log(`🏷️ ${nomenclaturaFinal} [Sin URL] | ${estadoCarga}`);
        
        return {
          url: 'Sin URL',
          urlsDeHoy: [],
          cantidadUrlsHoy: 0,
          nomenclatura: nomenclaturaFinal,
          panelOriginal: panel || 'Sin panel',
          timestamp: primerMensajeInfo.fullTimestamp,
          relativeTime: primerMensajeInfo.relativeTime,
          calculatedTime: primerMensajeInfo.calculatedTime,
          letraCampana: null,
          tieneCampana: false,
          clienteCargo: clienteCargo
        };
      }
      
      console.log('⏭️ [URL Detector] No hay URLs de Meta de HOY ni primer mensaje de HOY');
      return null;
    }
    
    console.log(`📊 [URL Detector] Encontradas ${urlsDeHoy.length} URLs de Meta de HOY`);
    
    // Generar nomenclatura base (sin letra de campaña)
    const nomenclaturaBase = await this.generarNomenclatura(panel);
    
    // Verificar si el cliente cargó (mensaje de acreditación)
    const clienteCargo = this.detectarMensajeDeCarga();
    
    // Generar nomenclatura para CADA URL diferente
    const nomenclaturas = [];
    const urlsUnicas = new Map(); // Para evitar URLs duplicadas
    
    for (let i = 0; i < urlsDeHoy.length; i++) {
      const urlItem = urlsDeHoy[i];
      
      // Evitar URLs duplicadas
      if (urlsUnicas.has(urlItem.url)) continue;
      urlsUnicas.set(urlItem.url, true);
      
      // Obtener letra de campaña para esta URL
      const letraCampana = urlMapper.getLetraCampana(urlItem.url, panel);
      
      // Si no tiene letra, esperar (pausar observer)
      if (!letraCampana) {
        // La primera URL sin letra pausa todo
        const result = {
          url: urlItem.url,
          urlsDeHoy: urlsDeHoy,
          cantidadUrlsHoy: urlsDeHoy.length,
          nomenclatura: nomenclaturaBase, // Sin letra aún
          panelOriginal: panel || 'Sin panel',
          timestamp: urlItem.timeInfo?.fullTimestamp || 'Sin timestamp',
          relativeTime: urlItem.timeInfo?.relativeTime || 'Sin hora',
          calculatedTime: urlItem.timeInfo?.calculatedTime || 'Sin hora calculada',
          letraCampana: null,
          tieneCampana: false,
          clienteCargo: clienteCargo
        };
        
        console.log(`⏸️ [URL Detector] URL sin letra, pausando...`);
        return result;
      }
      
      // Construir nomenclatura completa
      const nomenclaturaCompleta = `${nomenclaturaBase}${letraCampana}`;
      
      // Solo la PRIMERA nomenclatura lleva signo si hay carga
      const esPrimera = i === 0;
      const nomenclaturaFinal = (clienteCargo && esPrimera) 
        ? `${nomenclaturaCompleta}!`
        : nomenclaturaCompleta;
      
      nomenclaturas.push({
        nomenclatura: nomenclaturaFinal,
        letra: letraCampana,
        url: urlItem.url,
        tieneCarga: clienteCargo && esPrimera
      });
    }
    
    // Usar la primera URL como principal
    const urlPrincipal = urlsDeHoy[0].url;
    const timeInfo = urlsDeHoy[0].timeInfo;
    
    const result = {
      url: urlPrincipal,
      urlsDeHoy: urlsDeHoy,
      cantidadUrlsHoy: urlsDeHoy.length,
      nomenclatura: nomenclaturas[0].nomenclatura, // Primera nomenclatura (para compatibilidad)
      nomenclaturas: nomenclaturas, // TODAS las nomenclaturas generadas
      panelOriginal: panel || 'Sin panel',
      timestamp: timeInfo?.fullTimestamp || 'Sin timestamp',
      relativeTime: timeInfo?.relativeTime || 'Sin hora',
      calculatedTime: timeInfo?.calculatedTime || 'Sin hora calculada',
      letraCampana: nomenclaturas[0].letra,
      tieneCampana: true,
      clienteCargo: clienteCargo
    };
    
    // Log simplificado
    const estadoCarga = clienteCargo ? '✅ CARGÓ' : '⏳ Pendiente';
    const nomenclaturasStr = nomenclaturas.map(n => n.nomenclatura).join(', ');
    console.log(`🏷️ ${nomenclaturasStr} | ${urlsDeHoy.length} URL(s) de hoy | ${estadoCarga}`);
    
    return result;
  },
  
  /**
   * Detecta si hay mensaje de carga (acreditación) en la conversación
   * Busca solo en mensajes del agente de HOY
   * @returns {boolean}
   */
  detectarMensajeDeCarga() {
    const messagesContainer = document.querySelector('.MuiBox-root.mui-ylizsf');
    if (!messagesContainer) {
      return false;
    }
    
    // Frase que indica que el cliente cargó (normalizada)
    const fraseObjetivo = 'segui los pasos a continuacion para que tu acr3dit4ci0n se procese sin demoras';
    
    // Obtener TODOS los mensajes
    const allMessages = messagesContainer.querySelectorAll('div[id^="message-"]');
    
    for (const message of allMessages) {
      // Verificar que el mensaje sea de HOY
      const timeContainer = message.querySelector('.MuiBox-root.mui-186zjq8[aria-label]');
      if (!timeContainer) continue;
      
      const fullTimestamp = timeContainer.getAttribute('aria-label');
      const timeElements = timeContainer.querySelectorAll('p.MuiTypography-root.mui-2ehu0i');
      let relativeTime = null;
      
      for (let i = timeElements.length - 1; i >= 0; i--) {
        const text = timeElements[i].textContent.trim();
        if (text.includes('minuto') || text.includes('hora') || text.includes('día')) {
          relativeTime = text;
          break;
        }
      }
      
      const timeInfo = {
        fullTimestamp: fullTimestamp,
        relativeTime: relativeTime,
        calculatedTime: this.calculateExactTime(relativeTime)
      };
      
      // Solo buscar en mensajes de HOY
      if (!this.esMensajeDeHoy(timeInfo)) continue;
      
      // Verificar si es mensaje del AGENTE (no del cliente)
      // Los mensajes del agente tienen clase específica o están alineados a la izquierda
      const esDelCliente = message.querySelector('[data-contact-message="true"]') || 
                          message.classList.contains('contact-message');
      
      if (esDelCliente) continue; // Saltar mensajes del cliente
      
      // Buscar la frase en todos los <p> del mensaje
      const paragraphs = message.querySelectorAll('p');
      for (const p of paragraphs) {
        const textoNormalizado = p.textContent
          .toLowerCase()
          .replace(/[áàäâ]/g, 'a')
          .replace(/[éèëê]/g, 'e')
          .replace(/[íìïî]/g, 'i')
          .replace(/[óòöô]/g, 'o')
          .replace(/[úùüû]/g, 'u')
          .replace(/[.,!?¿¡]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (textoNormalizado.includes(fraseObjetivo)) {
          console.log('✅ [URL Detector] Mensaje de CARGA detectado');
          return true;
        }
      }
    }
    
    return false;
  },
  
  /**
   * Obtiene TODAS las URLs de Meta (fb.me, instagram.com/p/) que sean de HOY
   * @returns {Array} [{url, timeInfo, esDeHoy}, ...]
   */
  getAllMetaUrlsFromToday() {
    const messagesContainer = document.querySelector('.MuiBox-root.mui-ylizsf');
    if (!messagesContainer) {
      return [];
    }
    
    // Obtener TODOS los mensajes
    const allMessages = messagesContainer.querySelectorAll('div[id^="message-"]');
    const urlsDeHoy = [];
    
    allMessages.forEach((message, index) => {
      // Buscar enlaces de Meta (Facebook o Instagram)
      const links = message.querySelectorAll('a[href]');
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        
        // Verificar si es URL de Meta (Facebook Ads o Instagram)
        if (href && (href.startsWith('https://fb.me') || href.includes('instagram.com/p/'))) {
          // Obtener información de tiempo de este mensaje
          const timeContainer = message.querySelector('.MuiBox-root.mui-186zjq8[aria-label]');
          
          if (timeContainer) {
            const fullTimestamp = timeContainer.getAttribute('aria-label');
            const timeElements = timeContainer.querySelectorAll('p.MuiTypography-root.mui-2ehu0i');
            let relativeTime = null;
            
            for (let i = timeElements.length - 1; i >= 0; i--) {
              const text = timeElements[i].textContent.trim();
              if (text.includes('minuto') || text.includes('hora') || text.includes('día')) {
                relativeTime = text;
                break;
              }
            }
            
            const timeInfo = {
              fullTimestamp: fullTimestamp,
              relativeTime: relativeTime,
              calculatedTime: this.calculateExactTime(relativeTime)
            };
            
            // Verificar si este mensaje es de HOY
            if (this.esMensajeDeHoy(timeInfo)) {
              urlsDeHoy.push({
                url: href,
                timeInfo: timeInfo,
                messageIndex: index
              });
            }
          }
        }
      });
    });
    
    return urlsDeHoy;
  },
  
  /**
   * Obtiene la URL del primer mensaje
   * @returns {string|null}
   */
  getFirstMessageURL() {
    // Esperar un momento para que cargue el contenedor
    let messagesContainer = document.querySelector('.MuiBox-root.mui-ylizsf');
    
    // Intentar selectores alternativos
    if (!messagesContainer) {
      messagesContainer = document.querySelector('[class*="mui-ylizsf"]');
    }
    
    if (!messagesContainer) {
      // Buscar directamente el mensaje en la ventana de chat
      const chatWindow = document.querySelector('.mui-npbckn');
      if (chatWindow) {
        const firstMsg = chatWindow.querySelector('div[id^="message-"]');
        if (firstMsg) {
          messagesContainer = firstMsg.parentElement;
        }
      }
    }
    
    if (!messagesContainer) {
      console.warn('[URL Detector] ❌ No se encontró el contenedor de mensajes');
      return null;
    }
    
    const firstMessage = messagesContainer.querySelector('div[id^="message-"]');
    if (!firstMessage) return null;
    
    const link = firstMessage.querySelector('a[href^="https://fb.me"]');
    if (!link) return null;
    
    return link.getAttribute('href');
  },
  
  /**
   * Obtiene el nombre del panel asignado
   * @returns {string|null}
   */
  getPanelName() {
    const container = document.querySelector('div[aria-label="Asignar conversación"]');
    if (!container) return null;
    
    const panelNameElement = container.querySelector('p.MuiTypography-root.MuiTypography-body1.mui-1586szk');
    if (!panelNameElement) return null;
    
    return panelNameElement.textContent.trim();
  },
  
  /**
   * Obtiene la información de tiempo del primer mensaje
   * @returns {Object|null} {fullTimestamp, relativeTime, calculatedTime}
   */
  getFirstMessageTime() {
    const messagesContainer = document.querySelector('.MuiBox-root.mui-ylizsf');
    if (!messagesContainer) return null;
    
    const firstMessage = messagesContainer.querySelector('div[id^="message-"]');
    if (!firstMessage) return null;
    
    const timeContainer = firstMessage.querySelector('.MuiBox-root.mui-186zjq8[aria-label]');
    if (!timeContainer) return null;
    
    const fullTimestamp = timeContainer.getAttribute('aria-label');
    const timeElements = timeContainer.querySelectorAll('p.MuiTypography-root.mui-2ehu0i');
    let relativeTime = null;
    
    for (let i = timeElements.length - 1; i >= 0; i--) {
      const text = timeElements[i].textContent.trim();
      if (text.includes('minuto') || text.includes('hora') || text.includes('día')) {
        relativeTime = text;
        break;
      }
    }
    
    return {
      fullTimestamp: fullTimestamp,
      relativeTime: relativeTime,
      calculatedTime: this.calculateExactTime(relativeTime)
    };
  },
  
  /**
   * Verifica si el mensaje es de hoy (00:00 a 23:59 hora Argentina)
   * @param {Object} timeInfo - Información de tiempo del mensaje
   * @returns {boolean}
   */
  esMensajeDeHoy(timeInfo) {
    if (!timeInfo || !timeInfo.fullTimestamp) return false;
    
    const timestamp = timeInfo.fullTimestamp;
    
    // Si dice "Hace X minutos/horas" es de hoy
    if (timestamp.includes('minuto') || timestamp.includes('hora')) {
      return true;
    }
    
    // Si tiene fecha específica, verificar que sea hoy
    const fechaHoyArg = new Date().toLocaleDateString('es-AR', { 
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    const fechaMatch = timestamp.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (fechaMatch) {
      const fechaMensaje = `${fechaMatch[1].padStart(2, '0')}/${fechaMatch[2].padStart(2, '0')}/${fechaMatch[3]}`;
      return fechaMensaje === fechaHoyArg;
    }
    
    return false;
  },
  
  /**
   * Genera la nomenclatura del mensaje: DD-MM-ID (sin letra por defecto)
   * La letra de campaña se agrega después si existe
   * @param {string} panelNombre - Nombre del panel (puede incluir "Panel" como prefijo)
   * @returns {Promise<string>} Nomenclatura base generada (sin letra)
   */
  async generarNomenclatura(panelNombre) {
    if (!panelNombre || panelNombre === 'Sin panel') {
      console.warn('[URL Detector] ⚠️ Panel inválido, usando nomenclatura por defecto');
      return this.generarNomenclaturaPorDefecto();
    }
    
    // Normalizar: quitar "Panel" del inicio y espacios
    let nombreNormalizado = panelNombre.replace(/^Panel\s*/i, '').trim();
    
    // Buscar el panel (primero local, luego API)
    const panelEncontrado = await this.buscarPanelPorNombre(nombreNormalizado);
    
    let panelId = '0';
    if (panelEncontrado) {
      panelId = String(panelEncontrado.id);
    } else {
      console.warn(`⚠️ Panel "${nombreNormalizado}" no encontrado ni en local ni en API`);
    }
    
    // Obtener fecha actual en Argentina (SE ACTUALIZA AUTOMÁTICAMENTE CADA DÍA)
    const now = new Date();
    const argDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    
    const dia = String(argDate.getDate()).padStart(2, '0');
    const mes = String(argDate.getMonth() + 1).padStart(2, '0');
    
    // Devolver sin letra - la letra se agrega en extractUrlFromChat si existe
    return `${dia}-${mes}-${panelId}`;
  },
  
  /**
   * Genera nomenclatura por defecto cuando no se encuentra el panel
   * Devuelve formato DD-MM-0 (sin letra)
   * @returns {string}
   */
  generarNomenclaturaPorDefecto() {
    const now = new Date();
    const argDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    
    const dia = String(argDate.getDate()).padStart(2, '0');
    const mes = String(argDate.getMonth() + 1).padStart(2, '0');
    
    return `${dia}-${mes}-0`; // 0 para panel desconocido, sin letra
  },
  
  /**
   * Obtiene el nombre del panel asociado a una nomenclatura
   * (Útil para cuando se necesite tagear)
   * @param {string} nomenclatura - Nomenclatura (ej: "11-12-19A")
   * @returns {string|null} Nombre del panel original
   */
  getPanelPorNomenclatura(nomenclatura) {
    try {
      const mappingStr = localStorage.getItem('clientify_nomenclatura_panel_mapping');
      if (!mappingStr) return null;
      
      const mapping = JSON.parse(mappingStr);
      return mapping[nomenclatura] || null;
    } catch (error) {
      console.error('[URL Detector] ❌ Error al obtener mapping:', error);
      return null;
    }
  },
  
  /**
   * Calcula la hora exacta basándose en el tiempo relativo
   * @param {string} relativeTime - Ej: "20 minutos", "1 hora"
   * @returns {string|null} Hora en formato "HH:MM"
   */
  calculateExactTime(relativeTime) {
    if (!relativeTime) {
      return null;
    }
    
    const now = new Date();
    const match = relativeTime.match(/(\d+)\s*(minuto|hora|día|mes|año)/i);
    if (!match) return null;
    
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
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
    
    const messageDate = new Date(now.getTime() - diff);
    const hours = messageDate.getHours().toString().padStart(2, '0');
    const minutes = messageDate.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;
    
    console.log('[URL Detector] 🕐 Hora calculada:', formattedTime);
    return formattedTime;
  }
};
