const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Masquer le header d'empreinte Express
app.disable('x-powered-by');

// Activer CORS pour permettre au frontend d'accéder au proxy
app.use(cors());
app.use(express.json());

// ─── Middleware En-têtes de Sécurité HTTP (Helmet-style Security) ──
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ─── Limitation du Débit (Rate Limiting Anti-DDoS) ───────────
const ipRequestCounts = new Map();
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const record = ipRequestCounts.get(ip) || { count: 0, resetTime: now + 60000 };

  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + 60000;
  }

  record.count++;
  ipRequestCounts.set(ip, record);

  if (record.count > 150) {
    return res.status(429).json({ success: false, error: 'Trop de requêtes. Veuillez patienter 1 minute.' });
  }
  next();
});

// ─── Protection Anti-SSRF (URLs internes / privées interdites) ─
function isPrivateOrInternalUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return true;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('169.254.') ||
      (host.startsWith('172.') && parseInt(host.split('.')[1], 10) >= 16 && parseInt(host.split('.')[1], 10) <= 31)
    ) {
      return true;
    }
    return false;
  } catch (e) {
    return true;
  }
}

// Proxy de télémétrie pour éviter les erreurs CORS navigateur sur send-key-bug
app.post('/api/send-key-bug', async (req, res) => {
  try {
    await axios.post('https://deadcow-streaming.lol/api/v1/send-key-bug', req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    res.json({ success: true });
  } catch (e) {
    res.status(200).json({ success: false, error: e.message });
  }
});

let isMaintenanceMode = false;
let maintenanceMessage = "Le site DeadCow Streaming est actuellement en cours de maintenance pour mise à jour et optimisation des serveurs.";

// API Healthcheck (Surveillance de santé du serveur Node & mode maintenance)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', maintenance: isMaintenanceMode, maintenanceMessage, uptime: process.uptime(), timestamp: Date.now() });
});

