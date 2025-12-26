// Estado del popup
const popupState = {
  isRunning: false,
  logEntries: [],
  maxEntries: 100
};

function loadStoredState() {
  chrome.storage.local.get(['popupState'], (result) => {
    if (result.popupState) {
      Object.assign(popupState, result.popupState);
      updateLogUI();
      updateButtonStates(popupState.isRunning);
    }
  });
}

function saveState() {
  chrome.storage.local.set({ popupState: popupState });
}

function addLog(message, type = 'info') {
  const now = new Date();
  const time = now.toLocaleTimeString('es-AR', { hour12: false });
  
  popupState.logEntries.unshift({
    time,
    message,
    type,
    timestamp: Date.now()
  });
  
  if (popupState.logEntries.length > popupState.maxEntries) {
    popupState.logEntries.pop();
  }
  
  updateLogUI();
  saveState();
}

function updateLogUI() {
  const logContainer = document.getElementById('logContainer');
  
  if (popupState.logEntries.length === 0) {
    logContainer.innerHTML = '<div class="empty-log">Esperando actividad...</div>';
    return;
  }
  
  logContainer.innerHTML = popupState.logEntries.map(entry => `
    <div class="log-entry ${entry.type}">
      <span style="color: #64748b;">[${entry.time}]</span> ${entry.message}
    </div>
  `).join('');
  
  logContainer.scrollTop = 0;
}

function updateButtonStates(running) {
  popupState.isRunning = running;
  document.getElementById('observarChatsBtn').disabled = running;
  document.getElementById('detenerChatsBtn').disabled = !running;
  saveState();
}

document.getElementById("observarChatsBtn").addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ url: "https://new.clientify.com/team-inbox/*" });
  
  if (tabs.length === 0) {
    addLog('‚ùå No hay pesta√±as de Clientify abiertas', 'error');
    return;
  }
  
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: "observarChats" }).catch(() => {});
  });
  
  updateButtonStates(true);
  addLog(`Ìø¢ Observador iniciado en ${tabs.length} pesta√±a(s)`, 'success');
});

document.getElementById("detenerChatsBtn").addEventListener("click", async () => {
  chrome.runtime.sendMessage({ action: "detenerChats" }).catch(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "detenerChats" });
      }
    });
  });
  
  updateButtonStates(false);
  addLog('‚èπÔ∏è Observador detenido', 'warning');
});

