// index.js (Updated with Security Enhancements)
// 1. Load environment variables from .env file
require('dotenv').config();

// 2. Import dependencies
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan'); // Optional: HTTP request logger
const cors = require('cors'); // Optional: Enable CORS
const helmet = require('helmet'); // ?? Added security headers
const rateLimit = require('express-rate-limit'); // ?? Added rate limiting
const compression = require('compression');
const path = require('path');
const { cleanOrphanedImages } = require('./utils/cleanup');
const cron = require('node-cron');
// Run daily at 3 AM
cron.schedule('0 3 * * *', cleanOrphanedImages);

// 3. Create Express app
const app = express();
const port = process.env.PORT || 3000;

// ?? Rate limiter configuration (15 minutes, max 100 requests per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  validate: { xForwardedForHeader: false } // Disable XFF validation
});

// 4. Middleware
app.set('trust proxy', 1); // ?? Only if behind a proxy (e.g., Nginx, Heroku)
app.use(helmet()); // ?? Added security headers
app.use(cors()); // Enable CORS for all routes
app.use(morgan('dev')); // Log HTTP requests
app.use(limiter); // ?? Added rate limiting to all routes
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data
app.use(compression());
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ 
      error: 'Invalid JSON format',
      details: {
        message: err.message,
        position: err.byteOffset,
        snippet: err.body
      }
    });
  }
  next();
});
// 5. Database connection (MongoDB example)
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Graceful shutdown handler for development
process.on('SIGINT', () => {
  mongoose.connection.close()
    .then(() => {
      console.log('\nMongoDB connection closed');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error closing MongoDB connection:', err);
      process.exit(1);
    });
});

// Graceful shutdown for production (e.g., Docker containers)
process.on('SIGTERM', () => {
  mongoose.connection.close()
    .then(() => {
      console.log('\nMongoDB connection closed');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error closing MongoDB connection:', err);
      process.exit(1);
    });
});
// 6. Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users'); // Import routes
const stateRoutes = require('./routes/states'); // Import routes
const cityRoutes = require('./routes/cities');
const locationRoutes = require('./routes/locations');
const carRoutes = require('./routes/cars');
const reservationRoutes = require('./routes/reservations');

app.get('/', (req, res) => {
  res.send('Welcome to my Node.js API!');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/states', stateRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/images', express.static(path.join(__dirname, '../uploads')));
//app.use('/images', express.static(path.join(__dirname, 'uploads')));
// 7. Error handling middleware
// Handle 404 - Route not found
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});
// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 8. Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
