const socket = io();
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

const username = prompt("Digite seu nome de usuário:") || "Anônimo";

socket.emit('join', username);

form.addEventListener('submit', function(e) {
  e.preventDefault();
  if (input.value) {
    socket.emit('chat message', input.value);
    input.value = '';
  }
});

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