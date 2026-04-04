const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Driver = require('../models/Driver');
const { protectDriver } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: 'Too many requests, please try again later' }
});

// Multer storage for driver photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, jpeg, png, webp) are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB per file
});

const generateDriverToken = (driver) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.sign(
    { id: driver._id, role: 'driver' },
    secret,
    { expiresIn: '7d' }
  );
};

const setDriverTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('driverAccessToken', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

const sendEmailOTP = async (email, otp) => {
  const smtpConfigured =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (smtpConfigured) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Udupi Taxi – Driver Login OTP',
      text: `Your driver login OTP is: ${otp}\nValid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.`,
      html: `<p>Your driver login OTP is: <strong>${otp}</strong></p><p>Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.</p>`
    });
  } else {
    console.log(`[DEV] Driver OTP for ${email}: ${otp}`);
  }
};

// POST /api/driver-auth/register
router.post(
  '/register',
  authLimiter,
  upload.fields([
    { name: 'driverPhoto', maxCount: 1 },
    { name: 'carPhoto', maxCount: 1 }
  ]),
  async (req, res, next) => {
    try {
      const { name, email, phone, address, carType, carNumber } = req.body;

      if (!name) return res.status(400).json({ message: 'Name is required' });
      if (!email) return res.status(400).json({ message: 'Email is required' });
      if (!phone) return res.status(400).json({ message: 'Phone number is required' });

      const existing = await Driver.findOne({ email: email.toLowerCase() });
      if (existing) return res.status(409).json({ message: 'Email already registered' });

      const driverPhoto = req.files?.driverPhoto?.[0]
        ? `/uploads/${req.files.driverPhoto[0].filename}`
        : undefined;
      const carPhoto = req.files?.carPhoto?.[0]
        ? `/uploads/${req.files.carPhoto[0].filename}`
        : undefined;

      const driver = new Driver({
        name,
        email: email.toLowerCase(),
        phone,
        address,
        carType,
        carNumber,
        driverPhoto,
        carPhoto,
        isVerified: false
      });
      await driver.save();

      res.status(201).json({
        message: 'Registration successful. Please verify your email with OTP to log in.',
        driverId: driver._id
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/driver-auth/request-otp
router.post('/request-otp', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const driver = await Driver.findOne({ email: email.toLowerCase() });
    if (!driver) return res.status(404).json({ message: 'No driver account found with this email' });

    const otp = require('crypto').randomInt(100000, 1000000).toString();
    const otpExpiry = new Date(
      Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000
    );
    driver.otp = otp;
    driver.otpExpiry = otpExpiry;
    await driver.save();

    await sendEmailOTP(driver.email, otp);

    res.json({
      message: 'OTP sent to your email',
      ...(process.env.NODE_ENV !== 'production' ? { otp } : {})
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/driver-auth/verify-otp
router.post('/verify-otp', authLimiter, async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const driver = await Driver.findOne({ email: email.toLowerCase() });
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    if (!driver.otp || driver.otp !== otp)
      return res.status(400).json({ message: 'Invalid OTP' });
    if (!driver.otpExpiry || driver.otpExpiry < new Date())
      return res.status(400).json({ message: 'OTP has expired' });

    driver.otp = undefined;
    driver.otpExpiry = undefined;
    driver.isVerified = true;
    await driver.save();

    const token = generateDriverToken(driver);
    setDriverTokenCookie(res, token);

    res.json({ message: 'Login successful', driver: driver.toJSON(), accessToken: token });
  } catch (err) {
    next(err);
  }
});

// POST /api/driver-auth/logout
router.post('/logout', authLimiter, (req, res) => {
  res.clearCookie('driverAccessToken');
  res.json({ message: 'Logged out successfully' });
});

// GET /api/driver-auth/me
router.get('/me', authLimiter, protectDriver, (req, res) => {
  res.json({ driver: req.driver });
});

module.exports = router;
