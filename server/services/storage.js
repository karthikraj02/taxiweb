const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const env = require('../config/env');
const logger = require('../utils/logger');
const { badRequest } = require('../utils/errors');

/**
 * Upload handling (PHASE 26).
 *
 * Original problems: files were written to the server's local disk under a
 * name derived from `file.originalname`, and the only check was the file
 * extension. On a serverless host that disk is ephemeral, so uploaded driver
 * documents vanish between invocations; and an extension check accepts
 * `payload.php.jpg` or any renamed file.
 *
 * Now: content is validated by magic bytes, the stored key is random and
 * carries a server-chosen extension, and the driver is a pluggable interface
 * so S3/R2/Cloudinary can be dropped in without touching call sites.
 */

const LOCAL_DIR = path.join(__dirname, '..', 'uploads');

/** Magic-byte signatures for the formats we accept. */
const SIGNATURES = [
  { mime: 'image/jpeg', ext: '.jpg',  test: b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { mime: 'image/png',  ext: '.png',  test: b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
  { mime: 'image/webp', ext: '.webp', test: b => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' },
  { mime: 'application/pdf', ext: '.pdf', test: b => b.slice(0, 4).toString('ascii') === '%PDF' },
];

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Inspect the actual bytes. The client-declared mimetype and the original
 * filename are both ignored for this decision.
 */
function detectType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  return SIGNATURES.find(sig => sig.test(buffer)) || null;
}

function assertAcceptable(file) {
  if (!file?.buffer) throw badRequest('UPLOAD_EMPTY', 'No file was received.');
  if (file.buffer.length > MAX_BYTES) {
    throw badRequest('UPLOAD_TOO_LARGE', 'Files must be 5 MB or smaller.');
  }
  const detected = detectType(file.buffer);
  if (!detected) {
    throw badRequest(
      'UPLOAD_UNSUPPORTED_TYPE',
      'Only JPEG, PNG, WebP or PDF files are accepted.'
    );
  }
  return detected;
}

/** Opaque, unguessable storage key. Never derived from the uploaded filename. */
function makeKey(prefix, ext) {
  return `${prefix}/${Date.now()}-${crypto.randomBytes(16).toString('hex')}${ext}`;
}

async function putLocal(key, buffer) {
  const target = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer, { mode: 0o640 });
  return { key, url: `/uploads/${key}` };
}

/**
 * Store a validated upload.
 * @returns {{key:string, url:string, mimeType:string, sizeBytes:number}}
 */
async function store(file, prefix = 'documents') {
  const detected = assertAcceptable(file);
  const key = makeKey(prefix, detected.ext);

  // Only a local driver is implemented here. Cloud storage requires
  // credentials this project does not have; see docs/DEPLOYMENT.md.
  if (env.isProduction) {
    logger.warn(
      'Storing an upload on local disk in production. On an ephemeral filesystem ' +
      'this file will not survive a restart. Configure object storage.'
    );
  }
  const { url } = await putLocal(key, file.buffer);

  return {
    key,
    url,
    mimeType: detected.mime,
    sizeBytes: file.buffer.length,
  };
}

module.exports = { store, detectType, assertAcceptable, MAX_BYTES, LOCAL_DIR };
