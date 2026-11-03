const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./drainfeed.db', (err) => {
    if (err) console.error("Erro ao conectar no Tanque:", err);
    else console.log("Conectado ao Tanque (SQLite).");
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            url TEXT,
            thumbnail_url TEXT,
            lifecycle_type TEXT,
            category TEXT,
            status TEXT DEFAULT 'PENDING',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            token_balance INTEGER DEFAULT 0,
            current_streak INTEGER DEFAULT 0,
            multiplier REAL DEFAULT 1.0,
            active_theme TEXT DEFAULT '#9D00FF'
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS token_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            video_id INTEGER,
            amount INTEGER,
            action_type TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS shop_items (
            id TEXT PRIMARY KEY,
            name TEXT,
            cost INTEGER,
            type TEXT,
            value TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS user_inventory (
            user_id INTEGER,
            item_id TEXT,
            PRIMARY KEY (user_id, item_id)
        )
    `);

    db.run(`INSERT OR IGNORE INTO users (id, token_balance, current_streak) VALUES (1, 0, 0)`);
    
    db.run(`REPLACE INTO shop_items (id, name, cost, type, value) VALUES 
        ('theme_purple', 'Roxo', 0, 'COLOR_THEME', '#9D00FF'),
        ('theme_lime', 'Verde', 50, 'COLOR_THEME', '#CCFF00'),
        ('theme_amber', 'Âmbar', 100, 'COLOR_THEME', '#FFB000'),
        ('theme_cyan', 'Ciano', 150, 'COLOR_THEME', '#00F0FF'),
        ('theme_mono', 'Branco', 200, 'COLOR_THEME', '#FFFFFF')
    `);
    
    db.run(`INSERT OR IGNORE INTO user_inventory (user_id, item_id) VALUES (1, 'theme_purple')`);
});

app.post('/api/videos', (req, res) => {
    db.get(`SELECT COUNT(*) as count FROM videos WHERE status = 'PENDING'`, [], (err, row) => {
        if (err) return res.status(500).json({ error: "Erro ao verificar capacidade do tanque." });
        
        if (row.count >= 50) {
            console.log(`[!] Bloqueado: Tentativa de transbordamento. O tanque está cheio.`);
            return res.status(403).json({ error: "TANQUE CHEIO", capacity_reached: true });
        }

        const { title, url, thumbnail_url, lifecycle_type, category } = req.body;
        const query = `INSERT INTO videos (title, url, thumbnail_url, lifecycle_type, category) VALUES (?, ?, ?, ?, ?)`;
        
        db.run(query, [title, url, thumbnail_url, lifecycle_type, category], function(err) {
            if (err) return res.status(500).json({ error: "Falha ao encher o tanque." });
            console.log(`[+] Vídeo Adicionado: ${title}`);
            res.json({ success: true, id: this.lastID });
        });
    });
});

app.get('/api/videos', (req, res) => {
    db.all(`SELECT * FROM videos WHERE status = 'PENDING' ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar o Tanque." });
        res.json(rows);
    });
});

app.patch('/api/videos/:id', (req, res) => {
    const { action } = req.body;
    const videoId = req.params.id;
    const status = action === 'DRAIN' ? 'DRAINED' : 'ERASED';

    db.get(`SELECT (julianday('now') - julianday(created_at)) * 24 * 60 AS minutes_old FROM videos WHERE id = ?`, [videoId], (err, video) => {
        if (err || !video) return res.status(500).json({ error: "Vídeo não encontrado." });

        let earnedTokens = 0;
        
        if (video.minutes_old >= 10) {
            earnedTokens = action === 'DRAIN' ? 10 : 5;
        } else {
            console.log(`[!] Vídeo ${videoId} muito recente (${Math.round(video.minutes_old)} min). Zero tokens gerados.`);
        }

        db.run(`UPDATE videos SET status = ? WHERE id = ?`, [status, videoId], function(updateErr) {
            if (updateErr) return res.status(500).json({ error: "Erro ao processar vídeo." });

            if (earnedTokens > 0) {
                db.serialize(() => {
                    db.run(`INSERT INTO token_ledger (user_id, video_id, amount, action_type) VALUES (1, ?, ?, ?)`, 
                        [videoId, earnedTokens, action]);
                    
                    db.run(`UPDATE users SET token_balance = token_balance + ?, current_streak = current_streak + 1 WHERE id = 1`, [earnedTokens]);
                });
                console.log(`[$] +${earnedTokens} Tokens concedidos pela ação: ${action}`);
            }

            res.json({ success: true, action: action, tokens_earned: earnedTokens });
        });
    });
});

