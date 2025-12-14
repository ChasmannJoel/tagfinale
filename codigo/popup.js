document.getElementById("observarChatsBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: "observarChats" });
});

document.getElementById("verDatosBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: "verDatos" });
});

document.getElementById("detenerChatsBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: "detenerChats" });
});

// Recibe y muestra mensajesInfo en el popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "mostrarMensajesInfo") {
    const mensajesDiv = document.getElementById('mensajesInfo');
    if (mensajesDiv) {
      mensajesDiv.innerText = JSON.stringify(message.data, null, 2);
    } else {
      alert(JSON.stringify(message.data, null, 2));
    }
  }
});
