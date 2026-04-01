const jwt = require('jsonwebtoken');
const User = require('../models/User');

const jwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
};

const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const decoded = jwt.verify(token, jwtSecret());
    const user = await User.findById(decoded.id).select('-password -otp -otpExpiry');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const decoded = jwt.verify(token, jwtSecret());
      const user = await User.findById(decoded.id).select('-password -otp -otpExpiry');
      req.user = user;
    }
  } catch (_) {}
  next();
};

module.exports = { protect, optionalAuth };
