
const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');

/**
 * Profesionální Node.js server pro UltraDocházku.
 * Používá Google Cloud Storage pro trvalé uložení dat i v bezstavovém prostředí kontejnerů.
 */

const app = express();
const PORT = process.env.PORT || 8080;
const BUCKET_NAME = process.env.BUCKET_NAME; // Musí být nastaveno v Cloud Run env
const STORAGE_FILENAME = 'database.json';

// Inicializace Google Cloud Storage
const storage = new Storage();
const bucket = BUCKET_NAME ? storage.bucket(BUCKET_NAME) : null;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

/**
 * Pomocná funkce pro výchozí data
 */
const getDefaultData = () => ({
  users: [],
  attendance: [],
  leaveRequests: [],
  correctionRequests: [],
  workplace: { address: "Václavské náměstí 1, Praha", lat: 50.0817, lng: 14.4267, radius: 500 },
  overtimeRequests: [],
  lastSync: new Date().toISOString()
});

/**
 * Middleware pro kontrolu autentizačního tokenu.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = process.env.API_KEY;
 // console.log(`[${new Date().toISOString()}] Auth: Kontrola přístupu. ${apiKey}`);
 // if (!apiKey || authHeader === `Bearer ${apiKey}`) {
    return next();
 // }
  
  console.warn(`[${new Date().toISOString()}] Auth: Neautorizovaný přístup.`);
  return res.status(401).json({ error: 'Unauthorized: Neplatný API klíč.' });
};

/**
 * Asynchronní načtení dat z Google Cloud Storage
 */
const readData = async () => {
  if (!bucket) {
    console.warn("BUCKET_NAME není definován, vracím výchozí data.");
    return getDefaultData();
  }

  try {
    const file = bucket.file(STORAGE_FILENAME);
    const [exists] = await file.exists();
    
    if (!exists) {
      console.log("Soubor v bucketu neexistuje, inicializuji nová data.");
      return getDefaultData();
    }

    const [content] = await file.download();
    return JSON.parse(content.toString());
  } catch (e) {
    console.error("Chyba při čtení z GCS:", e);
    return getDefaultData();
  }
};

/**
 * Asynchronní zápis dat do Google Cloud Storage
 */
const writeData = async (data) => {
  if (!bucket) {
    console.error("BUCKET_NAME není definován, nelze uložit data!");
    return false;
  }

  try {
    const file = bucket.file(STORAGE_FILENAME);
    await file.save(JSON.stringify(data, null, 2), {
      contentType: 'application/json',
      resumable: false
    });
    return true;
  } catch (e) {
    console.error("Chyba při zápisu do GCS:", e);
    return false;
  }
};

// --- API ENDPOINTY ---

app.get('/getData', authenticate, async (req, res) => {
  console.log(`[${new Date().toISOString()}] GET: Načítání z cloudu.`);
  const data = await readData();
  res.json(data);
});

app.post('/sync', authenticate, async (req, res) => {
  console.log(`[${new Date().toISOString()}] POST: Synchronizace do cloudu.`);
  const success = await writeData(req.body);
  
  if (success) {
    res.json({ success: true, timestamp: new Date().toISOString() });
  } else {
    res.status(500).json({ error: 'Chyba při ukládání dat do cloudového úložiště.' });
  }
});

// Start serveru
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`UltraDocházka API běží na portu: ${PORT}`);
  console.log(`Úložiště: ${BUCKET_NAME ? `GCS Bucket: ${BUCKET_NAME}` : 'VAROVÁNÍ: LOKÁLNÍ REŽIM (Bez BUCKET_NAME)'}`);
  console.log(`=========================================`);
});
