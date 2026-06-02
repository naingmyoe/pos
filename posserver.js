// pos-api/server.js

const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();
app.use(express.json());

// 🟢 Web Panel ဖိုင်များ (HTML/CSS/JS) ကို Public ဖိုင်ဒါမှတစ်ဆင့် လွှင့်ပေးမည်
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    user: 'naing',
    host: '127.0.0.1', // 🟢 'localhost' အစား '127.0.0.1' ဟု ပြင်ပေးပါ
    database: 'pos_cloud_db',
    password: 'naing', 
    port: 5432,
});

// Database Table များ မရှိသေးပါက အလိုအလျောက် တည်ဆောက်ပေးမည်
const initDB = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(50) NOT NULL,
            shop_name VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS products (
            id VARCHAR(50) PRIMARY KEY,
            user_id INTEGER REFERENCES users(id), -- 🟢 User ID နှင့် ချိတ်ဆက်ထားသည်
            name VARCHAR(100),
            barcode VARCHAR(50),
            category_id VARCHAR(50),
            cost_price NUMERIC,
            retail_price NUMERIC,
            stock_qty INTEGER,
            unit VARCHAR(20),
            is_synced INTEGER DEFAULT 1,
            updated_at TIMESTAMP
        );
    `);
    console.log("Database Tables Checked/Created.");
};
initDB();

// ==========================================
// 🌐 WEB PANEL (ADMIN) API ROUTES
// ==========================================

// ၁။ User အားလုံးကို ဆွဲထုတ်ရန်
app.get('/api/admin/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, shop_name, created_at FROM users ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ၂။ User အသစ် တည်ဆောက်ရန်
app.post('/api/admin/users', async (req, res) => {
    const { username, password, shop_name } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO users (username, password, shop_name) VALUES ($1, $2, $3) RETURNING id, username, shop_name',
            [username, password, shop_name]
        );
        res.status(201).json({ message: "User အသစ်ဖန်တီးပြီးပါပြီ", user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ၃။ သီးသန့် User တစ်ယောက်၏ ကုန်စည် Data များကို ကြည့်ရှုရန်
app.get('/api/admin/users/:userId/products', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query('SELECT * FROM products WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 📱 MOBILE APP (POS) API ROUTES
// ==========================================

app.post('/api/sync-products', async (req, res) => {
    const { user_id, products } = req.body; // App မှ sync လုပ်ရာတွင် user_id ပါထည့်ပို့ရမည်
    if (!products || !Array.isArray(products) || !user_id) return res.status(400).json({ message: "Data ပုံစံမှားနေပါသည်" });

    try {
        for (let prod of products) {
            const queryText = `
                INSERT INTO products (id, user_id, name, barcode, category_id, cost_price, retail_price, stock_qty, unit, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE 
                SET name = $3, barcode = $4, category_id = $5, cost_price = $6, retail_price = $7, stock_qty = $8, unit = $9, updated_at = $10
            `;
            const values = [prod.id, user_id, prod.name, prod.barcode, prod.category_id, prod.cost_price, prod.retail_price, prod.stock_qty, prod.unit, prod.updated_at];
            await pool.query(queryText, values);
        }
        res.status(200).json({ message: "Sync အောင်မြင်ပါသည်" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`VPS Server running on port ${PORT}`));