const WEEKLY_SCHEDULE_DATA = {
  lundi: [
    { id: 'https://anime-sama.to/catalogue/vinland-saga/', title: 'Vinland Saga — S2 Ep. 24', type: 'anime', rating: 9.2, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/vinland-saga.jpg', genres: [{ name: '🕒 18:00 · Action' }] },
    { id: 'https://anime-sama.to/catalogue/tower-of-god/', title: 'Tower of God — S2 Ep. 14', type: 'anime', rating: 8.5, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/tower-of-god.jpg', genres: [{ name: '🕒 19:30 · Aventure' }] },
    { id: 'https://anime-sama.to/catalogue/bleach/', title: 'Bleach: TYBW — Ep. 26', type: 'anime', rating: 9.3, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/bleach.jpg', genres: [{ name: '🕒 21:00 · Action' }] }
  ],
  mardi: [
    { id: 'https://anime-sama.to/catalogue/overlord/', title: 'Overlord — S4 Ep. 13', type: 'anime', rating: 8.7, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/overlord.jpg', genres: [{ name: '🕒 18:30 · Isekai' }] },
    { id: 'https://anime-sama.to/catalogue/dandadan/', title: 'Dandadan — Épisode 12', type: 'anime', rating: 9.1, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/dandadan.jpg', genres: [{ name: '🕒 17:00 · Surnaturel' }] },
    { id: 'https://anime-sama.to/catalogue/black-clover/', title: 'Black Clover — Ep. 170', type: 'anime', rating: 8.9, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/black-clover.jpg', genres: [{ name: '🕒 19:00 · Shonen' }] }
  ],
  mercredi: [
    { id: 'https://anime-sama.to/catalogue/re-zero/', title: 'Re:Zero — S3 Ep. 8', type: 'anime', rating: 9.0, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/re-zero.jpg', genres: [{ name: '🕒 16:30 · Drame' }] },
    { id: 'https://anime-sama.to/catalogue/kaiju-no-8/', title: 'Kaiju N°8 — Ep. 12', type: 'anime', rating: 8.8, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/kaiju-no-8.jpg', genres: [{ name: '🕒 18:00 · Sci-Fi' }] },
    { id: 'https://anime-sama.to/catalogue/mob-psycho-100/', title: 'Mob Psycho 100 — S3 Ep. 12', type: 'anime', rating: 9.4, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/mob-psycho-100.jpg', genres: [{ name: '🕒 20:00 · Comédie' }] }
  ],
  jeudi: [
    { id: 'https://anime-sama.to/catalogue/dr-stone/', title: 'Dr. STONE — S4 Ep. 10', type: 'anime', rating: 8.9, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/dr-stone.jpg', genres: [{ name: '🕒 17:30 · Aventure' }] },
    { id: 'https://anime-sama.to/catalogue/wind-breaker/', title: 'Wind Breaker — Ep. 12', type: 'anime', rating: 8.7, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/wind-breaker.jpg', genres: [{ name: '🕒 19:00 · Baston' }] },
    { id: 'https://anime-sama.to/catalogue/mushoku-tensei/', title: 'Mushoku Tensei — S2 Ep. 24', type: 'anime', rating: 9.2, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/mushoku-tensei.jpg', genres: [{ name: '🕒 20:30 · Fantastique' }] }
  ],
  vendredi: [
    { id: 'https://anime-sama.to/catalogue/frieren/', title: 'Frieren — Ep. 28', type: 'anime', rating: 9.5, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/frieren.jpg', genres: [{ name: '🕒 17:00 · Aventure' }] },
    { id: 'https://anime-sama.to/catalogue/dragon-ball-daima/', title: 'Dragon Ball Daima — Ep. 10', type: 'anime', rating: 8.8, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/dragon-ball-daima.jpg', genres: [{ name: '🕒 18:30 · Combat' }] },
    { id: 'https://anime-sama.to/catalogue/fire-force/', title: 'Fire Force — S2 Ep. 24', type: 'anime', rating: 8.6, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/fire-force.jpg', genres: [{ name: '🕒 20:00 · Action' }] }
  ],
  samedi: [
    { id: 'https://anime-sama.to/catalogue/solo-leveling/', title: 'Solo Leveling — S2 Ep. 4', type: 'anime', rating: 9.3, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/solo-leveling0.jpg', genres: [{ name: '🕒 18:00 · Action' }] },
    { id: 'https://anime-sama.to/catalogue/blue-lock/', title: 'Blue Lock — S2 Ep. 10', type: 'anime', rating: 9.0, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/blue-lock.jpg', genres: [{ name: '🕒 19:30 · Sport' }] },
    { id: 'https://anime-sama.to/catalogue/my-hero-academia/', title: 'My Hero Academia — S7 Ep. 21', type: 'anime', rating: 8.9, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/my-hero-academia.jpg', genres: [{ name: '🕒 11:30 · Super-Héros' }] }
  ],
  dimanche: [
    { id: 'https://anime-sama.to/catalogue/one-piece/', title: 'One Piece — Ep. 1122', type: 'anime', rating: 9.6, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/one-piece.jpg', genres: [{ name: '🕒 09:30 · Aventure' }] },
    { id: 'https://anime-sama.to/catalogue/jujutsu-kaisen/', title: 'Jujutsu Kaisen — S2 Ep. 23', type: 'anime', rating: 9.4, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/jujutsu-kaisen.jpg', genres: [{ name: '🕒 19:00 · Fantastique' }] },
    { id: 'https://anime-sama.to/catalogue/demon-slayer/', title: 'Demon Slayer — S4 Ep. 8', type: 'anime', rating: 9.5, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/demon-slayer.jpg', genres: [{ name: '🕒 17:30 · Action' }] },
    { id: 'https://anime-sama.to/catalogue/chainsaw-man/', title: 'Chainsaw Man — Ep. 12', type: 'anime', rating: 8.8, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/chainsaw-man.jpg', genres: [{ name: '🕒 20:30 · Action' }] }
  ]
};

// Data : Programme des Prochaines Sorties Films 2026
const UPCOMING_MOVIES_DATA = [
  {
    id: "969681",
    title: "Spider-Man : Brand New Day",
    type: "movie",
    year: "2026",
    releaseDate: "24 Juillet 2026 (Cinéma)",
    rating: 9.2,
    poster: "https://image.tmdb.org/t/p/w500/yikio8CfJxIA7faZxgvB9FGXy6u.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/yikio8CfJxIA7faZxgvB9FGXy6u.jpg",
    overview: "Le quatrième volet des aventures de Peter Parker dans le Marvel Cinematic Universe. Peter entame un nouveau chapitre, solitaire mais déterminé à protéger New York."
  },
  {
    id: "1003596",
    title: "Avengers: Doomsday",
    type: "movie",
    year: "2026",
    releaseDate: "1er Mai 2026 (Cinéma)",
    rating: 9.5,
    poster: "https://image.tmdb.org/t/p/w500/z0ZqR7cQY4kL1fJd1o2W5G6h8Y.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/z0ZqR7cQY4kL1fJd1o2W5G6h8Y.jpg",
    overview: "Le rassemblement épique des super-héros Marvel face à la menace ultime du Docteur Fatalis (Doctor Doom)."
  },
  {
    id: "414906",
    title: "The Batman Part II",
    type: "movie",
    year: "2026",
    releaseDate: "2 Octobre 2026 (Cinéma)",
    rating: 9.1,
    poster: "https://image.tmdb.org/t/p/w500/7WsyChLLEzcqIFOH2wFv4kXpM8.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/7WsyChLLEzcqIFOH2wFv4kXpM8.jpg",
    overview: "Robert Pattinson reprend le rôle de Bruce Wayne dans la suite sombre du Chevalier Noir réalisée par Matt Reeves."
  },
  {
    id: "838209",
    title: "Avatar 3: Fire and Ash",
    type: "movie",
    year: "2025",
    releaseDate: "17 Décembre 2025 (Cinéma)",
    rating: 9.4,
    poster: "https://image.tmdb.org/t/p/w500/i8b4zXfQ5V9g2i6x7aP3mK8y.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/i8b4zXfQ5V9g2i6x7aP3mK8y.jpg",
    overview: "Le troisième chapitre de la saga Pandora par James Cameron explorant le Peuple des Cendres, une tribu Na'vi volcanique et agressive."
  },
  {
    id: "870355",
    title: "Toy Story 5",
    type: "movie",
    year: "2026",
    releaseDate: "19 Juin 2026 (Cinéma)",
    rating: 8.8,
    poster: "https://image.tmdb.org/t/p/w500/o7gYy7h8L2x8gK4h3J5k7aP9.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/o7gYy7h8L2x8gK4h3J5k7aP9.jpg",
    overview: "Woody, Buzz l'Éclair et toute la bande de jouets reviennent pour affronter la nouvelle menace des écrans et de la technologie."
  },
  {
    id: "1019280",
    title: "Super Mario Bros 2",
    type: "movie",
    year: "2026",
    releaseDate: "3 Avril 2026 (Cinéma)",
    rating: 9.0,
    poster: "https://image.tmdb.org/t/p/w500/u6W1Z9xK6aH7mJ4k8yP2x9q.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/u6W1Z9xK6aH7mJ4k8yP2x9q.jpg",
    overview: "La suite très attendue de l'adaptation du jeu culte par Nintendo et Illumination Entertainment dans le Royaume Champignon."
  },
  {
    id: "1056360",
    title: "Spider-Man: Beyond the Spider-Verse",
    type: "movie",
    year: "2026",
    releaseDate: "Fin 2026 (Cinéma)",
    rating: 9.6,
    poster: "https://image.tmdb.org/t/p/w500/8b8R8Wg2N75kX6L3P9mK5y.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/8b8R8Wg2N75kX6L3P9mK5y.jpg",
    overview: "Le grand final de la trilogie animée culte de Miles Morales luttant pour sauver tous les univers du Multivers."
  },
  {
    id: "1022789",
    title: "Star Wars: The Mandalorian & Grogu",
    type: "movie",
    year: "2026",
    releaseDate: "22 Mai 2026 (Cinéma)",
    rating: 9.1,
    poster: "https://image.tmdb.org/t/p/w500/3oL9K8qH7mJ4x9yK2b8a7P.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/3oL9K8qH7mJ4x9yK2b8a7P.jpg",
    overview: "Din Djarin et Grogu font le grand saut sur grand écran dans le nouveau film Star Wars réalisé par Jon Favreau."
  }
];

// API : Planning des Sorties Hebdomadaires Anime
app.get('/api/schedule', (req, res) => {
  const day = req.query.day ? req.query.day.toLowerCase() : null;
  if (day && WEEKLY_SCHEDULE_DATA[day]) {
    return res.json({ success: true, day, releases: WEEKLY_SCHEDULE_DATA[day] });
  }
  res.json({ success: true, schedule: WEEKLY_SCHEDULE_DATA });
});

// API : Programme des Prochaines Sorties Films 2026
app.get('/api/upcoming-movies', (req, res) => {
  res.json({ success: true, count: UPCOMING_MOVIES_DATA.length, movies: UPCOMING_MOVIES_DATA });
});

// API : Statut du mode maintenance
app.get('/api/maintenance/status', (req, res) => {
  res.json({ maintenance: isMaintenanceMode, message: maintenanceMessage });
});

// ─── Watch Party Real-Time Backend ───────────────────────────
const watchPartyRooms = new Map();

function generateRoomCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `WP-${num}`;
}

function broadcastToRoom(roomCode, eventType, data) {
  const room = watchPartyRooms.get(roomCode);
  if (!room || !room.listeners) return;
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  room.listeners.forEach(res => {
    try { res.write(payload); } catch(e) {}
  });
}

function getSanitizedRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    hostName: room.hostName,
    media: room.media,
    currentTime: room.currentTime,
    isPlaying: room.isPlaying,
    members: room.members,
    messages: room.messages
  };
}

// 1. Créer une Watch Party
app.post('/api/watchparty/create', (req, res) => {
  const { username, media } = req.body || {};
  const code = generateRoomCode();
  const userId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const room = {
    code,
    hostId: userId,
    hostName: username || 'Hôte',
    media: media || null,
    currentTime: 0,
    isPlaying: false,
    members: [{ id: userId, username: username || 'Hôte', isHost: true, joinedAt: new Date().toISOString() }],
    messages: [{ id: `msg_${Date.now()}`, username: 'Système', text: `La Watch Party ${code} a été créée par ${username || 'Hôte'}.`, timestamp: Date.now(), isSystem: true }],
    listeners: new Set(),
    createdAt: Date.now(),
    lastActivity: Date.now()
  };

  watchPartyRooms.set(code, room);
  console.log(`[WatchParty] Salle créée : ${code} par ${username || 'Hôte'}`);
  res.json({ success: true, roomCode: code, userId, isHost: true, room: getSanitizedRoom(room) });
});

// 2. Rejoindre une Watch Party
app.post('/api/watchparty/join', (req, res) => {
  const { code, username } = req.body || {};
  const cleanCode = (code || '').trim().toUpperCase();
  const room = watchPartyRooms.get(cleanCode);

  if (!room) {
    return res.status(404).json({ success: false, error: 'Watch Party introuvable. Vérifiez le code de la salle.' });
  }

  const userId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const memberName = username || `Spectateur #${room.members.length + 1}`;
  const member = { id: userId, username: memberName, isHost: false, joinedAt: new Date().toISOString() };
  room.members.push(member);
  room.lastActivity = Date.now();

  const sysMsg = { id: `msg_${Date.now()}`, username: 'Système', text: `🍿 ${memberName} a rejoint la Watch Party !`, timestamp: Date.now(), isSystem: true };
  room.messages.push(sysMsg);

  broadcastToRoom(cleanCode, 'ROOM_UPDATE', { room: getSanitizedRoom(room), newMember: member, sysMsg });

  res.json({ success: true, roomCode: cleanCode, userId, isHost: false, room: getSanitizedRoom(room) });
});

// 3. Stream SSE Temps-Réel (<30ms) pour les événements de salle
app.get('/api/watchparty/events/:code', (req, res) => {
  const roomCode = req.params.code.trim().toUpperCase();
  const room = watchPartyRooms.get(roomCode);

  if (!room) {
    return res.status(404).send('Salle introuvable.');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  room.listeners.add(res);

  res.write(`event: INIT\ndata: ${JSON.stringify({ room: getSanitizedRoom(room) })}\n\n`);

  req.on('close', () => {
    room.listeners.delete(res);
  });
});

// 4. Synchroniser la lecture (Play / Pause / Seek / Media)
app.post('/api/watchparty/sync', (req, res) => {
  const { code, userId, action, currentTime, isPlaying, media } = req.body || {};
  const room = watchPartyRooms.get((code || '').trim().toUpperCase());

  if (!room) return res.status(404).json({ success: false, error: 'Salle introuvable.' });

  if (typeof currentTime === 'number') room.currentTime = currentTime;
  if (typeof isPlaying === 'boolean') room.isPlaying = isPlaying;
  if (media) room.media = media;
  room.lastActivity = Date.now();

  broadcastToRoom(room.code, 'PLAYBACK_SYNC', {
    action,
    currentTime: room.currentTime,
    isPlaying: room.isPlaying,
    media: room.media,
    senderId: userId
  });

  res.json({ success: true });
});

// 5. Envoyer un message de Tchat ou Réaction Emoji
app.post('/api/watchparty/chat', (req, res) => {
  const { code, userId, username, text, emoji } = req.body || {};
  const room = watchPartyRooms.get((code || '').trim().toUpperCase());

  if (!room) return res.status(404).json({ success: false, error: 'Salle introuvable.' });

  const msg = {
    id: `msg_${Date.now()}`,
    userId,
    username: username || 'Anonyme',
    text: text || '',
    emoji: emoji || null,
    timestamp: Date.now()
  };

  room.messages.push(msg);
  if (room.messages.length > 100) room.messages.shift();
  room.lastActivity = Date.now();

  broadcastToRoom(room.code, 'CHAT_MESSAGE', { message: msg });

  res.json({ success: true, message: msg });
});

// 6. Récupérer l'état actuel d'une salle Watch Party (REST)
app.get('/api/watchparty/room/:code', (req, res) => {
  const roomCode = (req.params.code || '').trim().toUpperCase();
  const room = watchPartyRooms.get(roomCode);
  if (!room) return res.status(404).json({ success: false, error: 'Salle introuvable.' });
  res.json({ success: true, room: getSanitizedRoom(room) });
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'astream2026';

// ─── Base de Données des Comptes Utilisateurs (Authentification & Rôles) ───
const USERS_FILE = path.join(__dirname, 'users.json');
let usersStore = [];

function loadUsers() {
  if (fs.existsSync(USERS_FILE)) {
    try {
      usersStore = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
      usersStore = [];
    }
  }
  // Créer le compte Administrateur Propriétaire par défaut s'il n'existe pas
  if (!usersStore.some(u => u.role === 'admin')) {
    usersStore.push({
      id: 'admin_owner',
      username: 'admin',
      email: 'admin@japoplay.app',
      password: ADMIN_PASSWORD,
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    saveUsers();
  }
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersStore, null, 2));
  } catch (e) {}
}

loadUsers();

// API : Connexion Compte (Login)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Identifiant et mot de passe requis.' });
  }

  const user = usersStore.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, error: 'Identifiant ou mot de passe incorrect.' });
  }

  const token = `astream_token_${user.id}_${Date.now()}`;
  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role }
  });
});

// API : Inscription Compte (Register - Rôle Membre Utilisateur Standard)
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !password || !email) {
    return res.status(400).json({ success: false, error: 'Tous les champs sont requis.' });
  }

  if (usersStore.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ success: false, error: 'Ce nom d\'utilisateur est déjà utilisé.' });
  }

  const newUser = {
    id: `user_${Date.now()}`,
    username: username.trim(),
    email: email.trim(),
    password,
    role: 'user', // Les nouveaux membres ont le rôle Utilisateur Standard (Pas d'accès Admin!)
    createdAt: new Date().toISOString()
  };

  usersStore.push(newUser);
  saveUsers();

  const token = `astream_token_${newUser.id}_${Date.now()}`;
  res.json({
    success: true,
    token,
    user: { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role }
  });
});

// API : Basculement du mode maintenance (Protégé par Mot de Passe ou Compte Admin)
app.post('/api/maintenance/toggle', (req, res) => {
  const { password, enabled, message } = req.body || {};

  if (password !== ADMIN_PASSWORD && !usersStore.some(u => u.role === 'admin' && u.password === password)) {
    return res.status(401).json({ success: false, error: 'Accès refusé. Seul l\'Administrateur peut modifier la maintenance.' });
  }

  if (typeof enabled === 'boolean') {
    isMaintenanceMode = enabled;
  } else {
    isMaintenanceMode = !isMaintenanceMode;
  }

  if (message) {
    maintenanceMessage = message;
  }

  console.log(`[Maintenance] Basculement Admin : ${isMaintenanceMode ? 'ACTIVÉ 🟡' : 'DÉSACTIVÉ 🟢'}`);
  res.json({ success: true, maintenance: isMaintenanceMode, message: maintenanceMessage });
});

// ─── Proxy Serveur Automatique vers l'API Officielle DeadCow ──
const DEADCOW_KEY = process.env.DEADCOW_API_KEY || 'dc_live_6bdf03d1a5c0f4f9b9ff1e30';

app.use('/api/dc-proxy', async (req, res) => {
  try {
    const targetEndpoint = req.path;
    const queryParams = new URLSearchParams(req.query);
    if (!queryParams.has('key') && !queryParams.has('api_key')) {
      queryParams.set('key', DEADCOW_KEY);
    }

    let targetUrl;
    if (targetEndpoint.startsWith('/catalog') || targetEndpoint.startsWith('/search') || targetEndpoint.startsWith('/details') || targetEndpoint.startsWith('/resolve') || targetEndpoint.startsWith('/manga') || targetEndpoint.startsWith('/movie') || targetEndpoint.startsWith('/serie') || targetEndpoint.startsWith('/iptv') || targetEndpoint.startsWith('/profiles')) {
      targetUrl = `https://deadcow-streaming.lol/api/v1${targetEndpoint}?${queryParams.toString()}`;
    } else {
      targetUrl = `https://deadcow-streaming.lol/api${targetEndpoint}?${queryParams.toString()}`;
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });

    res.status(response.status).json(response.data);
  } catch (err) {
    console.warn(`[DeadCow Proxy Fallback] ${req.path}: ${err.message}`);
    res.status(200).json({
      success: false,
      fallback: true,
      results: [],
      movies: [],
      series: [],
      error: err.message || 'Serveur distant indisponible'
    });
  }
});

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// API : Récupérer la liste des animes (scrapes ou mock)
app.get('/api/animes', (req, res) => {
  const scrapedPath = path.join(__dirname, 'scraper', 'scraped_anime.json');
  const mockPath = path.join(__dirname, 'frontend', 'mockData.json');

  if (fs.existsSync(scrapedPath)) {
    fs.readFile(scrapedPath, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ error: "Erreur de lecture des données scrapées." });
      res.json(JSON.parse(data));
    });
  } else if (fs.existsSync(mockPath)) {
    fs.readFile(mockPath, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ error: "Erreur de lecture des données de démo." });
      res.json(JSON.parse(data));
    });
  } else {
    res.status(404).json({ error: "Aucune donnée disponible." });
  }
});

