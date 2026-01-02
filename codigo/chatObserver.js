// Helper para enviar eventos al popup
function sendPopupEvent(event, type = 'info', data = {}) {
  chrome.runtime.sendMessage({
    action: 'popupEvent',
    event,
    type,
    data
  }).catch(err => {
    // Ignore si el popup no está abierto
  });
}

// --- Módulo para observar chats ---
const chatObserver = {
  stopProcess: false,
  scrollTimeoutId: null,
  pausado: false,
  callbackReanudar: null,
  
  scrollAndObserveChats() {
    // En lugar de hacer scroll, obtener directamente los primeros 20 chats visibles
    const chatDivs = chatOpener.getFirst20ChatsWithoutScroll();
    console.log(`🚀 [Observer] Iniciando observación de ${chatDivs.length} chats sin scroll`);
    if (chatDivs.length === 0) {
      console.warn("⚠️ No se encontraron chats con emoji 🕐.");
      sendPopupEvent('noChatFound', 'warning', { reason: 'no chats found' });
      return;
    }
    this.iterateObserveChats(chatDivs);
  },
  
  iterateObserveChats(chatDivs) {
    let index = 0;
    const self = this;
    
    function clickNextChat() {
      if (self.stopProcess) {
        console.log("⏹️ Proceso de observar detenido por el usuario.");
        return;
      }
      
      if (index >= chatDivs.length) {
        console.log("✅ Ciclo completado. Esperando 30 segundos antes de buscar nuevos chats...");
        
        // Esperar 30 segundos y luego reiniciar el proceso
        setTimeout(() => {
          if (!self.stopProcess) {
            console.log("🔄 Reiniciando búsqueda de chats nuevos...");
            self.scrollAndObserveChats();
          }
        }, 8000); // 8 segundos
        return;
      }
      
      const chat = chatDivs[index];
      if (chat) {
        chat.scrollIntoView({ behavior: "smooth", block: "center" });
        chat.click();
        console.log(`🔍 [Observer] Chat ${index + 1} abierto`);
        
        setTimeout(async () => {
          const chatWindow = document.querySelector('.mui-npbckn');
          if (chatWindow && typeof chatWindow.scrollTop === 'number') {
            chatWindow.scrollBy({ top: 120, behavior: 'smooth' });
          }
          
          setTimeout(async () => {
            // DETECTAR CAÍDAS (Business Account locked) PRIMERO
            const caidaDetectada = await alertManager.procesarCaida();
            if (caidaDetectada) {
              console.log('🚨 [Observer] Caída detectada y reportada, pasando al siguiente chat');
              index++;
              setTimeout(clickNextChat, 800);
              return;
            }
            
            // Extraer información del chat usando el urlDetector
            const urlInfo = await urlDetector.extractUrlFromChat();
            
            // Si no es de hoy o no tiene nomenclatura, saltar este chat
            if (!urlInfo || !urlInfo.nomenclatura) {
              console.log(`⏭️ [Observer] Chat ${index + 1} saltado (no es de hoy o sin nomenclatura)`);
              sendPopupEvent('chatSkipped', 'info', { reason: 'no nomenclatura' });
              index++;
              setTimeout(clickNextChat, 800);
              return;
            }
            
            const nomenclaturas = urlInfo.nomenclaturas || [{ nomenclatura: urlInfo.nomenclatura }];
            const urlFinal = urlInfo.url && urlInfo.url !== 'Sin URL' ? urlInfo.url : 'Sin URL';
            
            const nomenclaturasStr = nomenclaturas.map(n => n.nomenclatura).join(', ');
            console.log(`📋 [Observer] Nomenclaturas generadas: ${nomenclaturasStr}`);
            sendPopupEvent('nomemclaturaGenerated', 'success', { value: nomenclaturasStr });
            
            // Notificar panel detectado
            if (urlInfo.panelOriginal) {
              sendPopupEvent('panelDetected', 'info', { panel: urlInfo.panelOriginal });
            }
            
            // Si la URL necesita letra de campaña y NO la tiene, PAUSAR
            if (urlFinal !== 'Sin URL' && !urlInfo.letraCampana) {
              console.log('⏸️ PAUSANDO observer - Esperando letra de campaña para:', urlFinal);
              sendPopupEvent('urlWaiting', 'warning', { url: urlFinal });
              self.pausado = true;
              
              // Guardar callback para reanudar después y CONTINUAR CON EL TAGEO
              self.callbackReanudar = async () => {
                console.log('▶️ REANUDANDO observer - Continuando con tageo...');
                self.pausado = false;
                
                // Re-extraer info para obtener las letras asignadas
                const urlInfoActualizada = await urlDetector.extractUrlFromChat();
                if (urlInfoActualizada && urlInfoActualizada.nomenclaturas && urlInfoActualizada.nomenclaturas.length > 0) {
                  const nomenclaturasActualizadas = urlInfoActualizada.nomenclaturas;
                  console.log(`📋 [Observer] Nomenclaturas actualizadas: ${nomenclaturasActualizadas.map(n => n.nomenclatura).join(', ')}`);
                  
                  // Continuar con el tageo usando TODAS las nomenclaturas
                  self.tagearMultiplesEnObservaciones(nomenclaturasActualizadas, index, () => {
                    index++;
                    setTimeout(clickNextChat, 800);
                  });
                } else {
                  // Si aún no tiene letra, saltar este chat
                  console.warn('⚠️ No se pudo obtener letra de campaña, saltando...');
                  index++;
                  setTimeout(clickNextChat, 800);
                }
              };
              
              // NO continuar automáticamente - esperar a que se asigne letra
              return;
            }
            
            // ========== AHORA TAGEAR EN OBSERVACIONES ==========
            self.tagearMultiplesEnObservaciones(nomenclaturas, index, () => {
              sendPopupEvent('chatProcessed', 'success', { panel: urlInfo.panelOriginal || 'sin panel' });
              index++;
              setTimeout(clickNextChat, 800);
            });
          }, 1200);
        }, 200);
      } else {
        index++;
        setTimeout(clickNextChat, 800);
      }
    }
    
    clickNextChat();
  },
  
  /**
   * Función auxiliar para tagear MÚLTIPLES nomenclaturas en Observaciones
   * @param {Array} nomenclaturas - Array de objetos {nomenclatura, letra, tieneCarga}
   * @param {number} chatIndex - Índice del chat actual
   * @param {Function} onComplete - Callback para ejecutar después de tagear
   */
  tagearMultiplesEnObservaciones(nomenclaturas, chatIndex, onComplete) {
    const self = this;
    const chatWindow = document.querySelector('.mui-npbckn');
    
    // Notificar que está tajeando
    sendPopupEvent('tagearChat', 'action', { nomenclaturas: nomenclaturas.map(n => n.nomenclatura).join(', ') });
    
    const obsP = chatWindow && Array.from(chatWindow.querySelectorAll('p')).find(
      p => /Observaci[oó]n(es)?/i.test(p.textContent)
    );
    
    if (obsP) {
      // Simular hover para mostrar el botón de edición
      const mouseOverEvent = new MouseEvent('mouseover', { bubbles: true });
      obsP.dispatchEvent(mouseOverEvent);
      
      setTimeout(() => {
        const editBtn = obsP.querySelector('button.btn-edit');
        if (editBtn) {
          editBtn.click();
          
          // Intentar encontrar el textarea con reintentos
          let intentos = 0;
          const maxIntentos = 8;
          
          function buscarTextareaYTaggear() {
            const textarea = document.querySelector('textarea.mui-16j0ffk');
            if (textarea) {
              const actual = textarea.value.trim();
              let codigos = actual.split(',').map(c => c.trim()).filter(c => c.length > 0);
              
              let huboModificaciones = false;
              
              // Procesar cada nomenclatura
              for (const nomItem of nomenclaturas) {
                const nomenclatura = nomItem.nomenclatura;
                const nomenclaturaSinSigno = nomenclatura.replace(/!$/, '');
                
                // PRIMERO: Buscar coincidencia EXACTA (mismo código con o sin signo)
                let indiceExistente = codigos.findIndex(c => c.replace(/!$/, '') === nomenclaturaSinSigno);
                
                // SEGUNDO: Si no hay coincidencia exacta, buscar si el código ya existe como BASE
                // (por ejemplo, si tenemos "15-12-36" sin letra y ahora llega "15-12-36B")
                if (indiceExistente === -1) {
                  const baseNomenclatura = nomenclaturaSinSigno.replace(/[A-Z]!?$/, ''); // Quitar última letra si existe
                  indiceExistente = codigos.findIndex(c => {
                    const cSinSigno = c.replace(/!$/, '');
                    const cBase = cSinSigno.replace(/[A-Z]!?$/, '');
                    return cBase === baseNomenclatura && cSinSigno === baseNomenclatura; // Solo si es la base exacta
                  });
                  
                  if (indiceExistente !== -1) {
                    const codigoExistente = codigos[indiceExistente];
                    console.log(`🔄 [Observer] Reemplazando "${codigoExistente}" con versión con letra: "${nomenclatura}"`);
                    codigos[indiceExistente] = nomenclatura;
                    huboModificaciones = true;
                    continue;
                  }
                }
                
                if (indiceExistente !== -1) {
                  const codigoExistente = codigos[indiceExistente];
                  
                  // Si existe con diferente signo, solo reemplazar si el NUEVO tiene ! y el viejo NO
                  if (codigoExistente !== nomenclatura) {
                    const viejoTieneSigno = codigoExistente.endsWith('!');
                    const nuevoTieneSigno = nomenclatura.endsWith('!');
                    
                    if (nuevoTieneSigno && !viejoTieneSigno) {
                      // CORRECTO: Actualizar de 13-12-35A → 13-12-35A!
                      console.log(`🔄 [Observer] Actualizando con carga: "${codigoExistente}" → "${nomenclatura}"`);
                      codigos[indiceExistente] = nomenclatura;
                      huboModificaciones = true;
                    } else if (!nuevoTieneSigno && viejoTieneSigno) {
                      // INCORRECTO: NO quitar el signo si ya está
                      console.log(`⚠️ [Observer] "${codigoExistente}" ya tiene carga, NO se quita el signo`);
                    } else {
                      console.log(`✅ [Observer] "${nomenclatura}" ya existe correctamente`);
                    }
                  } else {
                    console.log(`✅ [Observer] "${nomenclatura}" ya existe correctamente`);
                  }
                } else {
                  // No existe, agregar
                  console.log(`➕ [Observer] Agregando "${nomenclatura}"`);
                  codigos.push(nomenclatura);
                  huboModificaciones = true;
                }
              }
              
              if (!huboModificaciones) {
                console.log(`✅ [Observer] Chat ${chatIndex + 1} ya tiene todas las nomenclaturas correctas`);
                const cancelBtn = document.querySelector('button[aria-label="Cancelar"]');
                if (cancelBtn) cancelBtn.click();
                setTimeout(onComplete, 600);
              } else {
                // Guardar cambios
                const nuevoValor = codigos.join(', ');
                textarea.value = nuevoValor;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                
                setTimeout(() => {
                  const saveBtn = document.querySelector('button[aria-label="Guardar"]');
                  if (saveBtn) {
                    saveBtn.click();
                    console.log(`✅ [Observer] Chat ${chatIndex + 1} tageado correctamente`);
                    setTimeout(onComplete, 1000);
                  } else {
                    console.warn('[Observer] No se encontró el botón Guardar');
                    setTimeout(onComplete, 600);
                  }
                }, 600);
              }
            } else if (intentos < maxIntentos) {
              intentos++;
              setTimeout(buscarTextareaYTaggear, 400);
            } else {
              console.warn('[Observer] No se encontró el textarea tras varios intentos');
              setTimeout(onComplete, 600);
            }
          }
          
          setTimeout(buscarTextareaYTaggear, 1200);
        } else {
          console.warn('[Observer] No se encontró el botón de edición');
          setTimeout(onComplete, 600);
        }
      }, 200);
    } else {
      console.warn('[Observer] No se encontró el <p> Observaciones');
      setTimeout(onComplete, 600);
    }
  },
  
  startObserveIteration() {
    console.log('🔍 Iniciando observación CONTINUA y TAGEO automático de chats de HOY...');
    console.log('♻️ El observer buscará y tageará nuevos chats cada 30 segundos automáticamente');
    this.stopProcess = false;
    sendPopupEvent('observerStarted', 'success');
    this.scrollAndObserveChats();
  },
  
  stopObserveIteration() {
    this.stopProcess = true;
    sendPopupEvent('observerStopped', 'warning');
    if (this.scrollTimeoutId) {
      clearTimeout(this.scrollTimeoutId);
      this.scrollTimeoutId = null;
    }
    console.log("⏹️ [Observer] Observación continua detenida.");
  },
  
  /**
   * Reanuda el observer después de asignar letra de campaña
   */
  reanudarObserver() {
    if (this.pausado && this.callbackReanudar) {
      this.callbackReanudar();
      this.callbackReanudar = null;
    }
  }
};
