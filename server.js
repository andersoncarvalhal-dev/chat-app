const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Pool } = require('pg'); // NOVO: Importa o PostgreSQL

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// NOVO: Configuração do Banco de Dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Necessário para serviços na nuvem
});

// NOVO: Cria a tabela de mensagens automaticamente ao ligar o servidor
pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50),
    text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error('Erro ao criar tabela:', err));


app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  
  socket.on('join', async (username) => {
    socket.username = username;
    
    // NOVO: Puxa as últimas 50 mensagens do Banco de Dados
    if (process.env.DATABASE_URL) {
      try {
        // Pega as últimas 50 mensagens e ordena da mais antiga para a mais nova
        const result = await pool.query(`
          SELECT username as user, text 
          FROM (SELECT id, username, text FROM messages ORDER BY id DESC LIMIT 50) AS sub 
          ORDER BY id ASC;
        `);
        // Envia o histórico só para a pessoa que acabou de entrar
        socket.emit('chat history', result.rows);
      } catch (err) {
        console.error('Erro ao buscar histórico:', err);
      }
    }

    io.emit('chat message', { user: 'Sistema', text: `${username} entrou no chat.` });
  });

  socket.on('chat message', async (msg) => {
    // NOVO: Salva a mensagem no Banco de Dados
    if (process.env.DATABASE_URL && socket.username) {
      try {
        await pool.query('INSERT INTO messages (username, text) VALUES ($1, $2)', [socket.username, msg]);
      } catch (err) {
        console.error('Erro ao salvar mensagem:', err);
      }
    }
    
    io.emit('chat message', { user: socket.username, text: msg });
  });

  socket.on('typing', (user) => { socket.broadcast.emit('typing', user); });
  socket.on('stop typing', () => { socket.broadcast.emit('stop typing'); });

  socket.on('disconnect', () => {
    socket.broadcast.emit('stop typing');
    if (socket.username) {
      io.emit('chat message', { user: 'Sistema', text: `${socket.username} saiu do chat.` });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});