// Proxy Vidéo Premium avec support complet des requêtes partielles (HTTP Range 206) pour PC & iOS (iPhone)
app.get('/api/proxy', async (req, res) => {
  let videoUrl = req.query.url;
  const referer = req.query.referer || '';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (videoUrl && videoUrl.startsWith('http://')) {
    videoUrl = videoUrl.replace('http://', 'https://');
  }

  if (!videoUrl || isPrivateOrInternalUrl(videoUrl)) {
    console.log(`[Proxy Security] Accès refusé : URL invalide ou interne (${videoUrl}).`);
    return res.status(403).send('Accès refusé : URL privée ou invalide (Protection Anti-SSRF).');
  }

  console.log(`[Proxy] Requête reçue pour : ${videoUrl} (Referer: ${referer}) (Range: ${req.headers.range || 'Aucun'})`);

  // Préparation des headers pour l'hébergeur distant (avec ajustement automatique du Referer pour contourner les 403)
  const headers = {
    'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  try {
    const targetObj = new URL(videoUrl);
    if (targetObj.host.includes('deadcow-streaming.lol') || videoUrl.includes('media-proxy') || videoUrl.includes('hls-proxy')) {
      headers['Referer'] = 'https://deadcow-streaming.lol/';
      headers['Origin']  = 'https://deadcow-streaming.lol';
      headers['X-API-Key'] = DEADCOW_KEY;
    } else if (referer) {
      headers['Referer'] = referer;
    } else {
      headers['Referer'] = `https://${targetObj.host}/`;
    }
  } catch (e) {
    if (referer) headers['Referer'] = referer;
  }

  // Si le client (ex: Safari sur iPhone) demande une partie de la vidéo
  if (req.headers.range) {
    headers['Range'] = req.headers.range;
  }

  try {
    // Effectuer la requête vers la vidéo brute
    const response = await axios({
      method: 'get',
      url: videoUrl,
      headers: headers,
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 10,
      validateStatus: (status) => status >= 200 && status < 300 || status === 206
    });

    // Copier les headers importants de la réponse de l'hébergeur vers le client
    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control'
    ];

    headersToForward.forEach(header => {
      if (response.headers[header]) {
        res.setHeader(header, response.headers[header]);
      }
    });

    // Forcer Content-Type approprie (m3u8 vs mp4)
    const ct = (response.headers['content-type'] || '').toLowerCase();
    if (videoUrl.includes('.m3u8') || ct.includes('mpegurl') || ct.includes('m3u8')) {
      res.setHeader('content-type', 'application/vnd.apple.mpegurl');
    } else if (!ct.includes('video/') && !ct.includes('application/') && !ct.includes('audio/') && !ct.includes('image/') && !ct.includes('json')) {
      res.setHeader('content-type', 'video/mp4');
    }

    // Renvoyer le statut approprié (206 pour le Range/iOS, ou 200 standard)
    res.status(response.status);

    // Streamer la vidéo au client
    response.data.pipe(res);

    // Gérer les fermetures de connexion prématurées
    req.on('close', () => {
      response.data.destroy();
    });

  } catch (error) {
    console.error('Erreur Proxy Vidéo:', error.message);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (error.response) {
      res.status(error.response.status).send(error.response.statusText);
    } else {
      res.status(500).send('Erreur lors de la récupération de la vidéo.');
    }
  }
});

