const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/payments_db'
});

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      items JSONB NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      payment_status VARCHAR(20) DEFAULT 'pending',
      shipping_address JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      product_id VARCHAR(100) NOT NULL,
      product_name VARCHAR(200) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      quantity INTEGER DEFAULT 1,
      size VARCHAR(10),
      color VARCHAR(50),
      image_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ Payments DB initialized');
};

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'payments' }));

// --- CART ---
app.get('/api/payments/cart/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cart_items WHERE user_id = $1', [req.params.userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments/cart', async (req, res) => {
  try {
    const { userId, productId, productName, price, quantity, size, color, imageUrl } = req.body;
    // Check if item exists in cart
    const existing = await pool.query(
      'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2 AND size = $3',
      [userId, productId, size]
    );
    if (existing.rows.length > 0) {
      const updated = await pool.query(
        'UPDATE cart_items SET quantity = quantity + $1 WHERE id = $2 RETURNING *',
        [quantity || 1, existing.rows[0].id]
      );
      return res.json(updated.rows[0]);
    }
    const result = await pool.query(
      'INSERT INTO cart_items (user_id, product_id, product_name, price, quantity, size, color, image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [userId, productId, productName, price, quantity || 1, size, color, imageUrl]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/payments/cart/:userId/:itemId', async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [req.params.itemId, req.params.userId]);
    res.json({ message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CHECKOUT (mock payment) ---
app.post('/api/payments/checkout', async (req, res) => {
  try {
    const { userId, items, shippingAddress, cardNumber } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ error: 'Cart is empty' });

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Mock payment processing
    const paymentApproved = cardNumber && cardNumber.startsWith('4'); // Visa mock: starts with 4 = approved

    const status = paymentApproved ? 'confirmed' : 'failed';
    const paymentStatus = paymentApproved ? 'approved' : 'declined';

    const result = await pool.query(
      'INSERT INTO orders (user_id, items, total, status, payment_status, shipping_address) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [userId, JSON.stringify(items), total.toFixed(2), status, paymentStatus, JSON.stringify(shippingAddress)]
    );

    if (paymentApproved) {
      await pool.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
    }

    res.status(201).json({
      order: result.rows[0],
      message: paymentApproved ? '✅ Payment approved!' : '❌ Payment declined. Check your card number.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get orders by user
app.get('/api/payments/orders/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, async () => {
  await initDB();
  console.log(`💳 Payments Service running on port ${PORT}`);
});
