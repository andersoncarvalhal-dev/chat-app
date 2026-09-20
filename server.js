const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Define a pasta 'public' para servir os arquivos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal (página inicial)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Lógica de WebSocket
io.on('connection', (socket) => {
  socket.on('join', (username) => {
    socket.username = username || 'Anônimo';
    io.emit('chat message', { 
      user: 'Sistema', 
      text: `${socket.username} entrou no chat.` 
    });
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', { user: socket.username, text: msg });
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      io.emit('chat message', { 
        user: 'Sistema', 
        text: `${socket.username} saiu do chat.` 
      });
    }
  });
});

// O alojamento injeta a porta correta na variável process.env.PORT
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});