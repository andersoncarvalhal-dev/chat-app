const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { 
    origin: [
      "https://chat.pimencon.com.br", 
      "https://chat-app-y554.onrender.com"], 
    methods: ["GET", "POST"] 
  },
  maxHttpBufferSize: 5e6 
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
      try {
        await pool.query(`ALTER TABLE messages ADD COLUMN type VARCHAR(20) DEFAULT 'text'`);
      } catch (e) {}
      console.log("✅ Banco de dados pronto e protegido!");
    } catch (err) {
      console.error("❌ ERRO no PostgreSQL:", err.message);
    }
  }
}
initDB();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 2. SEGURANÇA: Rota administrativa agora protegida por "senha" via Query Param
app.get('/limpar-dados', async (req, res) => {
  // A senha definida aqui é 'admin123'
  if (req.query.senha !== 'admin123') {
    return res.status(403).send("<h1>❌ Acesso Negado!</h1><p>Senha incorreta ou ausente. Esta área é restrita.</p>");
  }

  if (!process.env.DATABASE_URL) return res.status(400).send("Sem banco de dados.");
  try {
    await pool.query('DELETE FROM messages');
    io.emit('clear chat');
    res.send("<h1>✅ Banco limpo com sucesso!</h1><a href='/'>Voltar para o chat</a>");
  } catch (err) {
    res.status(500).send("Erro ao limpar banco.");
  }
});

io.on('connection', (socket) => {
  
  socket.on('join', async (username) => {
    // 3. SEGURANÇA: Proteção de Identidade (Impede falsificação do "Sistema")
    let nomeSeguro = username ? username.trim() : 'Anónimo';
    const nomeBaixo = nomeSeguro.toLowerCase();
    
    if (nomeBaixo === 'sistema' || nomeBaixo === 'admin' || nomeBaixo === 'administrador') {
      nomeSeguro = nomeSeguro + '_aluno'; // Altera o nome à força
    }
    
    socket.username = nomeSeguro;
    
    if (process.env.DATABASE_URL) {
      try {
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

    io.emit('chat message', { user: 'Sistema', content: `${socket.username} entrou no chat.`, type: 'system', created_at: new Date() });
  });

  socket.on('chat message', async (data) => {
    if (!socket.username) return; // Se não tem nome, ignora

    let type = data.type || 'text';
    let content = data.content || '';

    // SEGURANÇA Extra de tamanho (redundante ao maxHttpBufferSize, mas útil para avisar o cliente)
    if (content.length > 5.5 * 1024 * 1024) {
      return socket.emit('chat message', { user: 'Sistema', content: '❌ A sua mídia é muito grande e foi bloqueada.', type: 'system', created_at: new Date() });
    }

    // 4. SEGURANÇA: Sanitização no Backend (Previne XSS - Injeção de Scripts)
    if (type === 'text') {
      content = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    const now = new Date();

    if (process.env.DATABASE_URL) {
      try {
        await pool.query('INSERT INTO messages (username, text, type, created_at) VALUES ($1, $2, $3, $4)', 
        [socket.username, content, type, now]);
      } catch (err) {
        console.error('Erro salvar:', err);
      }
    }
    
    io.emit('chat message', { user: socket.username, content: content, type: type, created_at: now });
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