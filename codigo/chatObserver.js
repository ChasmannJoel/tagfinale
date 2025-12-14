// --- Módulo para observar chats ---
const chatObserver = {
  stopProcess: false,
  scrollTimeoutId: null,
  pausado: false,
  callbackReanudar: null,
  
  scrollAndObserveChats() {
    chatOpener.scrollChatsUntilStopOrEnd(this.iterateObserveChats.bind(this));
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
        }, 30000); // 30 segundos
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
            // Extraer información del chat usando el urlDetector
            const urlInfo = await urlDetector.extractUrlFromChat();
            
            // Si no es de hoy o no tiene nomenclatura, saltar este chat
            if (!urlInfo || !urlInfo.nomenclatura) {
              console.log(`⏭️ [Observer] Chat ${index + 1} saltado (no es de hoy o sin nomenclatura)`);
              index++;
              setTimeout(clickNextChat, 2000);
              return;
            }
            
            const nomenclaturas = urlInfo.nomenclaturas || [{ nomenclatura: urlInfo.nomenclatura }];
            const urlFinal = urlInfo.url && urlInfo.url !== 'Sin URL' ? urlInfo.url : 'Sin URL';
            
            // Guardar en localStorage (primera nomenclatura)
            self.saveToLocalStorage(nomenclaturas[0].nomenclatura, urlFinal, urlInfo.panelOriginal);
            
            const nomenclaturasStr = nomenclaturas.map(n => n.nomenclatura).join(', ');
            console.log(`📋 [Observer] Nomenclaturas generadas: ${nomenclaturasStr}`);
            
            // Si la URL necesita letra de campaña y NO la tiene, PAUSAR
            if (urlFinal !== 'Sin URL' && !urlInfo.letraCampana) {
              console.log('⏸️ PAUSANDO observer - Esperando letra de campaña para:', urlFinal);
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
                    setTimeout(clickNextChat, 2000);
                  });
                } else {
                  // Si aún no tiene letra, saltar este chat
                  console.warn('⚠️ No se pudo obtener letra de campaña, saltando...');
                  index++;
                  setTimeout(clickNextChat, 2000);
                }
              };
              
              // NO continuar automáticamente - esperar a que se asigne letra
              return;
            }
            
            // ========== AHORA TAGEAR EN OBSERVACIONES ==========
            self.tagearMultiplesEnObservaciones(nomenclaturas, index, () => {
              index++;
              setTimeout(clickNextChat, 2000);
            });
          }, 4000);
        }, 1200);
      } else {
        index++;
        setTimeout(clickNextChat, 2000);
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
                
                // Buscar si existe el código (con o sin signo)
                const indiceExistente = codigos.findIndex(c => c.replace(/!$/, '') === nomenclaturaSinSigno);
                
                if (indiceExistente !== -1) {
                  const codigoExistente = codigos[indiceExistente];
                  
                  // Si existe con diferente signo, reemplazar
                  if (codigoExistente !== nomenclatura) {
                    console.log(`🔄 [Observer] Reemplazando "${codigoExistente}" por "${nomenclatura}"`);
                    codigos[indiceExistente] = nomenclatura;
                    huboModificaciones = true;
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
                setTimeout(onComplete, 2000);
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
                    setTimeout(onComplete, 3000);
                  } else {
                    console.warn('[Observer] No se encontró el botón Guardar');
                    setTimeout(onComplete, 2000);
                  }
                }, 1000);
              }
            } else if (intentos < maxIntentos) {
              intentos++;
              setTimeout(buscarTextareaYTaggear, 1000);
            } else {
              console.warn('[Observer] No se encontró el textarea tras varios intentos');
              setTimeout(onComplete, 2000);
            }
          }
          
          setTimeout(buscarTextareaYTaggear, 4000);
        } else {
          console.warn('[Observer] No se encontró el botón de edición');
          setTimeout(onComplete, 2000);
        }
      }, 600);
    } else {
      console.warn('[Observer] No se encontró el <p> Observaciones');
      setTimeout(onComplete, 2000);
    }
  },
  
  /**
   * Función auxiliar para tagear en Observaciones (legacy - mantener por compatibilidad)
   * @param {string} nomenclatura - Código a tagear
   * @param {number} chatIndex - Índice del chat actual
   * @param {Function} onComplete - Callback para ejecutar después de tagear
   */
  tagearEnObservaciones(nomenclatura, chatIndex, onComplete) {
    const self = this;
    const chatWindow = document.querySelector('.mui-npbckn');
    
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
              const codigos = actual.split(',').map(c => c.trim()).filter(c => c.length > 0);
              
              // Normalizar nomenclatura (quitar signo para comparación)
              const nomenclaturaSinSigno = nomenclatura.replace(/!$/, '');
              const tieneSigno = nomenclatura.endsWith('!');
              
              // Buscar si existe el código (con o sin signo)
              const codigoExistenteConSigno = codigos.find(c => c.replace(/!$/, '') === nomenclaturaSinSigno && c.endsWith('!'));
              const codigoExistenteSinSigno = codigos.find(c => c.replace(/!$/, '') === nomenclaturaSinSigno && !c.endsWith('!'));
              const codigoExistente = codigoExistenteConSigno || codigoExistenteSinSigno;
              
              if (codigoExistente) {
                // Si existe el código exacto, no hacer nada
                if (codigoExistente === nomenclatura) {
                  console.log(`✅ [Observer] Chat ${chatIndex + 1} ya tiene "${nomenclatura}", saltando...`);
                  const cancelBtn = document.querySelector('button[aria-label="Cancelar"]');
                  if (cancelBtn) cancelBtn.click();
                  setTimeout(onComplete, 2000);
                  return;
                }
                
                // Si existe pero con diferente signo, reemplazar
                console.log(`🔄 [Observer] Reemplazando "${codigoExistente}" por "${nomenclatura}"`);
                const codigosActualizados = codigos.map(c => 
                  c.replace(/!$/, '') === nomenclaturaSinSigno ? nomenclatura : c
                );
                const nuevoValor = codigosActualizados.join(', ');
                textarea.value = nuevoValor;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                
                setTimeout(() => {
                  const saveBtn = document.querySelector('button[aria-label="Guardar"]');
                  if (saveBtn) {
                    saveBtn.click();
                    console.log(`✅ [Observer] Chat ${chatIndex + 1} actualizado a "${nomenclatura}"`);
                    setTimeout(onComplete, 3000);
                  } else {
                    console.warn('[Observer] No se encontró el botón Guardar');
                    setTimeout(onComplete, 2000);
                  }
                }, 1000);
              } else {
                // No existe, agregar el nuevo código
                const nuevoValor = actual ? actual + ', ' + nomenclatura : nomenclatura;
                textarea.value = nuevoValor;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                
                setTimeout(() => {
                  const saveBtn = document.querySelector('button[aria-label="Guardar"]');
                  if (saveBtn) {
                    saveBtn.click();
                    console.log(`✅ [Observer] Chat ${chatIndex + 1} tageado con "${nomenclatura}"`);
                    setTimeout(onComplete, 3000);
                  } else {
                    console.warn('[Observer] No se encontró el botón Guardar');
                    setTimeout(onComplete, 2000);
                  }
                }, 1000);
              }
            } else if (intentos < maxIntentos) {
              intentos++;
              setTimeout(buscarTextareaYTaggear, 1000);
            } else {
              console.warn('[Observer] No se encontró el textarea tras varios intentos');
              setTimeout(onComplete, 2000);
            }
          }
          
          setTimeout(buscarTextareaYTaggear, 4000);
        } else {
          console.warn('[Observer] No se encontró el botón de edición');
          setTimeout(onComplete, 2000);
        }
      }, 600);
    } else {
      console.warn('[Observer] No se encontró el <p> Observaciones');
      setTimeout(onComplete, 2000);
    }
  },
  
  startObserveIteration() {
    console.log('🔍 Iniciando observación CONTINUA y TAGEO automático de chats de HOY...');
    console.log('♻️ El observer buscará y tageará nuevos chats cada 30 segundos automáticamente');
    this.stopProcess = false;
    this.scrollAndObserveChats();
  },
  
  stopObserveIteration() {
    this.stopProcess = true;
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
  },
  
  /**
   * Guarda los datos en localStorage agrupados por NOMENCLATURA
   * También guarda la asociación nomenclatura → panel para usar al tagear
   * @param {string} nomenclatura - Nomenclatura del mensaje (ej: "11-12-19A")
   * @param {string} url - URL del mensaje
   * @param {string} panelOriginal - Nombre original del panel
   */
  saveToLocalStorage(nomenclatura, url, panelOriginal) {
    try {
      // 1. Guardar datos de mensajes por nomenclatura
      const dataStr = localStorage.getItem('clientify_chat_data');
      const data = dataStr ? JSON.parse(dataStr) : {};
      
      if (!data[nomenclatura]) {
        data[nomenclatura] = {};
      }
      
      if (!data[nomenclatura][url]) {
        data[nomenclatura][url] = 0;
      }
      data[nomenclatura][url]++;
      
      localStorage.setItem('clientify_chat_data', JSON.stringify(data));
      
      // 2. Guardar asociación nomenclatura → panel (para tagear después)
      const mappingStr = localStorage.getItem('clientify_nomenclatura_panel_mapping');
      const mapping = mappingStr ? JSON.parse(mappingStr) : {};
      
      if (!mapping[nomenclatura]) {
        mapping[nomenclatura] = panelOriginal;
        localStorage.setItem('clientify_nomenclatura_panel_mapping', JSON.stringify(mapping));
      }
    } catch (error) {
      console.error('[Observer] ❌ Error al guardar en localStorage:', error);
    }
  }
};
