// Service Worker - Intermediario de mensajes
// Soporta múltiples tabs activos simultáneamente

let activeTabIds = new Set(); // Set de tabs activos
let isRunning = false;
let panelesCache = null; // Cache de paneles desde API
let cacheTimestamp = null; // Timestamp del cache
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const PANELES_API_URL = 'https://accountant-services.co.uk/paneles/?secret=tu_clave_super_secreta';

// Función para cargar paneles desde la API (sin restricciones de CORS en service worker)
async function cargarPanelesDelServidor() {
  const ahora = Date.now();
  
  // Si el cache es reciente (menos de 5 minutos), reutilizalo
  if (panelesCache && cacheTimestamp && 
      (ahora - cacheTimestamp) < CACHE_DURATION) {
    console.log('[Background] 📦 Usando cache de paneles');
    return panelesCache;
  }
  
  try {
    console.log('[Background] 🔄 Obteniendo paneles desde API...');
    const response = await fetch(PANELES_API_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.ok && data.paneles && Array.isArray(data.paneles)) {
      panelesCache = data.paneles.map(p => ({
        id: p.id,
        nombres: [p.nombre]
      }));
      cacheTimestamp = ahora;
      console.log(`[Background] ✅ ${panelesCache.length} paneles cargados desde API`);
      return panelesCache;
    }
    
    console.warn('[Background] ⚠️ Formato inesperado de respuesta');
    return panelesCache || [];
  } catch (error) {
    console.error('[Background] ❌ Error cargando paneles:', error);
    return panelesCache || [];
  }
}

// Escuchar mensajes desde popup y content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  
  // Manejar solicitud de paneles desde content script
  if (message.action === "obtenerPaneles") {
    cargarPanelesDelServidor().then(paneles => {
      sendResponse({ success: true, paneles: paneles });
    }).catch(error => {
      console.error('[Background] Error en obtenerPaneles:', error);
      sendResponse({ success: false, paneles: [] });
    });
    return true; // Mantener el canal abierto para respuesta asincrónica
  }
  
  // Si viene del content script iniciando observer
  if (message.action === "observarChats") {
    console.log("[Background] Observer iniciado en tabId:", tabId);
    activeTabIds.add(tabId);
    isRunning = true;
    saveState();
  } 
  
  // Si viene del popup - detener TODOS los observers activos
  if (message.action === "detenerChats") {
    console.log("[Background] Detener enviado a todos los tabs:", Array.from(activeTabIds));
    
    // Enviar a todos los tabs activos
    activeTabIds.forEach(id => {
      chrome.tabs.sendMessage(id, { action: "detenerChats" }).catch(() => {
        activeTabIds.delete(id);
      });
    });
    
    isRunning = false;
    saveState();
  }
  
  // Si viene del content script, retransmitir al popup si está abierto
  if (message.action === "popupEvent") {
    chrome.runtime.sendMessage(message).catch(() => {});
  }
});

// Limpiar si el tab se cierra
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeTabIds.has(tabId)) {
    console.log("[Background] Tab cerrado:", tabId);
    activeTabIds.delete(tabId);
    
    if (activeTabIds.size === 0) {
      isRunning = false;
    }
    saveState();
  }
});

// Guardar estado
function saveState() {
  chrome.storage.local.set({ 
    activeTabIds: Array.from(activeTabIds),
    isRunning 
  });
}

// Cargar estado al iniciar
chrome.storage.local.get(['activeTabIds', 'isRunning'], (result) => {
  activeTabIds = new Set(result.activeTabIds || []);
  isRunning = result.isRunning || false;
  console.log("[Background] Estado cargado:", { activeTabIds: Array.from(activeTabIds), isRunning });
});
