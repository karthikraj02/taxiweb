const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { protect } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: 'Too many requests, please try again later' }
});

const generateTokens = async (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refreshTokenValue = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ token: refreshTokenValue, user: user._id, expiresAt });
  return { accessToken, refreshTokenValue };
};

const setTokenCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', accessToken, {
    httpOnly: true, secure: isProduction, sameSite: 'lax',
    maxAge: 15 * 60 * 1000
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true, secure: isProduction, sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!email && !phone) return res.status(400).json({ message: 'Email or phone is required' });
    if (!password) return res.status(400).json({ message: 'Password is required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user = new User({ name, email: email || undefined, phone: phone || undefined, password, isVerified: true });
    await user.save();
    const { accessToken, refreshTokenValue } = await generateTokens(user);
    setTokenCookies(res, accessToken, refreshTokenValue);
    res.status(201).json({ message: 'Registration successful', user: user.toJSON(), accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.password) return res.status(401).json({ message: 'Invalid credentials' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    const { accessToken, refreshTokenValue } = await generateTokens(user);
    setTokenCookies(res, accessToken, refreshTokenValue);
    res.json({ message: 'Login successful', user: user.toJSON(), accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/request-otp', authLimiter, async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000);
    let user = await User.findOne({ phone });
    if (!user) {
      user = new User({ name: 'User', phone, isVerified: false });
    }
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await twilio.messages.create({
          body: `Your Udupi Taxi OTP is: ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone
        });
      } catch (twilioErr) {
        console.error('Twilio error:', twilioErr.message);
      }
    } else {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
    }
    res.json({ message: 'OTP sent successfully', ...(process.env.NODE_ENV !== 'production' ? { otp } : {}) });
  } catch (err) {
    next(err);
  }
});

router.post('/verify-otp', authLimiter, async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ message: 'Phone and OTP are required' });
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.otp || user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (!user.otpExpiry || user.otpExpiry < new Date()) return res.status(400).json({ message: 'OTP has expired' });
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.isVerified = true;
    await user.save();
    const { accessToken, refreshTokenValue } = await generateTokens(user);
    setTokenCookies(res, accessToken, refreshTokenValue);
    res.json({ message: 'OTP verified successfully', user: user.toJSON(), accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: 'No refresh token' });
    const storedToken = await RefreshToken.findOne({ token, isRevoked: false });
    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
    storedToken.isRevoked = true;
    await storedToken.save();
    const user = await User.findById(storedToken.user);
    if (!user) return res.status(401).json({ message: 'User not found' });
    const { accessToken, refreshTokenValue } = await generateTokens(user);
    setTokenCookies(res, accessToken, refreshTokenValue);
    res.json({ message: 'Token refreshed', accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authLimiter, async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await RefreshToken.updateOne({ token }, { isRevoked: true });
    }
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authLimiter, protect, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
