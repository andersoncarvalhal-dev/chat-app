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
    item.innerHTML = `<em style="color: gray;">${data.text}</em>`;
  } else {
    item.innerHTML = `<strong>${data.user}:</strong> ${data.text}`;
  }
  
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
});