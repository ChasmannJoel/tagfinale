// --- Módulo para abrir chats ---
const chatOpener = {
  stopProcess: false,
  scrollTimeoutId: null,
  openedChats: new Set(),
  
  getChatElements() {
    return Array.from(document.querySelectorAll('p'))
      .filter(p => p.textContent.includes('🕐'))
      .map(p => p.closest('div'));
  },
  
  scrollChatsContainerToEnd() {
    const scrollContainer = document.querySelector('.MuiBox-root.mui-2m10ek');
    if (scrollContainer && typeof scrollContainer.scrollHeight === 'number') {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
      console.log('⬇️ Buscando chats...');
    } else {
      console.warn('[AutoTag] No se encontró el contenedor de chats o scrollHeight no está disponible.');
    }
  },
  
  hasStopEmoji() {
    return Array.from(document.querySelectorAll('p.MuiTypography-root.MuiTypography-body1.mui-194rj03'))
      .some(p => p.textContent.includes('🤚🏻'));
  },
  
  scrollChatsUntilStopOrEnd(onFinish) {
    let lastScrollTop = -1;
    let reachedEnd = false;
    const self = this;
    
    function scrollUntilStopOrEnd() {
      if (self.stopProcess) {
        console.log("⏹️ [AutoTag] Proceso detenido durante el scroll.");
        return;
      }
      
      const scrollContainer = document.querySelector('.MuiBox-root.mui-2m10ek');
      
      if (self.hasStopEmoji()) {
        console.log("🛑 Emoji de stop encontrado, deteniendo el scroll. Abriendo todos los chats con emoji 🕐 visibles.");
        reachedEnd = true;
      } else if (scrollContainer) {
        if (scrollContainer.scrollTop === lastScrollTop && scrollContainer.scrollTop >= scrollContainer.scrollHeight - scrollContainer.clientHeight) {
          console.log("🏁 Fin del scroll detectado. Abriendo todos los chats con emoji 🕐 visibles.");
          reachedEnd = true;
        } else {
          self.scrollChatsContainerToEnd();
          lastScrollTop = scrollContainer.scrollTop;
        }
      }
      
      if (reachedEnd) {
        const chatDivs = self.getChatElements();
        console.log(`Encontrados ${chatDivs.length} chats con emoji 🕐.`);
        if (chatDivs.length === 0) {
          console.warn("⚠️ No se encontraron chats con emoji 🕐.");
          return;
        }
        if (typeof onFinish === 'function') onFinish(chatDivs);
        return;
      }
      
      self.scrollTimeoutId = setTimeout(scrollUntilStopOrEnd, 3000);
    }
    
    scrollUntilStopOrEnd();
  },
  
  scrollAndOpenChats() {
    this.scrollChatsUntilStopOrEnd(this.iterateChats.bind(this));
  },
  
  iterateChats(chatDivs) {
    let index = 0;
    const self = this;
    
    function clickNextChat() {
      if (self.stopProcess) {
        console.log("⏹️ Proceso detenido por el usuario.");
        return;
      }
      
      if (index >= chatDivs.length) {
        console.log("✅ Terminó de abrir todos los chats.");
        return;
      }
      
      const chat = chatDivs[index];
      if (chat) {
        chat.scrollIntoView({ behavior: "smooth", block: "center" });
        chat.click();
        console.log(`💬 Chat ${index + 1} abierto`);
        self.openedChats.add(chat);
        
        setTimeout(() => {
          const chatWindow = document.querySelector('.mui-npbckn');
          if (chatWindow && typeof chatWindow.scrollTop === 'number') {
            chatWindow.scrollBy({ top: 120, behavior: 'smooth' });
          }
          index++;
          setTimeout(clickNextChat, 4000);
        }, 1200);
      } else {
        index++;
        setTimeout(clickNextChat, 4000);
      }
    }
    
    clickNextChat();
  },
  
  startChatIteration() {
    this.stopProcess = false;
    this.openedChats.clear();
    this.scrollAndOpenChats();
  },
  
  stopChatIteration() {
    this.stopProcess = true;
    if (this.scrollTimeoutId) {
      clearTimeout(this.scrollTimeoutId);
      this.scrollTimeoutId = null;
      console.log("⏹️ [AutoTag] Scroll automático detenido.");
    }
  }
};
