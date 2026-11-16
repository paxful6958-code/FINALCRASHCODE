const Datastore = require('nedb');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'database', 'users.db');

const db = new Datastore({ filename: dbPath, autoload: true });

// Ensure unique index on phone number
db.ensureIndex({ fieldName: 'phoneNumber', unique: true }, (err) => {
    if (err) console.error('Error setting unique phone index:', err);
});

module.exports = db;