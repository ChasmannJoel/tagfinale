/**
 * Alert Manager - Detecta y reporta caídas de cuentas (Business Account locked)
 */

const alertManager = {
  SERVIDOR_ALERTAS: 'https://accountant-services.co.uk/alerts',
  SECRET: 'tu_clave_super_secreta',
  detectados: new Set(), // Para evitar duplicados
  
  /**
   * Busca el mensaje "Business Account locked" en el chat abierto
   * @returns {boolean} true si se detectó
   */
  detectarCaida() {
    try {
      const chatWindow = document.querySelector('.mui-npbckn');
      if (!chatWindow) {
        console.log('[AlertManager] No hay chat abierto');
        return false;
      }

      // Buscar el texto "Business Account locked" en el contenido del chat
      const messagesContainer = chatWindow.innerText || chatWindow.textContent || '';
      const tieneCaida = messagesContainer.includes('Business Account locked');

      if (tieneCaida) {
        console.log('🚨 [AlertManager] ¡DETECTADA CAÍDA DE CUENTA! "Business Account locked"');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[AlertManager] Error detectando caída:', error);
      return false;
    }
  },

  /**
   * Extrae el nombre del panel del chat actual
   * @returns {string|null} Nombre del panel o null
   */
  obtenerNombrePanelActual() {
    try {
      const container = document.querySelector('div[aria-label="Asignar conversación"]');
      if (!container) return null;

      const panelNameElement = container.querySelector('p.MuiTypography-root.MuiTypography-body1.mui-1586szk');
      if (!panelNameElement) return null;

      return panelNameElement.textContent.trim();
    } catch (error) {
      console.error('[AlertManager] Error obteniendo nombre del panel:', error);
      return null;
    }
  },

  /**
   * Busca el panel en la configuración local usando el nombre
   * @param {string} nombrePanel - Nombre del panel
   * @returns {Promise<Object|null>} Panel encontrado o null
   */
  async buscarPanelEnAPI(nombrePanel) {
    try {
      if (!nombrePanel) return null;

      // Solicitar paneles al background.js
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'obtenerPaneles' },
          (response) => {
            if (response && response.success && response.paneles) {
              const panel = response.paneles.find(p => 
                p.nombre.toLowerCase() === nombrePanel.toLowerCase()
              );
              resolve(panel || null);
            } else {
              resolve(null);
            }
          }
        );
      });
    } catch (error) {
      console.error('[AlertManager] Error buscando panel:', error);
      return null;
    }
  },

  /**
   * Muestra una alerta visual en pantalla
   * @param {string} titulo - Título de la alerta
   * @param {string} mensaje - Mensaje de la alerta
   * @param {string} tipo - Tipo de alerta (error, warning, success)
   */
  mostrarAlertaVisual(titulo, mensaje, tipo = 'error') {
    try {
      // Crear overlay de alerta
      const alertDiv = document.createElement('div');
      alertDiv.id = 'autotag-alert-overlay';
      alertDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      `;

      // Colores según tipo
      const colores = {
        error: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', icon: '🚨' },
        warning: { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', icon: '⚠️' },
        success: { bg: '#dcfce7', border: '#86efac', text: '#166534', icon: '✅' }
      };

      const color = colores[tipo] || colores.error;

      // Contenido de la alerta
      const alertContent = document.createElement('div');
      alertContent.style.cssText = `
        background: white;
        border: 3px solid ${color.border};
        border-radius: 12px;
        padding: 30px;
        max-width: 500px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        text-align: center;
      `;

      alertContent.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">${color.icon}</div>
        <h1 style="
          color: ${color.text};
          margin: 0 0 15px 0;
          font-size: 24px;
          font-weight: bold;
        ">${titulo}</h1>
        <p style="
          color: ${color.text};
          margin: 0 0 20px 0;
          font-size: 16px;
          line-height: 1.5;
        ">${mensaje}</p>
        <button id="autotag-alert-close" style="
          background: ${color.text};
          color: white;
          border: none;
          padding: 10px 30px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
        ">Cerrar</button>
      `;

      alertDiv.appendChild(alertContent);
      document.body.appendChild(alertDiv);

      // Event listener para cerrar
      document.getElementById('autotag-alert-close').addEventListener('click', () => {
        alertDiv.remove();
      });

      // Cerrar automáticamente después de 10 segundos
      setTimeout(() => {
        const elemento = document.getElementById('autotag-alert-overlay');
        if (elemento) elemento.remove();
      }, 10000);

      console.log(`[AlertManager] Alerta visual mostrada: ${titulo}`);
    } catch (error) {
      console.error('[AlertManager] Error mostrando alerta visual:', error);
    }
  },

  /**
   * Reporta una caída al servidor de alertas
   * @param {Object} panel - Objeto panel con id, nombre y numero
   */
  async reportarCaida(panel) {
    try {
      if (!panel || !panel.id || !panel.nombre) {
        console.error('[AlertManager] Panel inválido para reportar');
        return false;
      }

      // Crear clave única para evitar duplicados (en esta sesión)
      const claveDuplicado = `${panel.id}-${Date.now()}`;
      if (this.detectados.has(claveDuplicado)) {
        console.log('[AlertManager] Caída ya reportada en esta sesión');
        return false;
      }

      console.log(`📡 [AlertManager] Reportando caída para panel: ${panel.nombre} (ID: ${panel.id})`);

      // Preparar payload
      const payload = {
        id: panel.id,
        nombre: panel.nombre,
        numero: Array.isArray(panel.numero) ? panel.numero : [panel.numero],
        timestamp: new Date().toISOString(),
        tipo: 'Business Account locked'
      };

      // Enviar al servidor
      const response = await fetch(`${this.SERVIDOR_ALERTAS}?secret=${this.SECRET}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const resultado = await response.json();
        console.log('✅ [AlertManager] Caída reportada exitosamente:', resultado);
        this.detectados.add(claveDuplicado);
        return true;
      } else {
        console.error('[AlertManager] Error en respuesta del servidor:', response.status);
        return false;
      }
    } catch (error) {
      console.error('[AlertManager] Error reportando caída:', error);
      return false;
    }
  },

  /**
   * Detecta caída, obtiene datos del panel y reporta
   */
  async procesarCaida() {
    try {
      // 1. Detectar caída
      if (!this.detectarCaida()) {
        return false;
      }

      // 2. Obtener nombre del panel actual
      const nombrePanel = this.obtenerNombrePanelActual();
      if (!nombrePanel) {
        console.warn('[AlertManager] No se pudo obtener nombre del panel');
        this.mostrarAlertaVisual(
          'Error de Detección',
          'Se detectó "Business Account locked" pero no se pudo identificar el panel.',
          'warning'
        );
        return false;
      }

      // 3. Buscar panel en API
      const panel = await this.buscarPanelEnAPI(nombrePanel);
      if (!panel) {
        console.warn(`[AlertManager] Panel "${nombrePanel}" no encontrado en configuración`);
        this.mostrarAlertaVisual(
          'Panel No Configurado',
          `"Business Account locked" detectado en: ${nombrePanel}\n\nAñade este panel a la configuración para reportar automáticamente.`,
          'warning'
        );
        return false;
      }

      // 4. Mostrar alerta visual
      const mensajeAlerta = `
        Panel: <strong>${panel.nombre}</strong><br>
        ID: ${panel.id}<br>
        Números: ${Array.isArray(panel.numero) ? panel.numero.join(', ') : panel.numero}
      `;
      this.mostrarAlertaVisual(
        'CAÍDA DETECTADA',
        mensajeAlerta,
        'error'
      );

      // 5. Reportar al servidor
      const reportado = await this.reportarCaida(panel);
      if (reportado) {
        console.log('✅ Caída reportada al servidor');
      }

      return true;
    } catch (error) {
      console.error('[AlertManager] Error procesando caída:', error);
      return false;
    }
  }
};

// Exportar para uso en otros módulos
window.alertManager = alertManager;