// Proxy Embed HTML pour débloquer les X-Frame-Options & Content-Security-Policy (CSP)
app.get('/api/embed-proxy', async (req, res) => {
  let embedUrl = req.query.url;
  const referer = req.query.referer || embedUrl;

  if (embedUrl && embedUrl.startsWith('http://')) {
    embedUrl = embedUrl.replace('http://', 'https://');
  }

  if (!embedUrl || isPrivateOrInternalUrl(embedUrl)) {
    return res.status(403).send('Accès refusé : URL iframe privée ou invalide (Protection Anti-SSRF).');
  }

  console.log(`[Embed Proxy] Déblocage de l'iframe pour : ${embedUrl}`);

  try {
    const response = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000,
      maxRedirects: 10,
      validateStatus: s => s < 500
    });

    if (response.status >= 400) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`<div style="color:#ef4444;font-family:sans-serif;padding:30px;text-align:center;background:#06070a;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <h3 style="font-size:1.2rem;margin-bottom:10px;">⚠ Ce lecteur vidéo est indisponible (Erreur ${response.status})</h3>
        <p style="color:#9ca3af;margin-top:5px;">Basculement automatique vers une autre source disponible...</p>
        <script>
          try {
            window.parent.postMessage({ type: 'EMBED_404', status: ${response.status} }, '*');
          } catch(e) {}
        </script>
      </div>`);
    }

    let html = response.data;
    if (typeof html === 'string') {
      // Conversion automatique de TOUS les liens insecure HTTP (y compris les URLs échappées http:\/\/) vers HTTPS pour éviter les erreurs Mixed Content sur Render
      html = html.replace(/http:\\\/\\\//gi, 'https:\\/\\/').replace(/http:\/\//gi, 'https://');

      // Détecter si la vidéo a été supprimée chez l'hébergeur (détection structurelle fiable pour Sibnet & hébergeurs génériques)
      const isDeadSibnet = embedUrl.includes('sibnet.ru') && !html.includes('.mp4') && !html.includes('player.src');
      const isDeadGeneric = html.includes('File was deleted') || html.includes('Video not found') || html.includes('404 Not Found');

      if (isDeadSibnet || isDeadGeneric) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(`<div style="color:#ef4444;font-family:sans-serif;padding:30px;text-align:center;background:#06070a;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <h3 style="font-size:1.3rem;margin-bottom:10px;">⚠ Fichier vidéo supprimé par l'hébergeur</h3>
          <p style="color:#9ca3af;max-width:480px;line-height:1.5;">Ce fichier n'est plus disponible sur ce serveur. Veuillez choisir un autre lecteur dans le menu déroulant en haut du lecteur.</p>
        </div>`);
      }

      // Injecter la balise <base>, la balise CSP et le script de contournement CORS pour XHR/fetch
      try {
        const urlObj = new URL(embedUrl);
        const originUrl = `${urlObj.protocol}//${urlObj.host}/`;
        const cspMeta = `<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">`;
        const corsScript = `
        <script>
          (function() {
            var origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              if (url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('//')) && !url.startsWith('/api/proxy') && !url.startsWith(window.location.origin + '/api/proxy')) {
                var fullUrl = url.startsWith('//') ? 'https:' + url : url;
                url = '/api/proxy?url=' + encodeURIComponent(fullUrl);
              }
              return origOpen.apply(this, arguments);
            };
            var origFetch = window.fetch;
            if (origFetch) {
              window.fetch = function(input, init) {
                var url = (typeof input === 'string') ? input : (input && input.url ? input.url : input);
                if (url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('//')) && !url.startsWith('/api/proxy') && !url.startsWith(window.location.origin + '/api/proxy')) {
                  var fullUrl = url.startsWith('//') ? 'https:' + url : url;
                  var proxyUrl = '/api/proxy?url=' + encodeURIComponent(fullUrl);
                  if (typeof input === 'string') input = proxyUrl;
                  else if (input && input.url) input = new Request(proxyUrl, input);
                }
                return origFetch.call(this, input, init);
              };
            }
          })();
        </script>
        `;
        if (html.toLowerCase().includes('<head>')) {
          html = html.replace(/<head>/i, `<head>${cspMeta}${corsScript}<base href="${originUrl}">`);
        } else {
          html = `<head>${cspMeta}${corsScript}<base href="${originUrl}"></head>${html}`;
        }
      } catch (e) {}

      // Filtrer les scripts publicitaires et trackers connus (SANS bloquer les scripts indispensables du player Yandex/Sibnet)
      const AD_PATTERNS = [
        /betweendigital/gi,
        /adfox\/header-bidding/gi,
        /cvt1\.sibnet\.ru\/sbcount/gi,
        /googlesyndication/gi,
        /doubleclick/gi,
        /yandex\.ru\/ads/gi,
        /mc\.yandex/gi,
        /vignette/gi,
        /tag\.min\.js/gi,
        /disable-devtool/gi,
        /theajack/gi,
        /cordClip/gi,
        /cloudnestra/gi
      ];

      // Supprimer les balises <script src="..."> contenant des domaines pub
      html = html.replace(/<script[^>]+src=["'][^"']*["'][^>]*><\/script>/gi, (match) => {
        const isAd = AD_PATTERNS.some(p => p.test(match));
        return isAd ? '<!-- [ad script removed] -->' : match;
      });

      // Supprimer les balises <script> inline contenant des appels pub ou anti-devtools
      html = html.replace(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi, (match, content) => {
        const isAd = /betweendigital|adfox\/header|header.?bidding|disable-devtool|theajack|cordClip|vignette|cloudnestra/gi.test(content);
        return isAd ? '<!-- [ad inline removed] -->' : match;
      });

      // Injection d'un bloqueur pub runtime (silencieux, anti-warning capteurs & bloqueur XHR/fetch/beacon pub)
      const adBlockerScript = `
<script>
(function() {
  var AD_RE = new RegExp("betweendigital|adfox|header-bidding|googlesyndication|doubleclick|adjson|sbcount|cvt1|vignette|tag\\\\.min|disable-devtool|theajack|cordClip|cloudnestra", "i");
  
  // Neutraliser disable-devtool (évite le 404 cordClip, ReferenceError et le blocage F12)
  var dummyFn = function() {};
  dummyFn.isSupported = true;
  dummyFn.md5 = function() { return ''; };

  window.disableDevtool = dummyFn;
  window.DisableDevtool = dummyFn;
  window.DisableDevTool = dummyFn;
  window.disableDevTool = dummyFn;

  ['disableDevtool', 'DisableDevtool', 'DisableDevTool', 'disableDevTool'].forEach(function(prop) {
    try {
      Object.defineProperty(window, prop, {
        get: function() { return dummyFn; },
        set: function() {}
      });
    } catch(e) {}
  });

  // Débloquer systématiquement la touche F12 et les raccourcis devtools
  window.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) || (e.ctrlKey && (e.key === 'u' || e.key === 'U'))) {
      e.stopImmediatePropagation();
      return true;
    }
  }, true);

  // Neutraliser les boucles debugger; abusives des scripts tiers
  var _Function = window.Function;
  window.Function = function() {
    var args = Array.prototype.slice.call(arguments);
    if (args.length > 0 && typeof args[args.length - 1] === 'string' && args[args.length - 1].indexOf('debugger') !== -1) {
      return function() {};
    }
    return _Function.apply(this, args);
  };

  // Neutraliser les tentatives de détection Bluetooth
  if (navigator.bluetooth) {
    try {
      Object.defineProperty(navigator, 'bluetooth', {
        get: function() {
          return {
            getAvailability: function() { return Promise.resolve(false); },
            requestDevice: function() { return Promise.reject(new DOMException("Bluetooth non disponible", "NotAllowedError")); }
          };
        }
      });
    } catch(e) {}
  }

  // Intercepter et neutraliser XHR publicitaires & rerouter les requêtes cross-origin via /api/proxy
  var EMBED_ORIGIN = ${JSON.stringify(embedUrl)};
  function getProxiedUrl(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string') return targetUrl;
    if (AD_RE.test(targetUrl)) return targetUrl;
    if (targetUrl.startsWith('/api/') || targetUrl.includes('/api/proxy') || targetUrl.includes('cdn-cgi/rum')) return targetUrl;
    if (targetUrl.startsWith('data:') || targetUrl.startsWith('blob:')) return targetUrl;
    try {
      var resolved = new URL(targetUrl, document.baseURI || window.location.href).href;
      if (resolved.startsWith('http://')) {
        resolved = resolved.replace('http://', 'https://');
      }
      var parsed = new URL(resolved);
      if (parsed.origin !== window.location.origin && !parsed.hostname.includes('vidsrc')) {
        return '/api/proxy?url=' + encodeURIComponent(resolved) + '&referer=' + encodeURIComponent(EMBED_ORIGIN);
      }
    } catch(e) {}
    return targetUrl;
  }

  var _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async, user, pass) {
    if (AD_RE.test(url || '')) {
      this.send = function() {
        Object.defineProperty(this, 'status', { value: 200 });
        Object.defineProperty(this, 'responseText', { value: '{}' });
        if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
        if (typeof this.onload === 'function') this.onload();
      };
      return;
    }
    var proxiedUrl = getProxiedUrl(url);
    return _xhrOpen.call(this, method, proxiedUrl, async !== false, user, pass);
  };
  // Intercepter et neutraliser fetch publicitaires
  var _fetch = window.fetch;
  if (_fetch) {
    window.fetch = function(url, opts) {
      var u = (typeof url === 'string') ? url : (url && url.url);
      if (AD_RE.test(u || '')) {
        return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      var proxiedUrl = getProxiedUrl(u);
      if (typeof url === 'object' && url !== null && url.url) {
        url = new Request(proxiedUrl, opts || url);
        return _fetch.call(this, url);
      }
      return _fetch.call(this, proxiedUrl, opts);
    };
  }
  // Intercepter sendBeacon publicitaires
  if (navigator.sendBeacon) {
    navigator.sendBeacon = function(url, data) {
      if (AD_RE.test(url || '')) return true;
      return true;
    };
  }
  // Intercepter et ignorer silencieusement les écouteurs de capteurs (devicemotion/accelerometer)
  var _addEventListener = window.addEventListener.bind(window);
  window.addEventListener = function(type, listener, options) {
    if (type === 'devicemotion' || type === 'deviceorientation') return;
    return _addEventListener(type, listener, options);
  };
  // Bloquer window.open (popups pub)
  var _open = window.open;
  window.open = function(url) {
    if (AD_RE.test(url || '')) return null;
    return _open.apply(this, arguments);
  };
  // Bloquer l'injection dynamique de scripts pub
  var _createElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    var el = _createElement(tag);
    if (tag && tag.toLowerCase() === 'script') {
      var origSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      Object.defineProperty(el, 'src', {
        set: function(v) { if (!AD_RE.test(v || '')) origSrc.set.call(this, v); },
        get: function() { return origSrc.get.call(this); }
      });
    }
    return el;
  };
})();
</script>`;
      html = html.replace('<head>', `<head>${adBlockerScript}`);
    }

    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Type', response.headers['content-type'] || 'text/html');

    res.send(html);
  } catch (error) {
    console.error('Erreur Embed Proxy:', error.message);
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`<div style="color:#ef4444;font-family:sans-serif;padding:30px;text-align:center;background:#000;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <h3>⚠ Hébergeur indisponible (${error.message})</h3>
      <p style="color:#9ca3af;margin-top:10px;">Veuillez changer de lecteur/source en haut à droite.</p>
    </div>`);
  }
});

