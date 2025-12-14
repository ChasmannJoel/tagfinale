// --- Módulo para tagear chats ---
const chatTagger = {
  stopProcess: false,
  scrollTimeoutId: null,
  
  scrollAndTagChats() {
    chatOpener.scrollChatsUntilStopOrEnd(this.iterateTagChats.bind(this));
  },
  
  iterateTagChats(chatDivs) {
    let index = 0;
    const self = this;
    
    async function clickNextChat() {
      if (self.stopProcess) {
        console.log("⏹️ Proceso de tagear detenido por el usuario.");
        return;
      }
      
      if (index >= chatDivs.length) {
        console.log("✅ Terminó de tagear todos los chats.");
        return;
      }
      
      const chat = chatDivs[index];
      if (chat) {
        chat.scrollIntoView({ behavior: "smooth", block: "center" });
        chat.click();
        console.log(`[Tagear] 💬 Chat ${index + 1} abierto`);
        
        setTimeout(async () => {
          const chatWindow = document.querySelector('.mui-npbckn');
          if (chatWindow && typeof chatWindow.scrollTop === 'number') {
            chatWindow.scrollBy({ top: 120, behavior: 'smooth' });
          }
          
          // Espera adicional para asegurar que el DOM esté listo
          setTimeout(async () => {
            // Extraer información del chat usando el urlDetector
            const urlInfo = await urlDetector.extractUrlFromChat();
            
            // Si no es de hoy o no tiene nomenclatura, saltar este chat
            if (!urlInfo || !urlInfo.nomenclatura) {
              console.log(`⏭️ Chat ${index + 1} saltado (no es de hoy o sin nomenclatura)`);
              index++;
              setTimeout(clickNextChat, 2000);
              return;
            }
            
            const nomenclatura = urlInfo.nomenclatura;
            console.log(`📋 Usando nomenclatura: ${nomenclatura}`);
            
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
                  
                  // Intentar encontrar el textarea con reintentos y más tiempo
                  let intentos = 0;
                  const maxIntentos = 8; // hasta 8 intentos (~8 segundos)
                  
                  function buscarTextareaYTaggear() {
                    const textarea = document.querySelector('textarea.mui-16j0ffk');
                    if (textarea) {
                      const actual = textarea.value.trim();
                      const codigos = actual.split(',').map(c => c.trim()).filter(c => c.length > 0);
                      
                      // Verificar si ya tiene el código asignado
                      if (codigos.includes(nomenclatura)) {
                        console.log(`✅ Chat ${index + 1} ya tiene el código "${nomenclatura}", saltando...`);
                        // Cerrar el editor sin guardar
                        const cancelBtn = document.querySelector('button[aria-label="Cancelar"]');
                        if (cancelBtn) cancelBtn.click();
                      } else {
                        // Agregar el nuevo código
                        const nuevoValor = actual ? actual + ', ' + nomenclatura : nomenclatura;
                        textarea.value = nuevoValor;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        setTimeout(() => {
                          const saveBtn = document.querySelector('button[aria-label="Guardar"]');
                          if (saveBtn) {
                            saveBtn.click();
                            console.log(`✅ Chat ${index + 1} tageado con "${nomenclatura}"`);
                          } else {
                            console.warn('No se encontró el botón Guardar');
                          }
                        }, 1000);
                      }
                    } else if (intentos < maxIntentos) {
                      intentos++;
                      setTimeout(buscarTextareaYTaggear, 1000); // espera 1 segundo y reintenta
                    } else {
                      console.warn('No se encontró el textarea tras varios intentos');
                    }
                  }
                  
                  setTimeout(buscarTextareaYTaggear, 4000); // primer intento tras 4 segundos
                } else {
                  console.warn('No se encontró el botón de edición');
                }
              }, 600); // Espera tras el hover para que aparezca el botón
            } else {
              console.warn('No se encontró el <p> Observaciones');
            }
            
            index++;
            setTimeout(clickNextChat, 4000);
          }, 4000); // Espera 4 segundos extra tras abrir el chat
        }, 1200);
      } else {
        index++;
        setTimeout(clickNextChat, 4000);
      }
    }
    
    clickNextChat();
  },
  
  startTagIteration() {
    console.log('🏷️ Iniciando proceso de tageo automático con nomenclaturas del observer...');
    this.stopProcess = false;
    this.scrollAndTagChats();
  },
  
  stopTagIteration() {
    this.stopProcess = true;
    if (this.scrollTimeoutId) {
      clearTimeout(this.scrollTimeoutId);
      this.scrollTimeoutId = null;
      console.log("⏹️ [Tagear] Scroll automático detenido.");
    }
  }
};
