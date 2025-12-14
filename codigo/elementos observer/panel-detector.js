// ============================================
// DETECTOR DE PANEL ASIGNADO
// ============================================

const PanelDetector = {
  
  /**
   * Detecta el nombre del panel al que está asignada la conversación
   * @returns {string|null} Nombre del panel o null si no se encuentra
   */
  getPanelName() {
    // Buscar el contenedor con aria-label="Asignar conversación"
    const container = document.querySelector('div[aria-label="Asignar conversación"]');
    
    if (!container) {
      console.warn('[PanelDetector] ❌ No se encontró el contenedor de asignación');
      return null;
    }
    
    // Buscar el <p> que contiene el nombre del panel
    const panelNameElement = container.querySelector('p.MuiTypography-root.MuiTypography-body1.mui-1586szk');
    
    if (!panelNameElement) {
      console.warn('[PanelDetector] ❌ No se encontró el elemento con el nombre del panel');
      return null;
    }
    
    const panelName = panelNameElement.textContent.trim();
    console.log('[PanelDetector] ✅ Panel detectado:', panelName);
    
    return panelName;
  }
};

// Exportar para uso global
window.PanelDetector = PanelDetector;