// Résolution directe d'URL depuis les embeds Sibnet / Vidmoly (sans iframe)
app.get('/api/resolve-embed', async (req, res) => {
  const embedUrl = req.query.url;
  if (!embedUrl) return res.status(400).json({ error: 'URL requise.' });

  console.log(`[Embed Resolver] Extraction URL directe depuis : ${embedUrl}`);

  try {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // ── Sibnet ─────────────────────────────────────────────────
    if (embedUrl.includes('sibnet.ru')) {
      const videoIdMatch = embedUrl.match(/videoid=(\d+)/);
      if (!videoIdMatch) return res.status(400).json({ error: 'ID vidéo Sibnet introuvable.' });

      const videoId = videoIdMatch[1];

      // Étape 1 : Charger shell.php pour obtenir les cookies de session Sibnet
      const shellResp = await axios.get(`https://video.sibnet.ru/shell.php?videoid=${videoId}`, {
        headers: { 'User-Agent': ua, 'Referer': 'https://video.sibnet.ru/' },
        timeout: 10000
      });

      // Extraire les cookies de la réponse shell.php
      const rawCookies = shellResp.headers['set-cookie'] || [];
      const cookieStr = rawCookies.map(c => c.split(';')[0]).join('; ');

      // Étape 2 : Appeler /video.php avec les cookies — Sibnet renvoie 302 vers le MP4
      const videoResp = await axios.get(`https://video.sibnet.ru/video.php?videoid=${videoId}`, {
        maxRedirects: 0,
        validateStatus: s => s < 500,
        headers: {
          'User-Agent': ua,
          'Referer': `https://video.sibnet.ru/shell.php?videoid=${videoId}`,
          'Cookie': cookieStr || 'video_adult_confirmed=1'
        }
      });

      // La redirection 302 contient l'URL du MP4
      const location = videoResp.headers['location'];
      if (location) {
        const fullMp4 = location.startsWith('http') ? location : `https://video.sibnet.ru${location}`;
        console.log(`[Sibnet] MP4 extrait : ${fullMp4}`);
        return res.json({
          success: true,
          videoUrl: `/api/proxy?url=${encodeURIComponent(fullMp4)}&referer=${encodeURIComponent('https://video.sibnet.ru/')}`,
          type: 'mp4'
        });
      }

      // Fallback : chercher src: "..." dans le HTML de shell.php
      const shellHtml = shellResp.data || '';
      const srcMatch = shellHtml.match(/src\s*:\s*["']([^"']+\.mp4[^"']*)/);
      if (srcMatch) {
        const mp4Url = srcMatch[1].startsWith('http') ? srcMatch[1] : `https://video.sibnet.ru${srcMatch[1]}`;
        return res.json({
          success: true,
          videoUrl: `/api/proxy?url=${encodeURIComponent(mp4Url)}&referer=${encodeURIComponent('https://video.sibnet.ru/')}`,
          type: 'mp4'
        });
      }

      console.warn(`[Sibnet] Aucune URL MP4 trouvée pour videoid=${videoId}, basculement iframe.`);
      return res.json({ success: false, error: 'URL MP4 Sibnet introuvable.' });
    }

    // ── Vidmoly ────────────────────────────────────────────────
    if (embedUrl.includes('vidmoly')) {
      const vidResp = await axios.get(embedUrl, {
        headers: { 'User-Agent': ua, 'Referer': embedUrl },
        timeout: 10000
      });
      const html = vidResp.data || '';

      // Chercher le fichier source M3U8 ou MP4 dans les scripts du player
      const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)/);
      const mp4Match  = html.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)/);

      if (m3u8Match) {
        return res.json({ success: true, videoUrl: `/api/proxy?url=${encodeURIComponent(m3u8Match[1])}&referer=${encodeURIComponent(embedUrl)}`, type: 'hls' });
      }
      if (mp4Match) {
        return res.json({ success: true, videoUrl: `/api/proxy?url=${encodeURIComponent(mp4Match[1])}&referer=${encodeURIComponent(embedUrl)}`, type: 'mp4' });
      }

      return res.json({ success: false, error: 'URL Vidmoly introuvable, utilisation de l\'iframe.' });
    }

    // ── Hébergeurs génériques (Vidoza, Franime, etc.) ────────────
    try {
      const genResp = await axios.get(embedUrl, {
        headers: { 'User-Agent': ua, 'Referer': embedUrl },
        timeout: 8000
      });
      const genHtml = genResp.data || '';
      const m3u8Match = genHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)/);
      const mp4Match  = genHtml.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)/);

      if (m3u8Match) {
        return res.json({ success: true, videoUrl: `/api/proxy?url=${encodeURIComponent(m3u8Match[1])}&referer=${encodeURIComponent(embedUrl)}`, type: 'hls' });
      }
      if (mp4Match) {
        return res.json({ success: true, videoUrl: `/api/proxy?url=${encodeURIComponent(mp4Match[1])}&referer=${encodeURIComponent(embedUrl)}`, type: 'mp4' });
      }
    } catch (eGen) {}

    return res.json({ success: false, error: 'Hébergeur non supporté par le résolveur direct.' });

  } catch (error) {
    console.error('[Embed Resolver] Erreur:', error.message);
    res.json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`===========================================================`);
  console.log(` SERVEUR PREMIUM ANIME STREAMING & PROXY DÉMARRÉ `);
  console.log(` URL locale : http://localhost:${PORT} `);
  console.log(`===========================================================`);
});
