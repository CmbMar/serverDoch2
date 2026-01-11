const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

/**
 * Jednoduchý Node.js server pro docházkový systém SmartAttendance Pro. https://ai.studio/apps/drive/15XMAyhiB4mhqN3LgbX1zqmNtXpn1N3yV
 * Implementuje API očekávané v cloudService.ts.
 */

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// API_KEY pro autentizaci (musí být shodný s tím v process.env.API_KEY na frontendu)
const SERVER_API_KEY = process.env.API_KEY; //"AIzaSyAJAjjOV2iZpMBAie0YS0cM-NO42tMFC0s"; erer

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Zvýšený limit pro přenos kompletní databáze

/**
 * Middleware pro kontrolu autentizačního tokenu v hlavičce Bearer.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `${SERVER_API_KEY}`) {
    console.warn(`[${new Date().toISOString()}] Auth: Neautorizovaný přístup odmítnut.`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * Načtení dat ze souboru data.json.
 * Pokud soubor neexistuje, vrací prázdnou strukturu.
 */
const readData = () => {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      users: [],
      attendance: [],
      leaveRequests: [],
      correctionRequests: [],
      workplace: { address: "Václavské náměstí 1, Praha", lat: 50.0817, lng: 14.4267, radius: 500 },
      overtimeRequests: []
    };
  }
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`[Error] Chyba při čtení datového souboru:`, e);
    return {};
  }
};

/**
 * Zápis dat do souboru data.json.
 */
const writeData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`[Error] Chyba při zápisu datového souboru:`, e);
    return false;
  }
};

// --- API ENDPOINTY ---

/**
 * Endpoint pro získání kompletního stavu databáze.
 * Volá se při startu aplikace pro inicializaci stavu.
 */
app.get('/getData', authenticate, (req, res) => {
  console.log(`[${new Date().toISOString()}] GET: Načítání dat ze souboru.`);
  const data = readData();
  res.json(data);
});

/**
 * Endpoint pro synchronizaci (uložení) kompletního stavu databáze.
 * Volá se automaticky při každé změně v aplikaci (debounce 2s).
 */
app.post('/sync', authenticate, (req, res) => {
  console.log(`[${new Date().toISOString()}] POST: Přijata synchronizace dat.`);
  const newData = req.body;
  
  if (writeData(newData)) {
    res.json({ success: true, timestamp: new Date().toISOString() });
  } else {
    res.status(500).json({ error: 'Nepodařilo se uložit data na disk.' });
  }
});

// Spuštění serveru
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`SmartAttendance Server běží na portu: ${PORT}`);
  console.log(`Data jsou ukládána do: ${DATA_FILE}`);
  console.log(`Status autentizace: ${SERVER_API_KEY ? 'AKTIVNÍ' : 'VAROVÁNÍ: API_KEY NENÍ NASTAVEN V PROSTŘEDÍ'}`);
  console.log(`=========================================`);
});