app.get('/api/user', (req, res) => {
    db.get(`SELECT token_balance, current_streak, multiplier, active_theme FROM users WHERE id = 1`, (err, row) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar usuário." });
        res.json(row);
    });
});

app.get('/api/daily-goal', (req, res) => {
    const query = `
        SELECT COUNT(*) as drained_today 
        FROM token_ledger 
        WHERE action_type = 'DRAIN' AND date(created_at, 'localtime') = date('now', 'localtime')
    `;
    db.get(query, [], (err, row) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar meta." });
        res.json({ drained_today: row.drained_today || 0, daily_target: 3 }); 
    });
});

app.get('/api/shop', (req, res) => {
    db.all(`
        SELECT s.*, 
        CASE WHEN i.item_id IS NOT NULL THEN 1 ELSE 0 END AS unlocked
        FROM shop_items s
        LEFT JOIN user_inventory i ON s.id = i.item_id AND i.user_id = 1
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Erro ao carregar a loja." });
        res.json(rows);
    });
});

app.post('/api/shop/buy', (req, res) => {
    const { itemId } = req.body;

    db.get(`SELECT cost, value FROM shop_items WHERE id = ?`, [itemId], (err, item) => {
        if (err || !item) return res.status(404).json({ error: "Item não encontrado." });

        db.get(`SELECT token_balance FROM users WHERE id = 1`, (err, user) => {
            if (err) return res.status(500).json({ error: "Erro interno." });

            if (user.token_balance < item.cost) {
                return res.status(400).json({ error: "Tokens insuficientes!" });
            }

            db.serialize(() => {
                db.run(`UPDATE users SET token_balance = token_balance - ? WHERE id = 1`, [item.cost]);
                db.run(`INSERT OR IGNORE INTO user_inventory (user_id, item_id) VALUES (1, ?)`, [itemId]);
                db.run(`UPDATE users SET active_theme = ? WHERE id = 1`, [item.value]);
            });

            console.log(`[$] Tema adquirido/equipado: ${itemId}`);
            res.json({ success: true, theme_value: item.value });
        });
    });
});

app.post('/api/shop/equip', (req, res) => {
    const { themeValue } = req.body;
    db.run(`UPDATE users SET active_theme = ? WHERE id = 1`, [themeValue], function(err) {
        if (err) return res.status(500).json({ error: "Erro ao equipar." });
        res.json({ success: true });
    });
});

app.post('/api/dev/:action', (req, res) => {
    const { action } = req.params;
    let query = "";
    
    if (action === 'break-streak') query = "UPDATE users SET current_streak = 0 WHERE id = 1";
    else if (action === 'add-streak') query = "UPDATE users SET current_streak = current_streak + 1 WHERE id = 1";
    else if (action === 'add-tokens') query = "UPDATE users SET token_balance = token_balance + 5000 WHERE id = 1";
    else if (action === 'reset-tokens') query = "UPDATE users SET token_balance = 0 WHERE id = 1";
    
    if (!query) return res.status(400).json({ error: "Ação inválida." });

    db.run(query, function(err) {
        if (err) return res.status(500).json({ error: "Erro no comando Dev." });
        res.json({ success: true, action });
    });
});

setInterval(() => {
    const query = `
        SELECT id FROM videos 
        WHERE status = 'PENDING' 
        AND lifecycle_type = 'PERISHABLE' 
        AND (julianday('now') - julianday(created_at)) * 24 >= 72
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) return console.error("Erro no Ralo:", err);
        
        if (rows.length > 0) {
            console.log(`[!] O RALO PUXOU ${rows.length} VÍDEOS PERECÍVEIS VENCIDOS.`);
            
            rows.forEach(video => {
                db.run(`UPDATE videos SET status = 'EXPIRED' WHERE id = ?`, [video.id]);
            });
            
            db.run(`UPDATE users SET current_streak = 0 WHERE id = 1`, function(err) {
                if (!err) console.log("[!] PUNIÇÃO APLICADA: Sua ofensiva foi zerada pelo acúmulo desnecessário.");
            });
        }
    });
}, 3600000);

app.listen(PORT, () => {
    console.log(`⚡ API do Drainfeed rodando na porta ${PORT}`);
    console.log(`🕒 Ralo automático ativado (Checagem de perecíveis a cada 1h).`);
});