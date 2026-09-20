const socket = io();
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

// Elementos da janela de login
const loginOverlay = document.getElementById('login-overlay');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');

let username = '';

// Função para validar o nome e entrar
function joinChat() {
  const name = usernameInput.value.trim();
  if (name) {
    username = name;
    loginOverlay.style.display = 'none'; // Esconde a janela flutuante
    socket.emit('join', username);       // Avisa o servidor
  }
}

// Escuta o clique no botão ou a tecla Enter
joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    joinChat();
  }
});

// Evento de envio do formulário de chat
form.addEventListener('submit', function(e) {
  e.preventDefault();
  if (input.value && username) {
    socket.emit('chat message', input.value);
    input.value = '';
  }
});

// Evento de recebimento de mensagem
socket.on('chat message', function(data) {
  const item = document.createElement('li');
  
  if (data.user === 'Sistema') {
    item.classList.add('message-system');
    item.innerHTML = `<em>${data.text}</em>`;
  } else if (data.user === username) {
    item.classList.add('message-mine');
    item.innerHTML = `<strong>Você:</strong> ${data.text}`;
  } else {
    item.classList.add('message-other');
    item.innerHTML = `<strong>${data.user}:</strong> ${data.text}`;
  }
  
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
});