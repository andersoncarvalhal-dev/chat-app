const socket = io();
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');

const loginOverlay = document.getElementById('login-overlay');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');

let username = '';
let typingTimer;

// Função para gerar sempre a mesma cor para o mesmo nome
function getUserColor(name) {
  const colors = ['#35CD96', '#ff5252', '#448aff', '#ffb300', '#ab47bc', '#00bfa5', '#e91e63'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function joinChat() {
  const name = usernameInput.value.trim();
  if (name) {
    username = name;
    loginOverlay.style.display = 'none';
    socket.emit('join', username);
  }
}

joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinChat();
});

// Lógica dos Emojis
document.getElementById('emoji-btn').addEventListener('click', () => {
  document.getElementById('emoji-picker').classList.toggle('hidden');
});

document.querySelectorAll('.emoji').forEach(emoji => {
  emoji.addEventListener('click', (e) => {
    input.value += e.target.innerText;
    document.getElementById('emoji-picker').classList.add('hidden');
    input.focus();
  });
});

// Lógica de envio (Esconde o emoji picker se estiver aberto)
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value && username) {
    socket.emit('chat message', input.value);
    input.value = '';
    socket.emit('stop typing');
    document.getElementById('emoji-picker').classList.add('hidden');
  }
});

// Evento: Alguém está a escrever
input.addEventListener('input', () => {
  if (username) socket.emit('typing', username);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit('stop typing');
  }, 1500); // Para de mostrar após 1.5s sem digitar
});

socket.on('typing', (user) => {
  typingIndicator.innerText = `${user} Está Digitando...`;
  typingIndicator.style.display = 'block';
});

socket.on('stop typing', () => {
  typingIndicator.style.display = 'none';
});

// Recebendo mensagens
socket.on('chat message', (data) => {
  const item = document.createElement('li');
  
  // Proteção contra injeção de código (XSS) e formatação
  const safeText = data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  if (data.user === 'Sistema') {
    item.classList.add('message-system');
    item.innerHTML = safeText;
  } else if (data.user === username) {
    item.classList.add('message-mine');
    item.innerHTML = `<div class="msg-text">${safeText}</div>`;
  } else {
    item.classList.add('message-other');
    const color = getUserColor(data.user);
    item.innerHTML = `<span class="user-name" style="color: ${color}">${data.user}</span>
                      <div class="msg-text">${safeText}</div>`;
  }
  
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
});

// Verifica quando o utilizador sai e volta para a aba do chat
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Se a página voltou a ficar visível e o socket estiver desconectado
    if (!socket.connected) {
      socket.connect(); // Força a reconexão imediatamente
      
      // Se o utilizador já tinha escolhido um nome, reenvia para o servidor
      if (username) {
        socket.emit('join', username);
      }
    }
  }
});