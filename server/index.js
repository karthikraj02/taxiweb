require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { initSocket } = require('./socket');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const pricingRoutes = require('./routes/pricing');
const paymentRoutes = require('./routes/payments');
const driverRoutes = require('./routes/drivers');

const app = express();
const server = http.createServer(app);

connectDB();
initSocket(server);

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// General API rate limiter (100 req / 15 min per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' }
});

// CSRF protection: for state-changing requests verify Origin matches allowed origin
const csrfProtection = (req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();
  const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:3000';
  const origin = req.headers.origin || req.headers.referer || '';
  if (origin && !origin.startsWith(allowedOrigin)) {
    return res.status(403).json({ message: 'CSRF check failed' });
  }
  next();
};

app.use('/api', apiLimiter);
app.use('/api', csrfProtection);

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/drivers', driverRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