// Sistema de Mapeos
const mapeoModal = {
  abierto: false,
  mapeos: {},
  SERVIDOR_URL: 'https://accountant-services.co.uk/mapeos',

  async cargarMapeos() {
    try {
      const response = await fetch(this.SERVIDOR_URL);
      const data = await response.json();
      
      if (data.ok && data.mapeos) {
        this.mapeos = data.mapeos;
        chrome.storage.local.set({ urlMappings: this.mapeos });
        addLog('‚úÖ Mapeos sincronizados desde servidor', 'success');
      } else {
        this.cargarMapeosCache();
      }
    } catch (error) {
      console.error('Error al cargar mapeos del servidor:', error);
      this.cargarMapeosCache();
    }
    
    this.actualizarListaMapeos();
  },

  cargarMapeosCache() {
    chrome.storage.local.get(['urlMappings'], (result) => {
      if (result.urlMappings) {
        this.mapeos = result.urlMappings;
        addLog('Ì≥¶ Mapeos cargados desde cach√© local', 'info');
      } else {
        this.mapeos = {};
      }
    });
  },

  actualizarListaMapeos() {
    const listContainer = document.getElementById('mapeosList');
    const mapeos = this.mapeos;

    if (Object.keys(mapeos).length === 0) {
      listContainer.innerHTML = '<div style="color: #64748b; text-align: center; padding: 30px 20px; font-size: 11px;">Ì≥≠ No hay mapeos</div>';
      return;
    }

    let html = '';
    for (const [url, mapeoData] of Object.entries(mapeos)) {
      const letra = typeof mapeoData === 'string' ? mapeoData : mapeoData.letra;
      
      html += `
        <div class="mapeo-item" data-url="${url}" style="padding: 8px 12px; border-bottom: 1px solid #334155; cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1; min-width: 0; margin-right: 10px;">
            <div style="font-size: 10px; color: #94a3b8; margin-bottom: 2px; text-transform: uppercase; font-weight: bold;">URL</div>
            <div style="font-size: 11px; color: #e2e8f0; word-break: break-all; font-family: 'Courier New', monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${url}</div>
          </div>
          <div style="min-width: 45px; text-align: center; padding: 6px 10px; background: #334155; border-radius: 4px; flex-shrink: 0;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; font-weight: bold;">Letra</div>
            <div style="font-size: 16px; font-weight: bold; color: #3b82f6;">${letra}</div>
          </div>
        </div>
      `;
    }
    listContainer.innerHTML = html;

    document.querySelectorAll('.mapeo-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.mapeo-item').forEach(i => {
          i.style.background = '';
        });
        item.style.background = '#334155';
        
        const url = item.getAttribute('data-url');
        const mapeoData = mapeos[url];
        const letra = typeof mapeoData === 'string' ? mapeoData : mapeoData.letra;
        
        document.getElementById('urlOriginal').value = url;
        document.getElementById('letraMapeo').value = letra;
      });
    });
  },

  guardar() {
    const urlOriginal = document.getElementById('urlOriginal').value.trim();
    const letra = document.getElementById('letraMapeo').value.trim().toUpperCase();

    if (!urlOriginal) {
      alert('‚ö†Ô∏è Ingresa una URL o selecciona una de la lista');
      return;
    }

    if (!/^[A-Z]$/.test(letra)) {
      alert('‚ö†Ô∏è Ingresa una letra v√°lida (A-Z)');
      return;
    }

    this.mapeos[urlOriginal] = {
      letra: letra
    };

    const datosMapeo = {
      url: urlOriginal,
      letra: letra
    };

    fetch(this.SERVIDOR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Machine-ID': 'chrome-extension'
      },
      body: JSON.stringify(datosMapeo)
    })
    .then(response => response.json())
    .then(data => {
      if (data.ok) {
        if (data.mapeo) {
          this.mapeos[urlOriginal] = data.mapeo;
        }
        chrome.storage.local.set({ urlMappings: this.mapeos }, () => {
          addLog(`‚úÖ Letra actualizada: ${urlOriginal} ‚Üí ${letra}`, 'success');
          this.actualizarListaMapeos();
          document.getElementById('urlOriginal').value = '';
          document.getElementById('letraMapeo').value = '';
        });
      } else {
        alert('‚ùå Error al guardar: ' + (data.error || 'Error desconocido'));
      }
    })
    .catch(error => {
      console.error('Error al guardar mapeo:', error);
      chrome.storage.local.set({ urlMappings: this.mapeos }, () => {
        addLog(`‚ö†Ô∏è Letra actualizada en cach√© local: ${urlOriginal} ‚Üí ${letra}`, 'warning');
        this.actualizarListaMapeos();
      });
    });
  },

  eliminar() {
    const urlOriginal = document.getElementById('urlOriginal').value.trim();

    if (!urlOriginal) {
      alert('‚ö†Ô∏è Selecciona una URL para eliminar');
      return;
    }

    if (confirm(`¬øEliminar mapeo para:\n${urlOriginal}?`)) {
      delete this.mapeos[urlOriginal];
      
      const urlEncoded = encodeURIComponent(urlOriginal);
      fetch(`${this.SERVIDOR_URL}/${urlEncoded}`, {
        method: 'DELETE',
        headers: {
          'X-Machine-ID': 'chrome-extension'
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.ok) {
          chrome.storage.local.set({ urlMappings: this.mapeos }, () => {
            addLog(`Ì∑ëÔ∏è Mapeo eliminado: ${urlOriginal}`, 'warning');
            this.actualizarListaMapeos();
            document.getElementById('urlOriginal').value = '';
            document.getElementById('letraMapeo').value = '';
          });
        } else {
          alert('‚ùå Error al eliminar: ' + (data.error || 'Error desconocido'));
        }
      })
      .catch(error => {
        console.error('Error al eliminar mapeo:', error);
        chrome.storage.local.set({ urlMappings: this.mapeos }, () => {
          addLog(`‚ö†Ô∏è Mapeo eliminado en cach√© local: ${urlOriginal}`, 'warning');
          this.actualizarListaMapeos();
          document.getElementById('urlOriginal').value = '';
          document.getElementById('letraMapeo').value = '';
        });
      });
    }
  }
};

// Eventos de Mapeos
document.getElementById("mapeoBtn").addEventListener("click", () => {
  const section = document.getElementById("mapeosSection");
  section.classList.add("visible");
  mapeoModal.cargarMapeos();
});

document.getElementById("cerrarMapeoBtn").addEventListener("click", () => {
  const section = document.getElementById("mapeosSection");
  section.classList.remove("visible");
  document.getElementById('urlOriginal').value = '';
  document.getElementById('letraMapeo').value = '';
});

document.getElementById("guardarMapeoBtn").addEventListener("click", () => {
  mapeoModal.guardar();
});

document.getElementById("eliminarMapeoBtn").addEventListener("click", () => {
  mapeoModal.eliminar();
});

// Escuchar mensajes desde el content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "popupEvent") {
    const { event, type = 'info', data } = message;
    
    switch(event) {
      case 'scrolling':
        addLog(`‚¨áÔ∏è Scrolleando chat...`, 'action');
        break;
      case 'tagearChat':
        addLog(`Ìø∑Ô∏è Tageando chat en ${data.panel}`, 'action');
        break;
      case 'urlMapped':
        addLog(`‚úÖ URL mapeada: ${data.url} ‚Üí ${data.letra}`, 'success');
        break;
      case 'urlWaiting':
        addLog(`‚è∏Ô∏è URL esperando: ${data.url}`, 'warning');
        break;
      case 'observerStarted':
        addLog('Ìø¢ Observer iniciado en Clientify', 'success');
        updateButtonStates(true);
        break;
      case 'observerStopped':
        addLog('‚èπÔ∏è Observer detenido', 'warning');
        updateButtonStates(false);
        break;
      case 'error':
        addLog(`‚ùå Error: ${data.message}`, 'error');
        break;
      case 'panelDetected':
        addLog(`Ì≥ç Panel detectado: ${data.panel}`, 'info');
        break;
      case 'nomemclaturaGenerated':
        addLog(`Ì≥ù Nomenclatura: ${data.value}`, 'success');
        break;
      default:
        addLog(`${event}`, type);
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadStoredState();
  addLog('Panel cargado', 'info');
});
