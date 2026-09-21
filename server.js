const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ["https://chat.pimencon.com.br", "chat-app-y554.onrender.com"], methods: ["GET", "POST"] }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  if (process.env.DATABASE_URL) {
    try {
      // 1. Cria a tabela base se não existir
      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50),
          text TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // 2. Adiciona a coluna "type" (texto, imagem, audio) de forma segura caso já exista a tabela
      try {
        await pool.query(`ALTER TABLE messages ADD COLUMN type VARCHAR(20) DEFAULT 'text'`);
      } catch (e) {
        // Se der erro, é porque a coluna já existe. Tudo bem!
      }
      
      console.log("✅ Banco de dados configurado para suportar mídias!");
    } catch (err) {
      console.error("❌ ERRO ao configurar o PostgreSQL:", err.message);
    }
  }
}
initDB();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/limpar-dados', async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(400).send("Sem banco de dados.");
  try {
    await pool.query('DELETE FROM messages');
    io.emit('clear chat');
    res.send("<h1>✅ Banco limpo!</h1><a href='/'>Voltar</a>");
  } catch (err) {
    res.status(500).send("Erro ao limpar banco.");
  }
});

io.on('connection', (socket) => {
  
  socket.on('join', async (username) => {
    socket.username = username;
    
    if (process.env.DATABASE_URL) {
      try {
        // Agora puxamos o texto (como content), o tipo e a data de criação
        const result = await pool.query(`
          SELECT username as user, text as content, type, created_at 
          FROM (SELECT id, username, text, type, created_at FROM messages ORDER BY id DESC LIMIT 50) AS sub 
          ORDER BY id ASC;
        `);
        socket.emit('chat history', result.rows);
      } catch (err) {
        console.error('Erro histórico:', err);
      }
    }

    io.emit('chat message', { user: 'Sistema', content: `${username} entrou no chat.`, type: 'system', created_at: new Date() });
  });

  socket.on('chat message', async (data) => {
    // Agora o data é um objeto { type: '...', content: '...' }
    const type = data.type || 'text';
    const content = data.content || '';
    const now = new Date(); // Hora atual

    if (process.env.DATABASE_URL && socket.username) {
      try {
        await pool.query('INSERT INTO messages (username, text, type, created_at) VALUES ($1, $2, $3, $4)', 
        [socket.username, content, type, now]);
      } catch (err) {
        console.error('Erro salvar:', err);
      }
    }
    
    
    io.emit('chat message', { 
      user: socket.username, 
      content: content, 
      type: type, 
      created_at: now 
    });
  });

  socket.on('typing', (user) => { socket.broadcast.emit('typing', user); });
  socket.on('stop typing', () => { socket.broadcast.emit('stop typing'); });

  socket.on('disconnect', () => {
    socket.broadcast.emit('stop typing');
    if (socket.username) {
      io.emit('chat message', { user: 'Sistema', content: `${socket.username} saiu do chat.`, type: 'system', created_at: new Date() });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));