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

function getUserColor(name) {
  const colors = ['#35CD96', '#ff5252', '#448aff', '#ffb300', '#ab47bc', '#00bfa5', '#e91e63'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') joinChat(); });

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

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value && username) {
    socket.emit('chat message', { type: 'text', content: input.value });
    input.value = '';
    socket.emit('stop typing');
    document.getElementById('emoji-picker').classList.add('hidden');
  }
});

const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  if (file.size > 3 * 1024 * 1024) {
    alert('A imagem é muito grande. Escolha uma imagem de até 3MB.');
    return;
  }

  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    socket.emit('chat message', { type: 'image', content: reader.result });
    fileInput.value = '';
  };
});

let mediaRecorder;
let audioChunks = [];
const micBtn = document.getElementById('mic-btn');

micBtn.addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    // Volta o ícone de microfone normal
    micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    micBtn.classList.remove('recording');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];
      
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        socket.emit('chat message', { type: 'audio', content: reader.result });
      };
    };

    mediaRecorder.start();
    // Troca para o ícone de 'Stop' (parar gravação)
    micBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
    micBtn.classList.add('recording');
  } catch (err) {
    alert('Não foi possível aceder ao microfone.');
  }
});

input.addEventListener('input', () => {
  if (username) socket.emit('typing', username);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit('stop typing'), 1500); 
});

socket.on('typing', (user) => {
  typingIndicator.innerText = `${user} está a escrever...`;
  typingIndicator.style.display = 'block';
});
socket.on('stop typing', () => typingIndicator.style.display = 'none');

function renderMessage(data) {
  const item = document.createElement('li');
  const timeHTML = `<span class="msg-time">${formatTime(data.created_at)}</span>`;
  let contentHTML = '';

  if (data.type === 'image') {
    contentHTML = `<img src="${data.content}" class="msg-image" />`;
  } else if (data.type === 'audio') {
    contentHTML = `<audio controls src="${data.content}" class="msg-audio"></audio>`;
  } else {
    let safeText = data.content ? data.content.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
    contentHTML = `<div class="msg-text">${safeText}</div>`;
  }
  
  if (data.type === 'system' || data.user === 'Sistema') {
    item.classList.add('message-system');
    item.innerHTML = data.content;
  } else if (data.user === username) {
    item.classList.add('message-mine');
    item.innerHTML = contentHTML + timeHTML;
  } else {
    item.classList.add('message-other');
    const color = getUserColor(data.user);
    item.innerHTML = `<span class="user-name" style="color: ${color}">${data.user}</span>
                      ${contentHTML} ${timeHTML}`;
  }
  
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
}

socket.on('chat history', (historyArray) => {
  historyArray.forEach(msg => renderMessage(msg));
});

socket.on('chat message', (data) => renderMessage(data));

socket.on('clear chat', () => messages.innerHTML = '');

socket.on('connect', () => {
  if (username) {
    socket.emit('join', username);
    socket.emit('stop typing');
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (socket.disconnected) socket.connect();
  } else {
    if (username) socket.emit('stop typing');
  }
});