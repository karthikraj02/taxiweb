const storage = require('../../services/storage');

/** Minimal valid file headers for magic-byte detection. */
const jpeg = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(20)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(20)]);
const pdf = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(20)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(20)]);

const asFile = (buffer, originalname = 'file', mimetype = 'image/jpeg') =>
  ({ buffer, originalname, mimetype });

describe('Upload validation (content, not extension)', () => {
  it.each([
    ['jpeg', jpeg, 'image/jpeg'],
    ['png', png, 'image/png'],
    ['pdf', pdf, 'application/pdf'],
    ['webp', webp, 'image/webp'],
  ])('accepts a real %s by its magic bytes', (_label, buf, mime) => {
    expect(storage.assertAcceptable(asFile(buf)).mime).toBe(mime);
  });

  /**
   * The original filter only checked `path.extname(file.originalname)`, so any
   * payload renamed to .jpg was accepted and written to disk.
   */
  it('rejects a script renamed with an image extension', () => {
    const shell = Buffer.from('<?php system($_GET["c"]); ?>'.padEnd(64, ' '));
    expect(() => storage.assertAcceptable(asFile(shell, 'avatar.jpg', 'image/jpeg')))
      .toThrow(expect.objectContaining({ code: 'UPLOAD_UNSUPPORTED_TYPE' }));
  });

  it('rejects an ELF binary claiming to be a PNG', () => {
    const elf = Buffer.concat([Buffer.from([0x7F, 0x45, 0x4C, 0x46]), Buffer.alloc(60)]);
    expect(() => storage.assertAcceptable(asFile(elf, 'photo.png', 'image/png')))
      .toThrow(expect.objectContaining({ code: 'UPLOAD_UNSUPPORTED_TYPE' }));
  });

  it('rejects an SVG, which can carry script', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(() => storage.assertAcceptable(asFile(svg, 'x.svg', 'image/svg+xml')))
      .toThrow(expect.objectContaining({ code: 'UPLOAD_UNSUPPORTED_TYPE' }));
  });

  it('ignores the client-declared mimetype entirely', () => {
    // Real PNG bytes, lying mimetype — accepted, and typed from the bytes.
    expect(storage.assertAcceptable(asFile(png, 'x.exe', 'application/x-msdownload')).mime)
      .toBe('image/png');
  });

  it('rejects an oversized file', () => {
    const big = Buffer.concat([jpeg, Buffer.alloc(storage.MAX_BYTES + 1)]);
    expect(() => storage.assertAcceptable(asFile(big)))
      .toThrow(expect.objectContaining({ code: 'UPLOAD_TOO_LARGE' }));
  });

  it('rejects an empty or truncated file', () => {
    expect(() => storage.assertAcceptable(asFile(Buffer.alloc(0))))
      .toThrow(expect.objectContaining({ code: 'UPLOAD_UNSUPPORTED_TYPE' }));
    expect(() => storage.assertAcceptable({ buffer: undefined }))
      .toThrow(expect.objectContaining({ code: 'UPLOAD_EMPTY' }));
  });

  it('detectType returns null for unrecognised content', () => {
    expect(storage.detectType(Buffer.from('just some plain text here at all'))).toBeNull();
  });
});

describe('Storage key generation', () => {
  const path = require('path');
  const fs = require('fs');

  it('never derives the stored path from the uploaded filename', async () => {
    const result = await storage.store(
      asFile(png, '../../../etc/passwd.png', 'image/png'),
      'drivers/test'
    );
    expect(result.key).not.toContain('passwd');
    expect(result.key).not.toContain('..');
    expect(result.key).toMatch(/^drivers\/test\/\d+-[0-9a-f]{32}\.png$/);

    // Cleanup
    try { fs.unlinkSync(path.join(storage.LOCAL_DIR, result.key)); } catch { /* ignore */ }
  });

  it('produces a unique key per upload', async () => {
    const fsp = require('fs/promises');
    const keys = new Set();
    for (let i = 0; i < 5; i++) {
      const r = await storage.store(asFile(png, 'same.png'), 'drivers/test');
      keys.add(r.key);
      await fsp.unlink(path.join(storage.LOCAL_DIR, r.key)).catch(() => {});
    }
    expect(keys.size).toBe(5);
  });

  it('assigns the extension from the detected type, not the upload', async () => {
    const fsp = require('fs/promises');
    const r = await storage.store(asFile(pdf, 'document.png', 'image/png'), 'drivers/test');
    expect(r.key.endsWith('.pdf')).toBe(true);
    expect(r.mimeType).toBe('application/pdf');
    await fsp.unlink(path.join(storage.LOCAL_DIR, r.key)).catch(() => {});
  });
});
