#!/usr/bin/env node
/**
 * Secure admin provisioning (PHASE 35).
 *
 * The previous script hardcoded `admin@udupitaxi.com` / `admin123` and printed
 * the password to stdout. Any deployment that ran it shipped with a known
 * administrator credential.
 *
 * This version takes the email from an argument or ADMIN_EMAIL, generates a
 * strong random password, prints it exactly once, and refuses to run against a
 * database that already has an admin unless --force is given.
 *
 *   node scripts/create_admin.js admin@example.com
 */
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../models/User');

function generatePassword() {
  // 24 bytes of entropy, rendered in a set that satisfies the password policy.
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
  const bytes = crypto.randomBytes(24);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  // Guarantee the policy classes regardless of how the draw landed.
  return `Aa1${out}`;
}

async function main() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const force = process.argv.includes('--force');

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Usage: node scripts/create_admin.js <email>   (or set ADMIN_EMAIL)');
    process.exit(1);
  }

  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin && !force) {
    console.error(`An admin already exists (${existingAdmin.email}). Re-run with --force to add another.`);
    await mongoose.connection.close();
    process.exit(1);
  }

  const clash = await User.findOne({ email });
  if (clash) {
    console.error(`A user with ${email} already exists. Promote them manually if that is intended.`);
    await mongoose.connection.close();
    process.exit(1);
  }

  const password = generatePassword();
  const admin = new User({
    name: 'Administrator',
    email,
    password,
    role: 'admin',
    isVerified: true,
  });
  await admin.save();

  console.log('\n  Administrator created.\n');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}\n`);
  console.log('  This password is shown once and is not stored anywhere in plaintext.');
  console.log('  Save it to a password manager now, then sign in and change it.\n');

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Failed to create admin:', err.message);
  try { await mongoose.connection.close(); } catch { /* ignore */ }
  process.exit(1);
});
