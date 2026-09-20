const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  socket.on('join', (username) => {
    socket.username = username;
    io.emit('chat message', { user: 'Sistema', text: `${username} entrou no chat.` });
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', { user: socket.username, text: msg });
  });

  // NOVO: Eventos de digitação ("Digitando...")
  socket.on('typing', (user) => {
    socket.broadcast.emit('typing', user);
  });

  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing');
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      io.emit('chat message', { user: 'Sistema', text: `${socket.username} saiu do chat.` });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});