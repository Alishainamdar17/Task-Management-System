// backend/utils/authMirror.js
const fs = require('fs').promises;
const path = require('path');
const AuthDoc = require('../models/AuthDoc');

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function restoreDirFromMongo(dir) {
  const docs = await AuthDoc.find({});
  await ensureDir(dir);
  for (const d of docs) {
    const full = path.join(dir, d.filename);
    await ensureDir(path.dirname(full));
    await fs.writeFile(full, d.data);
  }
}

async function snapshotDirToMongo(dir) {
  async function walk(folder) {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(folder, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else {
        const rel = path.relative(dir, full);
        const data = await fs.readFile(full);
        await AuthDoc.updateOne(
          { filename: rel },
          { $set: { data, updatedAt: new Date() } },
          { upsert: true }
        );
      }
    }
  }
  try {
    await walk(dir);
  } catch (e) {
    // first-time boot pe dir empty ho sakti hai
  }
}

module.exports = { restoreDirFromMongo, snapshotDirToMongo };
