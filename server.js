const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Configuração do Banco de Dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Função para inicializar o banco de dados de forma segura
async function initDB() {
  if (process.env.DATABASE_URL) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50),
          text TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("✅ Tabela 'messages' verificada/criada com sucesso no PostgreSQL.");
    } catch (err) {
      console.error("❌ ERRO GRAVE ao criar tabela no PostgreSQL:", err.message);
    }
  } else {
    console.log("⚠️ Nenhuma DATABASE_URL encontrada. O chat vai funcionar apenas na memória (sem histórico).");
  }
}
initDB();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ROTA PARA EXCLUIR OS DADOS DO BANCO
app.get('/limpar-dados', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(400).send("⚠️ Banco de dados não configurado no servidor.");
  }
  
  try {
    await pool.query('DELETE FROM messages');
    io.emit('clear chat'); // Avisa os navegadores para limparem o ecrã
    res.send("<h1>✅ Banco de dados limpo com sucesso!</h1><p><a href='/'>Voltar para o chat</a></p>");
  } catch (err) {
    console.error("Erro ao limpar banco via rota:", err);
    res.status(500).send("❌ Erro ao limpar o banco de dados.");
  }
});

io.on('connection', (socket) => {
  
  socket.on('join', async (username) => {
    socket.username = username;
    
    // Puxa as últimas 50 mensagens do Banco de Dados
    if (process.env.DATABASE_URL) {
      try {
        const result = await pool.query(`
          SELECT username as user, text 
          FROM (SELECT id, username, text FROM messages ORDER BY id DESC LIMIT 50) AS sub 
          ORDER BY id ASC;
        `);
        socket.emit('chat history', result.rows);
      } catch (err) {
        console.error('Erro ao buscar histórico:', err);
      }
    }

    io.emit('chat message', { user: 'Sistema', text: `${username} entrou no chat.` });
  });

  socket.on('chat message', async (msg) => {
    // Salva a mensagem no Banco de Dados
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