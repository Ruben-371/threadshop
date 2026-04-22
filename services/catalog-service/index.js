const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/catalog_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Catalog DB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: { type: String, enum: ['shirts', 'pants', 'dresses', 'accessories', 'shoes'], required: true },
  sizes: [{ type: String, enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] }],
  colors: [String],
  stock: { type: Number, default: 0 },
  imageUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// Seed data
const seedProducts = async () => {
  const count = await Product.countDocuments();
  if (count === 0) {
    await Product.insertMany([
      { name: 'Classic White Tee', description: 'Essential cotton t-shirt', price: 29.99, category: 'shirts', sizes: ['S', 'M', 'L', 'XL'], colors: ['white', 'black', 'gray'], stock: 50, imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400' },
      { name: 'Slim Fit Jeans', description: 'Modern slim fit denim', price: 79.99, category: 'pants', sizes: ['S', 'M', 'L', 'XL'], colors: ['blue', 'black'], stock: 30, imageUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400' },
      { name: 'Summer Dress', description: 'Light floral summer dress', price: 59.99, category: 'dresses', sizes: ['XS', 'S', 'M', 'L'], colors: ['floral', 'white'], stock: 25, imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400' },
      { name: 'Leather Belt', description: 'Genuine leather belt', price: 39.99, category: 'accessories', sizes: ['S', 'M', 'L'], colors: ['brown', 'black'], stock: 40, imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400' },
      { name: 'Sneakers Urban', description: 'Comfortable urban sneakers', price: 99.99, category: 'shoes', sizes: ['S', 'M', 'L', 'XL'], colors: ['white', 'black'], stock: 20, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400' },
      { name: 'Striped Polo', description: 'Classic striped polo shirt', price: 49.99, category: 'shirts', sizes: ['S', 'M', 'L', 'XL', 'XXL'], colors: ['navy', 'red', 'green'], stock: 35, imageUrl: 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=400' },
    ]);
    console.log('🌱 Products seeded');
  }
};

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'catalog' }));

// Get all products
app.get('/api/catalog/products', async (req, res) => {
  try {
    const { category, minPrice, maxPrice, search } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (minPrice || maxPrice) filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
    if (search) filter.name = { $regex: search, $options: 'i' };

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single product
app.get('/api/catalog/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create product
app.post('/api/catalog/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update stock
app.patch('/api/catalog/products/:id/stock', async (req, res) => {
  try {
    const { quantity } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { stock: -quantity } },
      { new: true }
    );
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, async () => {
  await seedProducts();
  console.log(`👗 Catalog Service running on port ${PORT}`);
});
