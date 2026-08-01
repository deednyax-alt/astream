// ============================================================
//  JapoPlay — Animes · Séries · Films · Mangas · TV & Sports
// ============================================================
const API_KEY = 'dc_live_c5d15446a0c5cf51b22b5be9';
const DC_API  = 'https://deadcow-streaming.lol/api/v1';

window.NO_IMAGE_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280"><rect width="200" height="280" fill="%23121420"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%238b5cf6" font-family="sans-serif" font-size="18" font-weight="bold">JapoPlay</text><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-family="sans-serif" font-size="12">Image indisponible</text></svg>';
const NO_IMAGE_SVG = window.NO_IMAGE_SVG;

function normalizePosterUrl(poster, item = {}) {
  if (!poster || poster === 'null' || poster === 'undefined' || typeof poster !== 'string' || poster.trim() === '') {
    const slug = (item.title || item.name || item.id || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (slug && (item.type === 'anime' || item.isAnime)) {
      return `https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/${slug}.jpg`;
    }
    return NO_IMAGE_SVG;
  }
  let clean = poster.trim();
  if (clean.startsWith('/')) {
    clean = `https://image.tmdb.org/t/p/w500${clean}`;
  }
  if (clean.startsWith('http://')) {
    clean = clean.replace('http://', 'https://');
  }
  return clean;
}

// ─── État Global ─────────────────────────────────────────────
let currentAnime   = null;
let currentVersion = 'vf';
let currentAnimeVersionFilter = 'all'; // 'all', 'vf', 'vostfr'
let currentCat     = 'anime';
let currentGenre   = 'all';
let pages          = { anime: 1, tv: 1, movie: 1, manga: 1 };
let loaded         = { anime: false, tv: false, movie: false, manga: false, live: false };
let searchDebounce = null;

// État Manga Reader
let currentMangaChapters = [];
let currentMangaChapter  = null;
let currentMangaPages    = [];
let currentMangaPageIndex= 0;
let mangaReaderMode      = 'single'; // 'single' ou 'scroll'

// ─── $ helper ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ─── DOM refs ────────────────────────────────────────────────
const searchInput     = $('search-input');
const dataStatusBadge = $('data-source-badge');
const heroBanner      = $('hero-banner');
const heroTitle       = $('hero-title');
const heroRating      = $('hero-rating');
const heroGenres      = $('hero-genres');
const heroSynopsis    = $('hero-synopsis');
const heroPlayBtn     = $('hero-play-btn');
const heroInfoBtn     = $('hero-info-btn');
const loadMoreBtn     = $('load-more-btn');

const detailsModal      = $('details-modal');
const closeModalBtn     = $('close-modal-btn');
const modalBanner       = $('modal-banner');
const modalTitle        = $('modal-title');
const modalRating       = $('modal-rating');
const modalGenres       = $('modal-genres');
const modalSynopsis     = $('modal-synopsis');
const modalEpisodesGrid = $('modal-episodes-grid');
const episodesTitle     = $('episodes-section-title');

const playerModal        = $('player-modal');
const closePlayerBtn     = $('close-player-btn');
const playerAnimeTitle   = $('player-anime-title');
const playerEpTitle      = $('player-episode-title');
const videoPlayer        = $('premium-video-player');
const videoLoader        = $('video-loader');
const streamSourceSelect = $('stream-source-select');

// Manga Reader DOM refs
const mangaModal        = $('manga-reader-modal');
const closeMangaBtn      = $('close-manga-btn');
const mangaTitle        = $('manga-title');
const mangaChapterTitle = $('manga-chapter-title');
const mangaChapterSelect= $('manga-chapter-select');
const mangaModeToggle   = $('manga-mode-toggle');
const mangaLoader       = $('manga-loader');
const mangaSinglePage   = $('manga-single-page');
const mangaCurrentImg   = $('manga-current-img');
const mangaScrollContainer = $('manga-scroll-container');
const mangaPrevPageBtn  = $('manga-prev-page');
const mangaNextPageBtn  = $('manga-next-page');
const mangaPageCounter  = $('manga-page-counter');

// Suggestion Modal DOM refs
const suggestionModal  = $('suggestion-modal');
const openSugBtn       = $('open-suggestion-btn');
const closeSugBtn      = $('close-suggestion-btn');
const sendSugBtn       = $('send-sug-btn');
const sugTitleInput    = $('sug-title');
const sugCatSelect     = $('sug-cat');
const sugPseudoInput   = $('sug-pseudo');
const sugStatusDiv     = $('sug-status');

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSplashLoader();
  setupNavTabs();
  setupCategoryTabs();
  setupSubTabs();
  setupSearch();
  setupPlayerEvents();
  setupAutoplayNext();
  setupMangaReaderEvents();
  setupSuggestionEvents();
  setupHistoryEvents();
  setupAuthEvents();
  setupConsole();
  setupServerMonitor();

  loadGenres();
  loadResolverStatus();

  // Charger uniquement la catégorie active au démarrage (Accueil / Tendances)
  loadCategory('all');
});

// ─── Surveillance du Statut du Serveur & Mode Maintenance ────────
function setupServerMonitor() {
  let isOffline = false;
  const offlineOverlay = $('server-offline-overlay');
  const maintOverlay   = $('maintenance-overlay');
  const maintMsgText   = $('maintenance-msg-text');

  const checkHealth = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();

        // Si le serveur est reconnecté, masquer l'écran hors-ligne
        if (isOffline) {
          isOffline = false;
          if (offlineOverlay) offlineOverlay.classList.remove('active');
        }

        // Gérer l'affichage du Mode Maintenance
        if (data.maintenance) {
          if (maintOverlay) maintOverlay.classList.add('active');
          if (maintMsgText && data.maintenanceMessage) {
            maintMsgText.innerHTML = data.maintenanceMessage;
          }
        } else {
          if (maintOverlay) maintOverlay.classList.remove('active');
        }

      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      if (maintOverlay) maintOverlay.classList.remove('active');
      if (!isOffline) {
        isOffline = true;
        if (offlineOverlay) offlineOverlay.classList.add('active');
        console.warn('[Server Monitor] Serveur Node hors-ligne ou injoignable.');
      }
    }
  };

  // Vérification de santé récurrente (toutes les 3 secondes)
  setInterval(checkHealth, 3000);
  checkHealth();
}

// ─── Navigation Header (Accueil / Animes / Séries / Films / Mangas / TV / Planning / Console) ───
function setupNavTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      const targetCat = btn.dataset.cat;

      if (targetTab) {
        document.querySelectorAll('.nav-btn[data-tab]').forEach(b => {
          if (!b.dataset.cat) b.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        $(`${targetTab}-section`)?.classList.add('active');
      }

      if (targetCat) {
        switchCategory(targetCat);
      }
    });
  });
}

// ─── Onglets Catégories (Accueil / Anime / TV / Films / Manga / Live / Planning) ───
function setupCategoryTabs() {
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const cat = tab.dataset.cat;
      switchCategory(cat);
    });
  });

  loadMoreBtn.addEventListener('click', () => {
    if (currentCat !== 'live' && currentCat !== 'schedule') {
      pages[currentCat] = (pages[currentCat] || 1) + 1;
      loadCategory(currentCat, true);
    }
  });
}

function switchCategory(cat) {
  // Synchroniser les boutons du header et des onglets de sous-barre
  document.querySelectorAll('.nav-btn[data-cat]').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat);
  });

  document.querySelectorAll('.cat-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.cat === cat);
  });

  document.querySelectorAll('.category-section').forEach(s => s.classList.remove('active'));
  const targetSection = $(`cat-${cat}`);
  if (targetSection) targetSection.classList.add('active');

  // S'assurer que le catalogue principal est affiché
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  $('catalog-section')?.classList.add('active');

  currentCat = cat;

  if (!loaded[cat]) loadCategory(cat);
  else renderPagination(cat);

  const genreBar = $('genre-bar-container');
  if (genreBar) {
    genreBar.style.display = (cat === 'manga' || cat === 'live' || cat === 'schedule') ? 'none' : 'block';
  }

  loadMoreBtn.style.display = (cat !== 'live' && cat !== 'schedule') ? 'inline-flex' : 'none';
}

// ─── Sous-Onglets TV Direct (Chaînes / Sports) ───────────────
function setupSubTabs() {
  const btnChannels = $('subtab-channels');
  const btnMatches  = $('subtab-matches');
  const gridChannels= $('grid-live-channels');
  const gridMatches = $('grid-live-matches');

  if (btnChannels && btnMatches) {
    btnChannels.addEventListener('click', () => {
      btnChannels.classList.add('active');
      btnMatches.classList.remove('active');
      gridChannels.style.display = 'grid';
      gridMatches.style.display = 'none';
    });

    btnMatches.addEventListener('click', () => {
      btnMatches.classList.add('active');
      btnChannels.classList.remove('active');
      gridChannels.style.display = 'none';
      gridMatches.style.display = 'grid';
      if (!gridMatches.dataset.loaded) loadLiveMatches(gridMatches);
    });
  }

  // Événements des sous-onglets du Planning Hebdomadaire
  document.querySelectorAll('#schedule-day-tabs .sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      renderScheduleForDay(tab.dataset.day);
    });
  });

  // Basculement Planning Animes Hebdo vs Prochaines Sorties Films 2026
  const btnSchedAnimes = $('btn-schedule-animes');
  const btnSchedMovies = $('btn-schedule-movies');
  const gridSchedule = $('grid-schedule');
  const gridMoviesSchedule = $('grid-movies-schedule');
  const dayTabsGroup = $('schedule-day-tabs');

  if (btnSchedAnimes && btnSchedMovies) {
    btnSchedAnimes.onclick = () => {
      btnSchedAnimes.classList.add('active');
      btnSchedMovies.classList.remove('active');
      if (gridSchedule) gridSchedule.style.display = 'grid';
      if (gridMoviesSchedule) gridMoviesSchedule.style.display = 'none';
      if (dayTabsGroup) dayTabsGroup.style.display = 'flex';
    };

    btnSchedMovies.onclick = () => {
      btnSchedMovies.classList.add('active');
      btnSchedAnimes.classList.remove('active');
      if (gridSchedule) gridSchedule.style.display = 'none';
      if (gridMoviesSchedule) gridMoviesSchedule.style.display = 'grid';
      if (dayTabsGroup) dayTabsGroup.style.display = 'none';
      loadUpcomingMovies(gridMoviesSchedule);
    };
  }
}

// ─── Programme des Prochaines Sorties Films 2026 ───────────────
const UPCOMING_MOVIES_LIST = [
  {
    id: "969681",
    title: "Spider-Man : Brand New Day",
    type: "movie",
    year: "2026",
    releaseDate: "24 Juillet 2026 (Cinéma)",
    rating: 9.2,
    poster: "https://image.tmdb.org/t/p/w500/yikio8CfJxIA7faZxgvB9FGXy6u.jpg",
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
    overview: "Din Djarin et Grogu font le grand saut sur grand écran dans le nouveau film Star Wars réalisé par Jon Favreau."
  }
];

async function loadUpcomingMovies(grid) {
  if (!grid) return;

  grid.innerHTML = '';
  let moviesList = UPCOMING_MOVIES_LIST;

  try {
    const res = await fetch('/api/upcoming-movies');
    if (res.ok) {
      const data = await res.json();
      if (data && data.movies && data.movies.length > 0) {
        moviesList = data.movies;
      }
    }
  } catch (err) {}

  moviesList.forEach(item => {
    const card = document.createElement('div');
    card.className = 'anime-card';
    card.innerHTML = `
      <div class="card-image-container">
        <img src="${item.poster}" alt="${item.title}" loading="lazy" onerror="this.onerror=null;this.src='${NO_IMAGE_SVG}'">
        <div class="card-overlay">
          <span class="card-play-btn"><i class="fa-solid fa-circle-info"></i></span>
        </div>
        <span class="card-rating" style="background:rgba(168,85,247,0.9);border-color:var(--accent-purple)"><i class="fa-solid fa-calendar"></i> ${item.year || '2026'}</span>
      </div>
      <div class="card-info">
        <h4 class="card-title">${item.title}</h4>
        <div class="card-meta">
          <span style="color:var(--accent-cyan);font-weight:700;font-size:0.78rem"><i class="fa-solid fa-film"></i> ${item.releaseDate || 'Sortie 2026'}</span>
        </div>
      </div>
    `;
    card.onclick = () => openDetails(item, false);
    grid.appendChild(card);
  });
}

// ─── Appel API DeadCow v1 (Direct & Proxy Serveur Automatique) ───
async function dcFetch(endpoint, params = {}, options = {}) {
  const { retries = 2, retryDelay = 1000, timeout = 35000 } = options;

  let queryStr = `key=${API_KEY}`;
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) queryStr += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
  });

  const proxyUrl  = `/api/dc-proxy${endpoint}?${queryStr}`;
  const directUrl = `${DC_API}${endpoint}?${queryStr}`;
  const targets   = [proxyUrl, directUrl, proxyUrl];

  let lastError;
  for (let attempt = 0; attempt < targets.length && attempt <= retries; attempt++) {
    try {
      const target = targets[attempt];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(target, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 1500));
        }
        throw new Error(`Erreur API ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, retryDelay));
      }
    }
  }

  // Télémétrie d'erreur automatique (POST /send-key-bug)
  sendErrorTelemetry(endpoint, lastError?.message || 'Erreur API DeadCow');
  throw lastError;
}

// Envoi de la télémétrie d'erreur en arrière-plan (via le proxy local pour éviter CORS)
function sendErrorTelemetry(endpoint, errorMsg) {
  try {
    fetch('/api/send-key-bug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: API_KEY, endpoint, error: errorMsg })
    }).catch(() => {});
  } catch (e) {}
}

// ─── Chargement des Genres ────────────────────────────────────
async function loadGenres() {
  const container = $('genre-pills');
  if (!container) return;

  try {
    const data = await dcFetch('/catalog/genres');
    if (data && data.genres) {
      Object.entries(data.genres).forEach(([slug, info]) => {
        const btn = document.createElement('button');
        btn.className = 'genre-pill';
        btn.dataset.genre = slug;
        btn.textContent = info.name || slug;
        btn.addEventListener('click', () => {
          document.querySelectorAll('.genre-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentGenre = slug;
          pages[currentCat] = 1;
          loadCategory(currentCat);
        });
        container.appendChild(btn);
      });
    }
  } catch (e) {
    console.warn('[Genres] Chargement genres impossible:', e.message);
  }
}

// ─── Chargement du Statut des Résolveurs ──────────────────────
async function loadResolverStatus() {
  const pingContainer = $('resolvers-ping-container');
  if (!pingContainer) return;

  try {
    const data = await dcFetch('/resolvers/status');
    if (data && data.resolvers) {
      pingContainer.innerHTML = Object.entries(data.resolvers).map(([name, info]) => {
        const isOnline = info.status === 'online';
        const color = isOnline ? '#10b981' : '#ef4444';
        return `<span class="ping-badge" style="color:${color};border-color:${color}44"><i class="fa-solid fa-circle" style="font-size:0.5rem"></i> ${name.toUpperCase()}: ${info.pingMs || 50}ms</span>`;
      }).join('');
    }
  } catch (e) {}
}

// ─── Termes populaires pour Animes et Mangas ──────────────────
const ANIME_QUERIES = [
  'dragon ball', 'naruto', 'one piece', 'demon slayer', 'attack on titan',
  'jujutsu kaisen', 'solo leveling', 'bleach', 'black clover', 'fairy tail',
  'hunter x hunter', 'fullmetal alchemist', 'death note', 'sword art online',
  'my hero academia', 'tokyo ghoul', 'vinland saga', 'chainsaw man',
  'overlord', 'konosuba', 're zero', 'violet evergarden', 'spy x family',
  'blue lock', 'mob psycho', 'dr stone', 'boruto', 'tokyo revengers',
  'dandadan', 'kaiju', 'wind breaker', 'mushoku tensei', 'classroom of the elite',
  'frieren', 'initial d', 'hajime no ippo', 'detective conan', 'saint seiya',
  'captain tsubasa', 'gintama', 'haikyuu', 'code geass', 'steins gate',
  'evangelion', 'fire force', 'monster', 'fate', 'hellsing', 'soul eater'
];

const MANGA_QUERIES = [
  'solo leveling', 'one piece', 'jujutsu kaisen', 'chainsaw man',
  'demon slayer', 'berserk', 'bleach', 'naruto', 'tokyo revengers',
  'spy x family', 'blue lock', 'kaiju no 8', 'dragon ball'
];

// ─── Catalogue d'Animes Populaires Garanti ────────────────────
const POPULAR_ANIMES_CATALOG = [
  { id: 'https://anime-sama.to/catalogue/one-piece/', title: 'One Piece', type: 'anime', rating: 9.6, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/one-piece.jpg' },
  { id: 'https://anime-sama.to/catalogue/dragon-ball-super/', title: 'Dragon Ball Super', type: 'anime', rating: 9.2, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/dragon-ball-super.jpg' },
  { id: 'https://anime-sama.to/catalogue/dragon-ball-z/', title: 'Dragon Ball Z', type: 'anime', rating: 9.4, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/dragon-ball-z.jpg' },
  { id: 'https://anime-sama.to/catalogue/naruto-shippuden/', title: 'Naruto Shippuden', type: 'anime', rating: 9.3, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/naruto-shippuden.jpg' },
  { id: 'https://anime-sama.to/catalogue/demon-slayer/', title: 'Demon Slayer (Kimetsu no Yaiba)', type: 'anime', rating: 9.5, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/demon-slayer.jpg' },
  { id: 'https://anime-sama.to/catalogue/attaque-des-titans/', title: 'L\'Attaque des Titans (Shingeki no Kyojin)', type: 'anime', rating: 9.6, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/attaque-des-titans.jpg' },
  { id: 'https://anime-sama.to/catalogue/jujutsu-kaisen/', title: 'Jujutsu Kaisen', type: 'anime', rating: 9.4, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/jujutsu-kaisen.jpg' },
  { id: 'https://anime-sama.to/catalogue/solo-leveling/', title: 'Solo Leveling', type: 'anime', rating: 9.5, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/solo-leveling0.jpg' },
  { id: 'https://anime-sama.to/catalogue/my-hero-academia/', title: 'My Hero Academia', type: 'anime', rating: 8.9, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/my-hero-academia.jpg' },
  { id: 'https://anime-sama.to/catalogue/hunter-x-hunter/', title: 'Hunter x Hunter', type: 'anime', rating: 9.5, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/hunter-x-hunter.jpg' },
  { id: 'https://anime-sama.to/catalogue/bleach/', title: 'Bleach', type: 'anime', rating: 9.1, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/bleach.jpg' },
  { id: 'https://anime-sama.to/catalogue/death-note/', title: 'Death Note', type: 'anime', rating: 9.3, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/death-note.jpg' },
  { id: 'https://anime-sama.to/catalogue/black-clover/', title: 'Black Clover', type: 'anime', rating: 8.9, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/black-clover.jpg' },
  { id: 'https://anime-sama.to/catalogue/chainsaw-man/', title: 'Chainsaw Man', type: 'anime', rating: 9.0, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/chainsaw-man.jpg' },
  { id: 'https://anime-sama.to/catalogue/dandadan/', title: 'Dandadan', type: 'anime', rating: 9.2, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/dandadan.jpg' },
  { id: 'https://anime-sama.to/catalogue/frieren/', title: 'Frieren: Beyond Journey\'s End', type: 'anime', rating: 9.6, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/frieren.jpg' },
  { id: 'https://anime-sama.to/catalogue/kaiju-no-8/', title: 'Kaiju N°8', type: 'anime', rating: 8.8, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/kaiju-no-8.jpg' },
  { id: 'https://anime-sama.to/catalogue/blue-lock/', title: 'Blue Lock', type: 'anime', rating: 9.0, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/blue-lock.jpg' },
  { id: 'https://anime-sama.to/catalogue/vinland-saga/', title: 'Vinland Saga', type: 'anime', rating: 9.3, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/vinland-saga.jpg' },
  { id: 'https://anime-sama.to/catalogue/dragon-ball-daima/', title: 'Dragon Ball Daima', type: 'anime', rating: 8.9, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/dragon-ball-daima.jpg' }
];

// ─── Chaînes TV de Secours (Flux 1080p HD Valides) ────────────
const FALLBACK_CHANNELS = [
  {
    id: 'bfm2-fr', name: 'BFM2 Live HD (1080p)', category: 'Information',
    logo: 'https://alloforfait.fr/wp-content/uploads/2024/03/logo-bfm2-300x200.jpg',
    streamUrl: 'https://d1ib1gsg71oarf.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-scp7wda722jph/BFM2_FR.m3u8'
  },
  {
    id: 'adn-tv', name: 'ADN Anime TV+ (HD)', category: 'Animes & Animation',
    logo: 'https://i.imgur.com/HQZQyWt.png',
    streamUrl: 'https://d3b73b34o7cvkq.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-gz2sgqzp076kf/adn.m3u8'
  },
  {
    id: 'mr-bean-anime', name: 'Mr Bean Animé (1080p)', category: 'Enfants & Jeunesse',
    logo: 'https://static.wikia.nocookie.net/logopedia/images/2/25/Mr._Bean_Animated_Series_stacked_logo.png',
    streamUrl: 'https://amg00627-amg00627c31-rakuten-fr-3991.playouts.now.amagi.tv/playlist/amg00627-banijayfast-mrbeanfrcc-rakutenfr/playlist.m3u8'
  },
  {
    id: '20min-tv', name: '20 Minutes TV (1080p)', category: 'Divertissement',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/20_Minutes_TV_IDF_logo_%282023%29.png/960px-20_Minutes_TV_IDF_logo_%282023%29.png',
    streamUrl: 'https://live-20minutestv.digiteka.com/1961167769/index.m3u8'
  },
  {
    id: 'africa24-live', name: 'Africa 24 Live (1080p)', category: 'Info Monde',
    logo: 'https://africa24tv.com/wp-content/uploads/2021/09/logo.png',
    streamUrl: 'https://africa24.vedge.infomaniak.com/livecast/ik:africa24/manifest.m3u8'
  },
  {
    id: 'dw-live', name: 'Deutsche Welle Live', category: 'Information',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_logo.svg/200px-Deutsche_Welle_logo.svg.png',
    streamUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8'
  }
];

// ─── Planning Hebdomadaire des Sorties Anime ──────────────────
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const WEEKLY_SCHEDULE = {
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

function renderScheduleForDay(dayName) {
  const grid = $('grid-schedule');
  if (!grid) return;

  const dayTabs = document.querySelectorAll('#schedule-day-tabs .sub-tab');
  dayTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.day === dayName);
  });

  const releases = WEEKLY_SCHEDULE[dayName] || WEEKLY_SCHEDULE['dimanche'];
  grid.innerHTML = '';
  renderCards(grid, releases);
}

// ─── Système d'Historique de Visionnage ────────────────────────
function addToWatchHistory(item) {
  if (!item || !item.title) return;

  try {
    const history = JSON.parse(localStorage.getItem('astream_history') || '[]');
    const now = new Date();
    const dateFormatted = `Vu le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

    // Supprimer les doublons récents pour le même titre
    const filtered = history.filter(h => h.title !== item.title || h.season !== item.season || h.episode !== item.episode);

    let displayTitle = item.title;
    if (item.episode) {
      displayTitle += ` — ${item.season ? 'S' + item.season + ' ' : ''}Ep. ${item.episode}`;
    }

    const historyItem = {
      id: item.id || `hist_${Date.now()}`,
      title: displayTitle,
      type: item.type || 'anime',
      rating: item.rating || 9.0,
      poster: item.poster || NO_IMAGE_SVG,
      season: item.season,
      episode: item.episode,
      streamUrl: item.streamUrl || item.embedUrl || item.id,
      dateWatched: dateFormatted,
      genres: [{ name: `🕒 ${dateFormatted}` }]
    };

    filtered.unshift(historyItem);
    // Garder les 50 plus récents
    localStorage.setItem('astream_history', JSON.stringify(filtered.slice(0, 50)));

    if (currentCat === 'history') loadWatchHistory();
  } catch (e) {
    console.warn('[Historique] Erreur enregistrement:', e.message);
  }
}

function loadWatchHistory() {
  const grid = $('grid-history');
  if (!grid) return;

  try {
    const history = JSON.parse(localStorage.getItem('astream_history') || '[]');
    if (history.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px 20px" class="glass">
          <i class="fa-solid fa-clock-rotate-left" style="font-size:3rem;color:var(--accent-cyan);margin-bottom:15px"></i>
          <h3 style="color:#fff;margin-bottom:10px">Aucun historique de visionnage</h3>
          <p style="color:var(--text-muted);font-size:0.9rem">Lisez un anime, une série ou un film pour le retrouver automatiquement ici !</p>
        </div>`;
      return;
    }

    grid.innerHTML = '';
    renderCards(grid, history);
  } catch (e) {
    grid.innerHTML = `<p style="grid-column:1/-1;color:#ef4444;padding:20px">⚠ Erreur de lecture de l'historique.</p>`;
  }
}

function setupHistoryEvents() {
  const clearBtn = $('clear-history-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Voulez-vous vraiment effacer tout votre historique de visionnage ?')) {
        localStorage.removeItem('astream_history');
        loadWatchHistory();
      }
    });
  }
}

// ─── Chargement d'une catégorie ───────────────────────────────
async function loadCategory(cat, append = false) {
  const gridId = (cat === 'live') ? 'grid-live-channels' : `grid-${cat}`;
  const grid   = $(gridId);
  if (!grid) return;

  if (!append) showSkeleton(grid, cat === 'live' ? 'channel' : 'card');

  try {
    let items = [];

    if (cat === 'all') {
      // Page d'accueil (Tendances)
      const [rTv, rMovie, rAnime] = await Promise.all([
        dcFetch('/catalog/popular', { type: 'tv', page: 1 }).catch(() => ({ results: [] })),
        dcFetch('/catalog/popular', { type: 'movie', page: 1 }).catch(() => ({ results: [] })),
        dcFetch('/search', { q: 'one piece', type: 'anime' }).catch(() => ({ results: [] }))
      ]);

      const combined = [
        ...(rAnime.results || []).slice(0, 4),
        ...(rTv.results || []).slice(0, 6),
        ...(rMovie.results || []).slice(0, 6)
      ].filter(r => r.poster);

      items = combined;
      if (!append) grid.innerHTML = '';
      renderCards(grid, items);
      loaded.all = true;

      if (items.length > 0) setHero(items[0]);

    } else if (cat === 'schedule') {
      // Planning Hebdomadaire des Sorties par Jour
      const todayName = DAYS_FR[new Date().getDay()] || 'dimanche';
      renderScheduleForDay(todayName);
      loaded.schedule = true;

    } else if (cat === 'history') {
      // Historique de Visionnage
      loadWatchHistory();
      loaded.history = true;

    } else if (cat === 'live') {
      let usingFallback = false;
      try {
        const data = await dcFetch('/iptv/channels');
        items = data.channels || [];
      } catch (iptvErr) {
        items = FALLBACK_CHANNELS;
        usingFallback = true;
      }
      renderChannels(grid, items);
      loaded.live = true;

      if (usingFallback) {
        dataStatusBadge.textContent = '📡 Chaînes de secours';
        dataStatusBadge.style.color = '#f59e0b';
      }

    } else if (cat === 'manga') {
      // Mangas & Scans (MangaDex Engine)
      const qIdx = (pages.manga - 1) % MANGA_QUERIES.length;
      const query = MANGA_QUERIES[qIdx];
      const data  = await dcFetch('/mangadex/search', { q: query });
      items = (data.results || []).map(m => ({
        id: m.id,
        title: m.title,
        type: 'manga',
        poster: m.poster || NO_IMAGE_SVG,
        synopsis: m.description,
        status: m.status
      }));

      if (!append) grid.innerHTML = '';
      renderCards(grid, items);
      loaded.manga = true;

    } else if (cat === 'anime') {
      let combined = [];
      const seen = new Set();
      if (append && grid._seenIds) {
        grid._seenIds.forEach(id => seen.add(id));
      } else {
        grid._seenIds = new Set();
      }

      if (currentAnimeSearchQuery) {
        // Mode Recherche Anime active
        dataStatusBadge.textContent = `🔍 Recherche Anime : "${currentAnimeSearchQuery}"…`;
        const data = await dcFetch('/search', { q: currentAnimeSearchQuery, type: 'anime' }).catch(() => ({ results: [] }));
        (data.results || []).forEach(item => {
          if (item && item.title && !seen.has(item.id || item.title)) {
            const animeId = item.id || item.title;
            seen.add(animeId);
            grid._seenIds.add(animeId);
            const slug = (item.title || animeId || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            if (!item.poster || !item.poster.startsWith('http')) {
              item.poster = `https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/${slug}.jpg`;
            }
            if (!item.type) item.type = 'anime';
            combined.push(item);
          }
        });
      } else {
        // Mode Catalogue Standard + Chargement par lot
        const countPerPage = 4;
        const startIdx = ((pages.anime - 1) * countPerPage) % ANIME_QUERIES.length;
        const batchQueries = [];
        for (let i = 0; i < countPerPage; i++) {
          batchQueries.push(ANIME_QUERIES[(startIdx + i) % ANIME_QUERIES.length]);
        }

        const resultsList = await Promise.all(
          batchQueries.map(q => dcFetch('/search', { q, type: 'anime' }).catch(() => ({ results: [] })))
        );

        if (pages.anime === 1 && !append) {
          POPULAR_ANIMES_CATALOG.forEach(a => {
            if (!seen.has(a.id)) {
              seen.add(a.id);
              grid._seenIds.add(a.id);
              combined.push(a);
            }
          });
        }

        resultsList.forEach(r => {
          (r.results || []).forEach(item => {
            if (item && item.title && !seen.has(item.id || item.title)) {
              const animeId = item.id || item.title;
              seen.add(animeId);
              grid._seenIds.add(animeId);
              const slug = (item.title || animeId || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              if (!item.poster || !item.poster.startsWith('http')) {
                item.poster = `https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/${slug}.jpg`;
              }
              if (!item.type) item.type = 'anime';
              combined.push(item);
            }
          });
        });
      }

      // Filtrer par genre si sélectionné
      if (currentAnimeSelectedGenre && currentAnimeSelectedGenre !== 'all') {
        const gLower = currentAnimeSelectedGenre.toLowerCase();
        combined = combined.filter(it => {
          const title = (it.title || '').toLowerCase();
          const genres = (it.genres || []).map(g => (g.name || g).toLowerCase()).join(' ');
          return title.includes(gLower) || genres.includes(gLower);
        });
      }

      // Filtrer selon la version sélectionnée (VF / VOSTFR / TOUS)
      if (currentAnimeVersionFilter === 'vf') {
        combined = combined.map(it => {
          const title = (it.title || '').replace(/\s*\((VOSTFR|Sub|VF)\)/i, '');
          return { ...it, title: `${title} (VF)`, preferredVersion: 'vf' };
        });
      } else if (currentAnimeVersionFilter === 'vostfr') {
        combined = combined.map(it => {
          const title = (it.title || '').replace(/\s*\((VOSTFR|Sub|VF)\)/i, '');
          return { ...it, title: `${title} (VOSTFR)`, preferredVersion: 'vostfr' };
        });
      }

      items = combined;

      if (!append) grid.innerHTML = '';
      if (items.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1;color:var(--text-muted);padding:30px;text-align:center;">Aucun anime correspondant à votre recherche.</p>`;
      } else {
        renderCards(grid, items);
      }
      loaded.anime = true;

      if (pages.anime === 1 && items.length > 0) setHero(items[0]);

    } else {
      // Séries TV ou Films (avec filtre de genre optionnel)
      const params = { type: cat, page: pages[cat] };
      if (currentGenre && currentGenre !== 'all') params.genre = currentGenre;

      const data = await dcFetch('/catalog/popular', params);
      items = (data.results || []).filter(r => r.poster);

      if (!append) grid.innerHTML = '';
      renderCards(grid, items);
      loaded[cat] = true;

      if (cat === 'tv' && pages.tv === 1 && items.length > 0 && !loaded.anime) {
        setHero(items[0]);
      }
    }

    dataStatusBadge.textContent = '⚡ astream Live';
    dataStatusBadge.style.color = '#10b981';

    // Rendu de la pagination dynamique par onglets
    renderPagination(cat);

  } catch (err) {
    console.error(`Erreur chargement [${cat}]:`, err);
    grid.innerHTML = `<p style="grid-column:1/-1;color:#ef4444;padding:20px">⚠ Impossible de charger : ${err.message}</p>`;
    dataStatusBadge.textContent = '⚠ Erreur API';
    dataStatusBadge.style.color = '#ef4444';
  }
}

// ─── Système de Pagination Dynamique par Onglets ──────────────────
function renderPagination(cat) {
  const container = $('pagination-container');
  if (!container) return;

  if (cat === 'live' || cat === 'schedule') {
    container.style.display = 'none';
    return;
  }

  const currentPage = pages[cat] || 1;
  let totalPages = 10;
  if (cat === 'manga') totalPages = MANGA_QUERIES.length;
  if (cat === 'anime') totalPages = Math.ceil(ANIME_QUERIES.length / 8);

  container.style.display = 'flex';

  let html = `<div class="pagination-bar">`;

  // Bouton Précédent
  html += `<button class="page-pill ${currentPage <= 1 ? 'disabled' : ''}" onclick="changePage('${cat}', ${currentPage - 1})">
    <i class="fa-solid fa-chevron-left"></i> Précédent
  </button>`;

  // Boutons numériques de pages (ex: 1, 2, 3, 4, 5...)
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    html += `<button class="page-pill" onclick="changePage('${cat}', 1)">1</button>`;
    if (startPage > 2) html += `<span class="page-pill disabled">…</span>`;
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `<button class="page-pill ${p === currentPage ? 'active' : ''}" onclick="changePage('${cat}', ${p})">${p}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="page-pill disabled">…</span>`;
    html += `<button class="page-pill" onclick="changePage('${cat}', ${totalPages})">${totalPages}</button>`;
  }

  // Bouton Suivant
  html += `<button class="page-pill ${currentPage >= totalPages ? 'disabled' : ''}" onclick="changePage('${cat}', ${currentPage + 1})">
    Suivant <i class="fa-solid fa-chevron-right"></i>
  </button>`;

  html += `</div>`;
  container.innerHTML = html;
}

window.changePage = function(cat, pageNum) {
  if (pageNum < 1) return;
  pages[cat] = pageNum;
  loadCategory(cat, false);

  const section = $(`cat-${cat}`) || $('catalog-section');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// ─── Chargement des Matchs de Sport Live ──────────────────────
async function loadLiveMatches(grid) {
  showSkeleton(grid, 'card');
  try {
    const data = await dcFetch('/iptv/matches');
    grid.dataset.loaded = 'true';
    grid.innerHTML = '';

    const matches = data.matches || [];
    if (matches.length === 0) {
      grid.innerHTML = `<p style="grid-column:1/-1;color:var(--text-muted);padding:20px">Aucun match en direct programmé pour le moment.</p>`;
      return;
    }

    matches.forEach(m => {
      const card = document.createElement('div');
      card.className = 'anime-card';
      card.innerHTML = `
        <div class="card-img-container" style="background:#121420;display:flex;align-items:center;justify-content:center">
          <i class="fa-solid fa-futbol" style="font-size:3rem;color:var(--accent-cyan)"></i>
          <span class="live-badge" style="top:10px;right:10px"><i class="fa-solid fa-circle"></i> EN DIRECT</span>
        </div>
        <div class="card-info">
          <h3>${m.title || m.name || 'Match Live'}</h3>
          <span class="card-genres">${m.league || m.category || 'Sport'} · ${m.time || 'Aujourd\'hui'}</span>
        </div>`;
      card.addEventListener('click', () => {
        if (m.streamUrl) {
          stopPlayer();
          currentAnime = { title: m.title || 'Match Live' };
          playerAnimeTitle.textContent = m.title || 'Match Live';
          playerEpTitle.textContent    = `⚽ ${m.league || 'Sport Live'}`;
          videoLoader.classList.add('active');
          openModal(playerModal);
          buildSourceSelector({ streamUrl: m.streamUrl, embeds: {} });
          playStream(m.streamUrl);
        } else {
          alert('Le flux vidéo pour ce match démarrera au coup d\'envoi.');
        }
      });
      grid.appendChild(card);
    });

  } catch (e) {
    grid.innerHTML = `<p style="grid-column:1/-1;color:#ef4444">⚠ Erreur de chargement des matchs : ${e.message}</p>`;
  }
}

// ─── Skeleton ─────────────────────────────────────────────────
function showSkeleton(grid, type = 'card') {
  if (type === 'channel') {
    grid.innerHTML = Array(12).fill(0).map(() => `
      <div class="channel-card skeleton">
        <div class="skeleton-img" style="padding-top:56%;border-radius:10px"></div>
        <div class="skeleton-line" style="margin-top:8px"></div>
      </div>`).join('');
  } else {
    grid.innerHTML = Array(12).fill(0).map(() => `
      <div class="anime-card skeleton">
        <div class="card-img-container skeleton-img"></div>
        <div class="card-info"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
      </div>`).join('');
  }
}

// ─── Rendu cartes contenu ──────────────────────────────────────
function renderCards(grid, items) {
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'anime-card';
    const rating = item.rating ? parseFloat(item.rating).toFixed(1) : '—';
    const genres = (item.genres || []).map(g => g.name || g).join(', ') || item.type || '—';
    const typeLabel = item.type ? item.type.toUpperCase() : '';
    const posterSrc = normalizePosterUrl(item.poster, item);

    card.innerHTML = `
      <div class="card-img-container">
        <img src="${posterSrc}" alt="${item.title}" loading="lazy"
          onerror="this.onerror=null;this.src=window.NO_IMAGE_SVG||'${NO_IMAGE_SVG}';">
        <span class="card-rating"><i class="fa-solid fa-star"></i> ${rating}</span>
        ${typeLabel ? `<span class="card-type-badge">${typeLabel}</span>` : ''}
      </div>
      <div class="card-info">
        <h3>${item.title}</h3>
        <span class="card-genres">${genres}</span>
      </div>`;

    card.addEventListener('click', () => openDetails(item));
    grid.appendChild(card);
  });
}

// ─── Rendu chaînes TV Direct ──────────────────────────────────
function renderChannels(grid, channels) {
  grid.innerHTML = '';
  channels.forEach(ch => {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.innerHTML = `
      <div class="channel-logo-wrap">
        ${ch.logo
          ? `<img src="${ch.logo}" alt="${ch.name}" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.parentElement.innerHTML='<i class=\\'fa-solid fa-tv\\' style=\\'font-size:2rem;color:var(--accent-cyan)\\'></i>';">`
          : `<i class="fa-solid fa-tv" style="font-size:2rem;color:var(--accent-cyan)"></i>`}
      </div>
      <div class="channel-info">
        <strong>${ch.name}</strong>
        <span>${ch.category || 'TV'}</span>
      </div>
      <span class="live-badge"><i class="fa-solid fa-circle"></i> LIVE</span>`;

    card.addEventListener('click', () => {
      if (!ch.streamUrl) return alert('Flux non disponible.');
      stopPlayer();
      currentAnime = { title: ch.name };
      playerAnimeTitle.textContent = ch.name;
      playerEpTitle.textContent    = `📡 ${ch.category || 'TV Direct'}`;
      videoLoader.classList.add('active');
      openModal(playerModal);

      // Multi-sources avec secours 1080p HD 100% vérifiés si le flux d'origine de la chaîne échoue
      const sourcesData = {
        streamUrl: ch.streamUrl,
        embeds: {
          bfm2: 'https://d1ib1gsg71oarf.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-scp7wda722jph/BFM2_FR.m3u8',
          adn: 'https://d3b73b34o7cvkq.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-gz2sgqzp076kf/adn.m3u8',
          tv20min: 'https://live-20minutestv.digiteka.com/1961167769/index.m3u8',
          mrbean: 'https://amg00627-amg00627c31-rakuten-fr-3991.playouts.now.amagi.tv/playlist/amg00627-banijayfast-mrbeanfrcc-rakutenfr/playlist.m3u8'
        }
      };

      buildSourceSelector(sourcesData);
      playStream(ch.streamUrl);
    });

    grid.appendChild(card);
  });
}

// ─── Recherche Globale ────────────────────────────────────────
function setupSearch() {
  searchInput.addEventListener('input', e => {
    clearTimeout(searchDebounce);
    const q = e.target.value.trim();
    if (!q) {
      document.querySelectorAll('.category-section').forEach(s => s.classList.remove('active'));
      $(`cat-${currentCat}`).classList.add('active');
      return;
    }
    searchDebounce = setTimeout(() => runSearch(q), 400);
  });
}

async function runSearch(q) {
  const activeSection = document.querySelector('.category-section.active');
  const grid = activeSection ? activeSection.querySelector('.anime-grid, .channel-grid') : $('grid-anime');
  if (!grid) return;

  showSkeleton(grid, 'card');
  dataStatusBadge.textContent = `🔍 Recherche "${q}"…`;

  try {
    const data = await dcFetch('/search', { q, type: 'all' });
    let items = (data.results || []).filter(r => r && (r.title || r.name));

    // Normaliser les affiches pour tous les résultats
    items.forEach(it => {
      it.poster = normalizePosterUrl(it.poster, it);
    });

    // Trier les résultats de recherche par pertinence (titre exact, note TMDB & pertinence)
    const qLower = q.toLowerCase().trim();
    items.sort((a, b) => {
      const aExact = (a.title || '').toLowerCase().trim() === qLower;
      const bExact = (b.title || '').toLowerCase().trim() === qLower;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aRating = parseFloat(a.rating || 0);
      const bRating = parseFloat(b.rating || 0);
      if (bRating !== aRating) return bRating - aRating;

      return 0;
    });

    grid.innerHTML = '';
    if (items.length === 0) {
      grid.innerHTML = `<p style="grid-column:1/-1;color:var(--text-muted);padding:20px">Aucun résultat pour « ${q} ».</p>`;
    } else {
      setHero(items[0]);
      renderCards(grid, items);
    }
    dataStatusBadge.textContent = `${items.length} résultat(s)`;
  } catch (err) {
    grid.innerHTML = `<p style="grid-column:1/-1;color:#ef4444">Erreur : ${err.message}</p>`;
  }
}

// ─── Hero Banner ──────────────────────────────────────────────
function setHero(item) {
  heroTitle.textContent    = item.title;
  heroRating.textContent   = item.rating ? parseFloat(item.rating).toFixed(1) : '—';
  heroGenres.textContent   = (item.genres || []).map(g => g.name || g).join(', ') || item.type || '';
  heroSynopsis.textContent = item.overview || item.synopsis || '';
  const bg = normalizePosterUrl(item.backdrop || item.banner || item.poster, item);
  heroBanner.style.backgroundImage = `linear-gradient(to right,rgba(8,9,13,.97) 30%,rgba(8,9,13,.55) 65%,rgba(8,9,13,.1) 100%),url('${bg}')`;
  heroPlayBtn.onclick = () => openDetails(item, true);
  heroInfoBtn.onclick = () => openDetails(item, false);
}

// ─── Détails Anime / Série / Film / Manga ─────────────────────
async function openDetails(item, autoPlay = false) {
  currentAnime = item;
  modalTitle.textContent    = item.title;
  modalRating.textContent   = item.rating ? parseFloat(item.rating).toFixed(1) : '—';
  modalGenres.textContent   = (item.genres || []).map(g => g.name || g).join(', ') || '';
  modalSynopsis.textContent = item.overview || item.synopsis || '';
  const bg = normalizePosterUrl(item.backdrop || item.poster, item);
  modalBanner.style.backgroundImage = `url('${bg}')`;
  episodesTitle.innerHTML   = `<i class="fa-solid fa-list"></i> ${item.type === 'manga' ? 'Chapitres Manga' : 'Épisodes'}`;
  modalEpisodesGrid.innerHTML = `<div class="ep-loader"><div class="loader-spinner"></div><p>Chargement des éléments…</p></div>`;
  openModal(detailsModal);

  try {
    if (item.type === 'manga') {
      // Mode MangaDex
      const data = await dcFetch(`/mangadex/chapters/${item.id}`, { lang: 'fr' });
      const chapters = data.chapters || [];
      renderMangaChapters(item, chapters);
      return;
    }

    const isAnime  = item.type === 'anime' || (typeof item.id === 'string' && item.id.includes('http'));
    const type     = isAnime ? 'anime' : (item.type || 'tv');
    const detailId = item.id || item.tmdbId;
    let seasons    = item.seasons || [];

    if (isAnime) {
      if (!seasons || seasons.length === 0 || !seasons.some(s => (s.episodeCount || s.episodes || 0) > 0)) {
        try {
          const sData = await dcFetch('/seasons', { id: detailId, type: 'anime' });
          if (sData && sData.seasons && sData.seasons.length > 0) {
            seasons = sData.seasons;
          }
        } catch (sErr) {
          console.warn('[Seasons] Récupération saisons anime impossible:', sErr.message);
        }
      }
    } else {
      const details = await dcFetch('/catalog/details', { id: detailId, type });
      currentAnime = { ...item, ...details };
      seasons = (details.seasons && details.seasons.length > 0) ? details.seasons : seasons;
      if (details.overview) modalSynopsis.textContent = details.overview;
      if (details.genres)   modalGenres.textContent   = details.genres.map(g => g.name || g).join(', ');
      if (details.backdrop) modalBanner.style.backgroundImage = `url('${details.backdrop}')`;
    }

    if (type === 'movie') {
      modalEpisodesGrid.innerHTML = '';
      const btn = document.createElement('button');
      btn.className = 'episode-btn';
      btn.innerHTML = `<strong><i class="fa-solid fa-play"></i> Regarder le Film</strong>`;
      const movieTargetId = item.playUrl || item.id || item.tmdbId || item.title;
      btn.onclick = () => { closeModal(detailsModal); resolveAndPlay({ id: movieTargetId, type: 'movie', episode: 1, isAnime: false }); };
      modalEpisodesGrid.appendChild(btn);
      if (autoPlay) btn.click();
      return;
    }

    renderSeasonEpisodes(seasons, type, detailId, isAnime, autoPlay);

  } catch (err) {
    modalEpisodesGrid.innerHTML = `<p style="color:#ef4444">Erreur : ${err.message}</p>`;
  }
}

// Rendu des chapitres de Mangas
function renderMangaChapters(manga, chapters) {
  modalEpisodesGrid.innerHTML = '';
  if (chapters.length === 0) {
    modalEpisodesGrid.innerHTML = `<p style="color:var(--text-muted)">Aucun chapitre en français disponible pour ce manga.</p>`;
    return;
  }

  chapters.forEach((ch, idx) => {
    const btn = document.createElement('button');
    btn.className = 'episode-btn';
    btn.innerHTML = `<strong>Ch. ${ch.chapterNumber || (idx + 1)}</strong><span>${ch.title || ''}</span>`;
    btn.addEventListener('click', () => {
      closeModal(detailsModal);
      openMangaReader(manga, ch, chapters);
    });
    modalEpisodesGrid.appendChild(btn);
  });
}

function renderSeasonEpisodes(seasons, type, id, isAnime, autoPlay) {
  modalEpisodesGrid.innerHTML = '';

  // Filtrer les saisons valides (qui ont au moins 1 épisode)
  const validSeasons = (seasons || []).filter(s => {
    const count = s.episodeCount || s.episodes || s.episodesCount || 0;
    return count > 0;
  });

  const seasonsToRender = validSeasons.length > 0 ? validSeasons : seasons;

  if (!seasonsToRender || seasonsToRender.length === 0) {
    const sTitle = document.createElement('div');
    sTitle.className = 'season-title';
    sTitle.textContent = 'Épisodes Disponibles';
    modalEpisodesGrid.appendChild(sTitle);

    for (let ep = 1; ep <= 24; ep++) {
      const btn = makeEpisodeBtn(ep, null, () => {
        closeModal(detailsModal);
        resolveAndPlay({ id, type, season: 1, episode: ep, isAnime });
      });
      modalEpisodesGrid.appendChild(btn);
    }
    if (autoPlay) modalEpisodesGrid.querySelector('.episode-btn')?.click();
    return;
  }

  seasonsToRender.forEach(season => {
    const epCountRaw = season.episodeCount || season.episodes || season.episodesCount;
    const epCount = (typeof epCountRaw === 'number' && epCountRaw > 0) ? epCountRaw : 12;
    const sNum    = season.number ?? 1;

    const sTitle = document.createElement('div');
    sTitle.className = 'season-title';
    sTitle.textContent = season.name || `Saison ${sNum}`;
    modalEpisodesGrid.appendChild(sTitle);

    for (let ep = 1; ep <= epCount; ep++) {
      const btn = makeEpisodeBtn(ep, null, () => {
        closeModal(detailsModal);
        resolveAndPlay({ id, type, season: isAnime ? (season.name || sNum) : sNum, episode: ep, isAnime });
      });
      modalEpisodesGrid.appendChild(btn);
    }
  });

  if (autoPlay) modalEpisodesGrid.querySelector('.episode-btn')?.click();
}

function makeEpisodeBtn(number, title, onClick) {
  const btn = document.createElement('button');
  btn.className = 'episode-btn';
  btn.innerHTML = `<strong>Ep. ${number}</strong>${title ? `<span>${title}</span>` : ''}`;
  btn.addEventListener('click', onClick);
  return btn;
}

// ─── Lecteur MangaDex HD ──────────────────────────────────────
async function openMangaReader(manga, chapter, chapters) {
  currentMangaChapters   = chapters;
  currentMangaChapter    = chapter;
  currentMangaPageIndex  = 0;

  mangaTitle.textContent        = manga.title;
  mangaChapterTitle.textContent = chapter.title || `Chapitre ${chapter.chapterNumber}`;

  // Populer le select de chapitres
  mangaChapterSelect.innerHTML = chapters.map(c => `
    <option value="${c.id}" ${c.id === chapter.id ? 'selected' : ''}>
      Chapitre ${c.chapterNumber || ''} - ${c.title || ''}
    </option>
  `).join('');

  mangaChapterSelect.onchange = (e) => {
    const selectedCh = chapters.find(c => c.id === e.target.value);
    if (selectedCh) openMangaReader(manga, selectedCh, chapters);
  };

  mangaLoader.classList.add('active');
  openModal(mangaModal);

  try {
    const data = await dcFetch(`/mangadex/pages/${chapter.id}`);
    currentMangaPages = data.pages || [];
    mangaLoader.classList.remove('active');

    if (currentMangaPages.length === 0) {
      alert('Aucune page trouvée pour ce chapitre.');
      return;
    }

    renderMangaPage();
  } catch (e) {
    mangaLoader.classList.remove('active');
    alert(`Erreur chargement manga : ${e.message}`);
  }
}

function renderMangaPage() {
  if (currentMangaPages.length === 0) return;

  mangaPageCounter.textContent = `Page ${currentMangaPageIndex + 1} / ${currentMangaPages.length}`;

  if (mangaReaderMode === 'single') {
    mangaSinglePage.style.display = 'block';
    mangaScrollContainer.style.display = 'none';
    mangaCurrentImg.src = currentMangaPages[currentMangaPageIndex];
  } else {
    mangaSinglePage.style.display = 'none';
    mangaScrollContainer.style.display = 'flex';
    mangaScrollContainer.innerHTML = currentMangaPages.map((url, i) => `
      <img src="${url}" alt="Page ${i + 1}" loading="lazy">
    `).join('');
  }
}

function setupMangaReaderEvents() {
  mangaPrevPageBtn.addEventListener('click', () => {
    if (currentMangaPageIndex > 0) {
      currentMangaPageIndex--;
      renderMangaPage();
    }
  });

  mangaNextPageBtn.addEventListener('click', () => {
    if (currentMangaPageIndex < currentMangaPages.length - 1) {
      currentMangaPageIndex++;
      renderMangaPage();
    }
  });

  mangaModeToggle.addEventListener('click', () => {
    mangaReaderMode = mangaReaderMode === 'single' ? 'scroll' : 'single';
    mangaModeToggle.innerHTML = mangaReaderMode === 'single'
      ? `<i class="fa-solid fa-scroll"></i> Continu`
      : `<i class="fa-solid fa-file"></i> Page / Page`;
    renderMangaPage();
  });

  closeMangaBtn.addEventListener('click', () => closeModal(mangaModal));
}

// ─── Événements du Lecteur Vidéo & Auto-Fallback ─────────────
function setupPlayerEvents() {
  if (closePlayerBtn) {
    closePlayerBtn.addEventListener('click', () => {
      stopPlayer();
      closeModal(playerModal);
    });
  }

  // Détection du basculement automatique sur 404 dans les iframes
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'EMBED_404') {
      console.warn('[Embed Proxy] Lecteur 404 détecté dans l\'iframe, basculement automatique...');
      const sources = streamSourceSelect?._sources || [];
      const currentIdx = parseInt(streamSourceSelect.value, 10) || 0;
      const nextIdx = currentIdx + 1;
      if (sources[nextIdx]) {
        streamSourceSelect.value = nextIdx;
        playStream(sources[nextIdx].url);
      }
    }
  });
}

// ─── Modal Suggestion ─────────────────────────────────────────
function setupSuggestionEvents() {
  openSugBtn.addEventListener('click', () => openModal(suggestionModal));
  closeSugBtn.addEventListener('click', () => closeModal(suggestionModal));

  sendSugBtn.addEventListener('click', async () => {
    const title = sugTitleInput.value.trim();
    if (!title) return alert('Veuillez entrer un titre.');

    sendSugBtn.disabled = true;
    sugStatusDiv.textContent = "Envoi de la suggestion…";

    try {
      const res = await fetch(`${DC_API}/suggestions?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: sugCatSelect.value,
          title,
          pseudo: sugPseudoInput.value.trim() || 'Visiteur'
        })
      });
      const data = await res.json();
      if (data.success) {
        sugStatusDiv.style.color = '#10b981';
        sugStatusDiv.textContent = '✓ Suggestion envoyée avec succès !';
        setTimeout(() => { closeModal(suggestionModal); sugStatusDiv.textContent = ''; sendSugBtn.disabled = false; }, 1800);
      } else {
        throw new Error(data.error || 'Erreur lors de l\'envoi.');
      }
    } catch (e) {
      sugStatusDiv.style.color = '#ef4444';
      sugStatusDiv.textContent = `Erreur : ${e.message}`;
      sendSugBtn.disabled = false;
    }
  });
}

// ─── Résolution & Lecture Vidéo ───────────────────────────────
async function resolveAndPlay({ id, type, season, episode, isAnime }) {
  stopPlayer();
  cancelAutoplayNext();

  // Enregistrer l'état de lecture actuel pour l'enchaînement automatique d'épisodes
  currentPlayingState = {
    id: id || currentAnime?.id,
    type: type || currentAnime?.type || 'tv',
    season: season || 1,
    episode: episode || 1,
    isAnime: !!isAnime
  };

  playerAnimeTitle.textContent = currentAnime?.title || 'Lecture…';
  const displaySeason = season || 1;
  playerEpTitle.textContent = `S${displaySeason} • Ép. ${episode} (${currentVersion.toUpperCase()}) — Extraction en cours…`;
  
  videoLoader.classList.add('active');
  const loaderText = videoLoader.querySelector('p');
  if (loaderText) loaderText.textContent = "Extraction ultra-rapide de la vidéo depuis l'API DeadCow...";

  videoPlayer.style.display = 'block';
  openModal(playerModal);

  addToWatchHistory({
    id: id || currentAnime?.id,
    title: currentAnime?.title || playerAnimeTitle.textContent,
    type: type || currentAnime?.type || 'anime',
    rating: currentAnime?.rating || 9.0,
    poster: currentAnime?.poster || NO_IMAGE_SVG,
    season,
    episode
  });

  let primaryId = id;
  if (type === 'movie' && currentAnime?.playUrl) {
    primaryId = currentAnime.playUrl;
  }

  // Extraire le slug relatif pour les URLs d'animes (ex: https://anime-sama.to/catalogue/one-piece/ -> one-piece)
  let cleanSlug = primaryId;
  if (typeof cleanSlug === 'string' && cleanSlug.includes('http')) {
    cleanSlug = cleanSlug.replace(/^https?:\/\/[^\/]+\/catalogue\//, '').replace(/^https?:\/\/[^\/]+\//, '').replace(/\/+$/, '').trim();
  }

  const attemptFetch = async (targetId, v, s, tType = type, timeoutMs = 20000) => {
    if (!targetId) throw new Error('ID cible invalide.');
    const params = { id: targetId, type: tType, episode, version: v };
    if (s !== undefined && s !== null) params.season = s;
    const res = await dcFetch('/resolve', params, { retries: 2, timeout: timeoutMs });

    // Si embedUrl contient un fichier vidéo MP4/HLS direct (ex: citron-edge, mp4, m3u8), FORCER streamUrl vers embedUrl pour le Lecteur Principal
    if (res && res.embedUrl && (res.embedUrl.endsWith('.mp4') || res.embedUrl.endsWith('.m3u8') || res.embedUrl.includes('citron-edge') || res.embedUrl.includes('.mp4?'))) {
      res.streamUrl = res.embedUrl;
    }

    const stream = res?.streamUrl || res?.embedUrl || '';
    if (!res || !res.success || !stream || stream.includes('vidsrc.to/embed/movie/https:')) {
      throw new Error(res?.error || 'Flux indisponible pour ces paramètres.');
    }
    return res;
  };

  try {
    let data = null;

    // Résolution séquentielle propre et ciblée (évite les 408 Request Timeout par saturation de requêtes)
    const titleClean = (currentAnime?.title || primaryId || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const slugFromTitle = titleClean.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const numericSeason = parseInt(season, 10) || 1;
    const candidateConfigs = [];

    if (/^\d+$/.test(String(cleanSlug))) {
      candidateConfigs.push({ id: cleanSlug, version: currentVersion, season: numericSeason, tType: type });
    } else {
      candidateConfigs.push({ id: cleanSlug, version: currentVersion, season: numericSeason, tType: type });
      candidateConfigs.push({ id: cleanSlug, version: currentVersion, season: undefined, tType: type });
    }

    if (titleClean.includes('foot 2 rue') || cleanSlug.includes('foot-2-rue')) {
      candidateConfigs.push({ id: '65141', version: currentVersion, season: numericSeason, tType: 'tv' });
      candidateConfigs.push({ id: '294129', version: currentVersion, season: numericSeason, tType: 'tv' });
    }

    if (slugFromTitle && slugFromTitle !== cleanSlug) {
      candidateConfigs.push({ id: slugFromTitle, version: currentVersion, season: numericSeason, tType: type });
    }

    for (const cfg of candidateConfigs) {
      if (!cfg.id) continue;
      try {
        const res = await attemptFetch(cfg.id, cfg.version, cfg.season, cfg.tType || type, 4000);
        if (res && res.success && (res.streamUrl || res.embedUrl)) {
          data = res;
          break; // Succès ! Arrêt immédiat
        }
      } catch (eSeq) {}
    }

    // Fast-path 2 : Recherche de secours via Titre TMDB si nécessaire
    if ((!data || !data.success || (!data.streamUrl && !data.embedUrl)) && (currentAnime?.title || typeof primaryId === 'string')) {
      let rawTitle = currentAnime?.title || cleanSlug;
      if (typeof rawTitle === 'string') {
        rawTitle = rawTitle.replace(/^.*\/film\//, '').replace(/%20/g, ' ').replace(/\s*\(\d{4}\)/, '').trim();
      }
      if (rawTitle && rawTitle.length > 2) {
        try {
          if (loaderText) loaderText.textContent = `Recherche HD TMDB pour "${rawTitle}"...`;
          const sRes = await dcFetch('/search', { q: rawTitle, type: type === 'movie' ? 'movie' : 'all' });
          const tmdbMatch = sRes?.results?.find(r => r.id && /^\d+$/.test(String(r.id)));
          if (tmdbMatch && tmdbMatch.id) {
            console.log(`[Smart Resolve] Basculement vers TMDB ID ${tmdbMatch.id} pour "${rawTitle}"`);
            const tmdbData = await Promise.any([
              attemptFetch(tmdbMatch.id, currentVersion, numericSeason, type, 6000),
              attemptFetch(tmdbMatch.id, currentVersion === 'vf' ? 'vostfr' : 'vf', numericSeason, type, 6000),
              attemptFetch(tmdbMatch.id, currentVersion, undefined, type, 6000)
            ]);
            if (tmdbData && tmdbData.success && (tmdbData.streamUrl || tmdbData.embedUrl)) {
              data = tmdbData;
            }
          }
        } catch (eTmdb) {}
      }
    }

    // Fallback Universel VidSrc HD Garanti si tout le reste échoue
    if (!data || !data.success || (!data.streamUrl && !data.embedUrl)) {
      if (primaryId || cleanSlug) {
        const targetId = cleanSlug || primaryId;
        const fallEmbed = (type === 'tv' || type === 'anime')
          ? `https://vidsrc.me/embed/tv?tmdb=${targetId}&season=${numericSeason}&episode=${episode || 1}`
          : `https://vidsrc.me/embed/movie?tmdb=${targetId}`;

        data = {
          success: true,
          title: `Épisode ${episode || 1}`,
          embedUrl: fallEmbed,
          embeds: { vf: fallEmbed, vostfr: fallEmbed }
        };
      } else {
        throw new Error('Résolution temporairement indisponible pour cet épisode.');
      }
    }

    // Détecter si c'est un film non encore sorti au cinéma (ex: Spider-Man Brand New Day 2026)
    const isUnreleasedMovie = type === 'movie' && (!data.streamUrl || data.streamUrl === null) && (!data.embeds || (!data.embeds.vf && !data.embeds.vostfr)) && (parseInt(currentAnime?.year, 10) >= 2026 || (currentAnime?.title || '').includes('2026') || (data.embedUrl || '').includes('vidsrc.to/embed/movie/'));

    if (isUnreleasedMovie) {
      videoLoader.classList.remove('active');
      videoPlayer.style.display = 'none';
      const iframe = $('premium-iframe-player');
      if (iframe) { iframe.style.display = 'none'; iframe.src = 'about:blank'; }

      playerEpTitle.innerHTML = `<span style="color:var(--accent-cyan)">🎬 Film en Production (Sortie prévue en ${currentAnime?.year || '2026'})</span>`;
      
      const wrapper = $('video-container-wrapper');
      if (wrapper) {
        let unreleasedBox = $('unreleased-movie-box');
        if (!unreleasedBox) {
          unreleasedBox = document.createElement('div');
          unreleasedBox.id = 'unreleased-movie-box';
          wrapper.appendChild(unreleasedBox);
        }
        unreleasedBox.innerHTML = `
          <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(8,9,13,0.95);backdrop-filter:blur(8px);z-index:20;padding:30px;text-align:center;animation:fadeIn 0.3s ease-out">
            <div style="font-size:3.2rem;color:var(--accent-purple);margin-bottom:12px"><i class="fa-solid fa-film"></i></div>
            <h3 style="color:#fff;font-size:1.4rem;margin-bottom:8px">🎬 "${currentAnime?.title || 'Film'}" non encore sorti</h3>
            <p style="color:var(--text-muted);max-width:520px;margin:0 auto 22px;line-height:1.6;font-size:0.9rem">
              Ce film est actuellement <strong>en production pour une sortie au cinéma en ${currentAnime?.year || '2026'}</strong>. Aucun flux de streaming n'existe encore. Les lecteurs HD seront ajoutés automatiquement dès sa sortie officielle !
            </p>
            <a href="https://www.youtube.com/results?search_query=${encodeURIComponent((currentAnime?.title || 'Spider-Man Brand New Day') + ' Trailer Bande Annonce FR')}" target="_blank" class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none">
              <i class="fa-solid fa-play"></i> Regarder la Bande-Annonce Officielle sur YouTube
            </a>
          </div>
        `;
      }
      return;
    } else {
      const oldBox = $('unreleased-movie-box');
      if (oldBox) oldBox.remove();
    }

    if (data.version) {
      currentVersion = data.version.toLowerCase();
      document.querySelectorAll('.version-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.version === currentVersion);
      });
    }

    playerEpTitle.textContent = data.title || `S${displaySeason} • Ép. ${episode} (${currentVersion.toUpperCase()})`;
    buildSourceSelector(data);
    playStream(data.streamUrl || data.embedUrl);

  } catch (err) {
    videoLoader.classList.remove('active');
    const isTimeout = err.status === 408 || (err.message && err.message.includes('408'));
    const isBadGateway = err.status === 502 || (err.message && err.message.includes('502'));
    const isRateLimit = err.status === 429 || (err.message && err.message.includes('429'));
    const isNoSource = err.message && (err.message.includes('Aucune source') || err.message.includes('FStream'));
    const isUrl = typeof id === 'string' && id.startsWith('http');
    
    let errorDetail = err.message;
    if (isTimeout) errorDetail = "Délai d'attente dépassé (408). Le serveur DeadCow prend plus de 20s à répondre.";
    if (isBadGateway) errorDetail = "Surcharge temporaire du serveur DeadCow (502 Bad Gateway).";
    if (isRateLimit) errorDetail = "Quota de requêtes API DeadCow atteint (429). Patientez 10s avant de réessayez.";
    if (isNoSource) errorDetail = "Aucun lecteur trouvé pour cet épisode dans cette version.";

    let htmlMsg = `<span style="color:#ef4444">⚠ ${errorDetail}</span> `;
    htmlMsg += `<button onclick="resolveAndPlay({id:'${id}',type:'${type}',season:'${season}',episode:${episode},isAnime:${isAnime}})" class="btn btn-secondary btn-sm" style="margin-left:10px"><i class="fa-solid fa-rotate-right"></i> Réessayer</button>`;
    
    if (isUrl) {
      htmlMsg += ` <a href="${id}" target="_blank" class="btn btn-secondary btn-sm" style="margin-left:5px;text-decoration:none"><i class="fa-solid fa-arrow-up-right-from-square"></i> Voir sur la source originale</a>`;
    }
    
    playerEpTitle.innerHTML = htmlMsg;
  }
}

// ─── Menu des Sources Lecteurs (Lecteur Original JapoPlay) ───────
function buildSourceSelector(data) {
  if (!streamSourceSelect) return;
  streamSourceSelect.innerHTML = '';
  const sources = [];

  const tmdbId = currentAnime?.id || currentAnime?.tmdbId || data.id || data.tmdbId;
  const numericTmdb = (tmdbId && /^\d+$/.test(String(tmdbId).trim())) ? String(tmdbId).trim() : null;

  const cleanUrl = (u) => {
    if (!u || typeof u !== 'string') return null;
    let clean = u.trim();
    if (clean.includes('vidsrc') && (clean.includes('/http') || clean.includes('/https'))) {
      if (numericTmdb) {
        return currentAnime?.type === 'movie' ? `https://vidsrc.me/embed/movie?tmdb=${numericTmdb}` : `https://vidsrc.me/embed/tv?tmdb=${numericTmdb}&season=1&episode=1`;
      }
    }
    return clean;
  };

  // 1. Si embedUrl contient un fichier MP4/HLS direct
  if (data.embedUrl && (data.embedUrl.endsWith('.mp4') || data.embedUrl.endsWith('.m3u8') || data.embedUrl.includes('citron-edge') || data.embedUrl.includes('.mp4?'))) {
    const cleanEmbed = cleanUrl(data.embedUrl);
    if (cleanEmbed && !sources.some(s => s.url === cleanEmbed)) {
      sources.push({ name: '🟢 Lecteur Direct 1080p JapoPlay (Recommandé)', url: cleanEmbed });
    }
  }

  // 2. Flux direct JapoPlay (HLS / MP4)
  if (data.streamUrl) {
    const cleanStream = cleanUrl(data.streamUrl);
    if (cleanStream && !sources.some(s => s.url === cleanStream)) {
      sources.push({ name: '⚡ Lecteur Direct HD JapoPlay', url: cleanStream });
    }
  }

  // 3. Embed Principal
  if (data.embedUrl) {
    const cleanEmbed = cleanUrl(data.embedUrl);
    if (cleanEmbed && !sources.some(s => s.url === cleanEmbed)) {
      sources.push({ name: '🎬 Lecteur Embed Principal', url: cleanEmbed });
    }
  }

  // 3. Ajouter les miroirs d'embeds secondaires (Sibnet, Vidmoly, Franime, VidSrc, etc.)
  if (data.embeds) {
    Object.entries(data.embeds).forEach(([key, url]) => {
      const targetUrl = cleanUrl(url);
      if (targetUrl) {
        let label = `🎬 Lecteur ${key.toUpperCase()}`;
        if (targetUrl.includes('sibnet')) label = '⚡ Lecteur Sibnet (Ultra Rapide)';
        else if (targetUrl.includes('vidmoly')) label = '🎬 Lecteur Vidmoly (HD)';
        else if (targetUrl.includes('vidoza')) label = '▶ Lecteur Vidoza (HD)';
        else if (targetUrl.includes('vidsrc')) label = '🎬 Lecteur Film & Séries HD (VidSrc)';
        else if (targetUrl.includes('franime')) label = '🟢 Lecteur Direct Franime HD';
        if (!sources.some(s => s.url === targetUrl)) {
          sources.push({ name: label, url: targetUrl });
        }
      }
    });
  }

  const curEp = data?.episode || currentAnime?.episode || 1;
  const curSeason = data?.season || currentAnime?.season || 1;

  // 5. Sources alternatives universelles TMDB (VidSrc.me, VidSrc.cc, VidSrc.pro)
  if (numericTmdb) {
    const vidsrcUrl = currentAnime?.type === 'movie'
      ? `https://vidsrc.me/embed/movie?tmdb=${numericTmdb}`
      : `https://vidsrc.me/embed/tv?tmdb=${numericTmdb}&season=${curSeason}&episode=${curEp}`;
    if (!sources.some(s => s.url === vidsrcUrl)) {
      sources.push({ name: '🎬 Lecteur Secours HD (VidSrc)', url: vidsrcUrl });
    }

    const vidsrcCcUrl = currentAnime?.type === 'movie'
      ? `https://vidsrc.cc/v2/embed/movie/${numericTmdb}`
      : `https://vidsrc.cc/v2/embed/tv/${numericTmdb}/${curSeason}/${curEp}`;
    if (!sources.some(s => s.url === vidsrcCcUrl)) {
      sources.push({ name: '⚡ Lecteur Miroir 3 (SuperEmbed 1080p)', url: vidsrcCcUrl });
    }

    const vidsrcProUrl = currentAnime?.type === 'movie'
      ? `https://vidsrc.pro/embed/movie/${numericTmdb}`
      : `https://vidsrc.pro/embed/tv/${numericTmdb}/${curSeason}/${curEp}`;
    if (!sources.some(s => s.url === vidsrcProUrl)) {
      sources.push({ name: '▶ Lecteur Miroir 4 (VidSrc Pro HD)', url: vidsrcProUrl });
    }
  }

  sources.forEach((src, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = src.name;
    streamSourceSelect.appendChild(opt);
  });

  streamSourceSelect._sources = sources;
  streamSourceSelect.onchange = () => {
    const selected = sources[streamSourceSelect.value];
    if (selected) playStream(selected.url);
  };
}

function isRealEmbedUrl(url) {
  if (!url || typeof url !== 'string') return false;

  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.mp4') || clean.endsWith('.m3u8') || clean.endsWith('.ts')) return false;
  if (url.includes('/api/media-proxy') || url.includes('/api/hls-proxy')) return false;

  // Si c'est une URL Web HTTP/HTTPS sans extension vidéo brute direct, c'est un embed HTML !
  if (url.startsWith('http://') || url.startsWith('https://')) return true;
  return false;
}

// ─── Lancement du Stream (HLS / MP4 / Iframe) ─────────────────
let hlsInstance = null;

async function playStream(url) {
  const video = videoPlayer;
  const iframe = $('premium-iframe-player');

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  if (typeof url === 'string' && url.startsWith('http://')) {
    url = url.replace(/^http:\/\//i, 'https://');
  }

  if (!window._triedSources) window._triedSources = new Set();
  window._triedSources.add(url);

  let targetUrl = url;
  if (typeof targetUrl === 'string' && targetUrl.startsWith('http://')) {
    targetUrl = targetUrl.replace(/^http:\/\//i, 'https://');
  }
  const isEmbed = isRealEmbedUrl(url);

  // Essayer de résoudre automatiquement les URLs Embed vers le Lecteur HTML5 Principal
  if (isEmbed && !url.startsWith('/api/') && !window._resolvedUrls?.has(url)) {
    if (!window._resolvedUrls) window._resolvedUrls = new Map();
    try {
      if (videoLoader) {
        videoLoader.classList.add('active');
        const loaderText = videoLoader.querySelector('p');
        if (loaderText) loaderText.textContent = "Chargement du flux direct dans le Lecteur Principal...";
      }
      const res = await fetch(`/api/resolve-embed?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.videoUrl) {
          console.log(`[Embed Resolver] Flux extrait vers le Lecteur Principal : ${data.videoUrl}`);
          window._resolvedUrls.set(url, data.videoUrl);
          targetUrl = data.videoUrl;
        }
      }
    } catch(e) {}
  } else if (window._resolvedUrls?.has(url)) {
    targetUrl = window._resolvedUrls.get(url);
  }

  const finalIsEmbed = isRealEmbedUrl(targetUrl);

  if (finalIsEmbed) {
    video.pause();
    video.style.display = 'none';
    if (iframe) {
      iframe.style.display = 'block';

      let embedSrc = targetUrl;
      // Ne passer par embed-proxy QUE pour les URLs spécifiques nécessitant un proxying lourd
      const requiresProxy = targetUrl.startsWith('http') && !targetUrl.includes('vidsrc') && !targetUrl.includes('smashystream') && !targetUrl.includes('superembed') && !targetUrl.includes('2embed') && !targetUrl.includes('vidmoly') && !targetUrl.includes('sibnet');

      if (requiresProxy) {
        embedSrc = `/api/embed-proxy?url=${encodeURIComponent(targetUrl)}`;
      }

      iframe.src = embedSrc;
    }
    videoLoader.classList.remove('active');
    return;
  }

  // ── Mode Lecteur Vidéo HTML5 Direct (MP4 / HLS) ─────────────
  if (iframe) {
    iframe.style.display = 'none';
    iframe.src = 'about:blank';
  }
  video.style.display = 'block';

  const isHlsManifest = targetUrl.includes('.m3u8') || targetUrl.includes('hls-proxy') || targetUrl.includes('hls');
  url = targetUrl;

  if (window.Hls && Hls.isSupported() && isHlsManifest) {
    let streamUrl = url;
    if (!url.startsWith('/api/proxy') && !url.startsWith(window.location.origin + '/api/proxy')) {
      let normTarget = url;
      if (normTarget.includes('/api/hls-proxy') || normTarget.includes('/api/media-proxy')) {
        normTarget = normTarget.replace(/^https?:\/\/[^\/]+/, 'https://deadcow-streaming.lol');
        if (normTarget.startsWith('/')) normTarget = `https://deadcow-streaming.lol${normTarget}`;
      } else if (normTarget.startsWith('/')) {
        normTarget = `https://deadcow-streaming.lol${normTarget}`;
      }
      streamUrl = `/api/proxy?url=${encodeURIComponent(normTarget)}&referer=${encodeURIComponent('https://deadcow-streaming.lol/')}`;
    }

    hlsInstance = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
      xhrSetup: function(xhr, xhrUrl) {
        let realTarget = xhrUrl;
        if (realTarget.includes('/api/proxy?')) {
          return;
        }

        if (realTarget.includes('/api/hls-proxy') || realTarget.includes('/api/media-proxy')) {
          realTarget = realTarget.replace(/^https?:\/\/[^\/]+/, 'https://deadcow-streaming.lol');
          if (realTarget.startsWith('/')) realTarget = `https://deadcow-streaming.lol${realTarget}`;
        } else if (realTarget.startsWith('/')) {
          realTarget = `https://deadcow-streaming.lol${realTarget}`;
        } else if (!realTarget.startsWith('http://') && !realTarget.startsWith('https://')) {
          realTarget = `https://deadcow-streaming.lol/${realTarget}`;
        }

        const proxied = `/api/proxy?url=${encodeURIComponent(realTarget)}&referer=${encodeURIComponent('https://deadcow-streaming.lol/')}`;
        xhr.open('GET', proxied, true);
      }
    });

    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      videoLoader.classList.remove('active');
      video.play().catch(() => {});
    });
    let hlsNetworkRetryCount = 0;
    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (hlsNetworkRetryCount < 3) {
              hlsNetworkRetryCount++;
              console.warn(`[HLS] Erreur réseau (tentative ${hlsNetworkRetryCount}/3), reconnexion...`);
              setTimeout(() => { if (hlsInstance) hlsInstance.startLoad(); }, 800);
              return;
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.warn('[HLS] Erreur média, ré-initialisation du décodeur...');
            hlsInstance.recoverMediaError();
            return;
          default:
            break;
        }

        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        console.warn('[HLS] Erreur flux HLS fatale, basculement vers le miroir Embed...');
        const sources = streamSourceSelect?._sources || [];
        const fallback = sources.find(s => s.url !== url && isRealEmbedUrl(s.url));
        if (fallback) {
          const idx = sources.findIndex(s => s.url === fallback.url);
          if (idx !== -1 && streamSourceSelect) streamSourceSelect.value = idx;
          console.warn(`[HLS] Basculement automatique vers : ${fallback.name}`);
          playStream(fallback.url);
        } else {
          videoLoader.classList.remove('active');
        }
        return;
      }
    });

  } else {
    // Fichier MP4 Direct (ex: citron-edge, DeadCow media-proxy)
    let directUrl = url;
    if (!url.startsWith('/api/proxy') && !url.startsWith(window.location.origin + '/api/proxy')) {
      const targetUrl = url.startsWith('/') ? `https://deadcow-streaming.lol${url}` : url;
      directUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}&referer=${encodeURIComponent('https://deadcow-streaming.lol/')}`;
    }
    video.src = directUrl;
    video.load();

    video.addEventListener('canplay', () => {
      videoLoader.classList.remove('active');
      video.play().catch(() => {});
    }, { once: true });

    video.addEventListener('error', () => {
      if (!video.src) return;
      videoLoader.classList.remove('active');
      console.warn('[Video HTML5] Erreur de lecture vidéo.');

      const sources = streamSourceSelect?._sources || [];
      const fallback = sources.find(s => !window._triedSources?.has(s.url));
      if (fallback) {
        console.warn(`[Video HTML5] Basculement automatique vers : ${fallback.name}`);
        const idx = sources.findIndex(s => s.url === fallback.url);
        if (idx !== -1 && streamSourceSelect) streamSourceSelect.value = idx;
        playStream(fallback.url);
      } else {
        playerEpTitle.innerHTML = `<span style="color:#ef4444">⚠ Erreur de lecture vidéo HTML5 (Flux indisponible).</span> <button onclick="resolveAndPlay({id:'${currentAnime?.id || ''}',type:'movie',episode:1})" class="btn btn-secondary btn-sm" style="margin-left:10px"><i class="fa-solid fa-rotate-right"></i> Réessayer</button>`;
      }
    }, { once: true });
  }
}

// ─── Événements du Lecteur (VF/VOSTFR, Modal) ────────────────
function setupPlayerEvents() {
  document.querySelectorAll('.version-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.version-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentVersion = btn.dataset.version;
    });
  });

  closeModalBtn.addEventListener('click', () => closeModal(detailsModal));
  closePlayerBtn.addEventListener('click', () => {
    stopPlayer();
    closeModal(playerModal);
  });

  window.addEventListener('click', e => {
    if (e.target === detailsModal) closeModal(detailsModal);
    if (e.target === playerModal)  {
      stopPlayer();
      closeModal(playerModal);
    }
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      stopPlayer();
      closeModal(playerModal);
      closeModal(detailsModal);
      closeModal(mangaModal);
      closeModal(suggestionModal);
    }
  });
}

// ─── Gestion de la Lecture Auto / Épisode Suivant ────────────
let currentPlayingState = { id: null, type: null, season: 1, episode: 1, isAnime: false };
let autoplayInterval = null;

function setupAutoplayNext() {
  const toggle = $('autoplay-next-toggle');
  if (toggle) {
    const saved = localStorage.getItem('astream_autoplay_next');
    if (saved !== null) {
      toggle.checked = saved === 'true';
    }
    toggle.onchange = () => {
      localStorage.setItem('astream_autoplay_next', toggle.checked);
    };
  }

  const cancelBtn = $('autoplay-cancel-btn');
  const nowBtn = $('autoplay-now-btn');
  if (cancelBtn) cancelBtn.onclick = cancelAutoplayNext;
  if (nowBtn) nowBtn.onclick = triggerNextEpisodeImmediately;

  if (videoPlayer) {
    videoPlayer.addEventListener('ended', handleVideoEnded);
  }
}

function handleVideoEnded() {
  const toggle = $('autoplay-next-toggle');
  if (toggle && !toggle.checked) return;

  if (!currentPlayingState || !currentPlayingState.episode) return;

  const nextEp = (parseInt(currentPlayingState.episode, 10) || 1) + 1;
  startAutoplayCountdown(nextEp);
}

function startAutoplayCountdown(nextEp) {
  cancelAutoplayNext();

  const overlay = $('autoplay-countdown-overlay');
  const nextTitle = $('autoplay-next-title');
  const secEl = $('autoplay-seconds');
  const fill = $('autoplay-progress-fill');

  if (!overlay) return;

  const displaySeason = currentPlayingState.season || 1;
  if (nextTitle) nextTitle.textContent = `${currentAnime?.title || 'Série'} — S${displaySeason} Ép. ${nextEp}`;

  overlay.style.display = 'flex';

  let remaining = 5;
  if (secEl) secEl.textContent = remaining;
  if (fill) fill.style.width = '100%';

  autoplayInterval = setInterval(() => {
    remaining--;
    if (secEl) secEl.textContent = remaining;
    if (fill) fill.style.width = `${(remaining / 5) * 100}%`;

    if (remaining <= 0) {
      triggerNextEpisodeImmediately();
    }
  }, 1000);
}

function cancelAutoplayNext() {
  if (autoplayInterval) {
    clearInterval(autoplayInterval);
    autoplayInterval = null;
  }
  const overlay = $('autoplay-countdown-overlay');
  if (overlay) overlay.style.display = 'none';
}

function triggerNextEpisodeImmediately() {
  cancelAutoplayNext();
  if (!currentPlayingState || !currentPlayingState.episode) return;

  const nextEp = (parseInt(currentPlayingState.episode, 10) || 1) + 1;
  resolveAndPlay({
    id: currentPlayingState.id || currentAnime?.id,
    type: currentPlayingState.type || currentAnime?.type || 'tv',
    season: currentPlayingState.season,
    episode: nextEp,
    isAnime: currentPlayingState.isAnime
  });
}

function stopPlayer() {
  cancelAutoplayNext();
  const oldBox = $('unreleased-movie-box');
  if (oldBox) oldBox.remove();
  window._triedSources = new Set();
  window._triedAltLang = false;
  if (hlsInstance) {
    try { hlsInstance.destroy(); } catch (e) {}
    hlsInstance = null;
  }
  if (videoPlayer) {
    try {
      videoPlayer.pause();
      videoPlayer.removeAttribute('src');
      videoPlayer.load();
    } catch (e) {}
  }
  const iframe = $('premium-iframe-player');
  if (iframe) {
    iframe.src = 'about:blank';
    iframe.style.display = 'none';
  }
}

function openModal(modal) {
  if (modal) {
    modal.classList.add('show');
    modal.classList.add('active');
  }
}
function closeModal(modal) {
  if (modal) {
    modal.classList.remove('show');
    modal.classList.remove('active');
  }
}

// ─── Gestion du Système de Comptes & Authentification ──────────
function setupAuthEvents() {
  const authModal         = $('auth-modal');
  const openAuthBtn       = $('open-auth-modal-btn');
  const closeAuthBtn      = $('close-auth-btn');
  const tabLogin          = $('auth-tab-login');
  const tabRegister       = $('auth-tab-register');
  const loginForm         = $('auth-login-form');
  const regForm           = $('auth-register-form');
  const loginStatus       = $('login-status');
  const regStatus         = $('reg-status');
  const adminNavBtn       = $('admin-nav-btn');

  // Mettre à jour l'affichage de l'utilisateur (Masquer/Afficher le bouton Admin)
  window.updateUserUI = () => {
    const userStr = localStorage.getItem('astream_user');
    if (!userStr) {
      if (openAuthBtn) openAuthBtn.innerHTML = `<i class="fa-solid fa-user-circle"></i> Connexion`;
      if (adminNavBtn) adminNavBtn.style.display = 'none';
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (openAuthBtn) openAuthBtn.innerHTML = `<i class="fa-solid fa-user-check"></i> ${user.username}`;

      // SEUL L'ADMINISTRATEUR (role: 'admin') VOIT ET ACCÈDE AU BOUTON ADMIN PANEL !
      if (user.role === 'admin') {
        if (adminNavBtn) adminNavBtn.style.display = 'inline-flex';
      } else {
        if (adminNavBtn) adminNavBtn.style.display = 'none';
      }
    } catch (e) {
      if (adminNavBtn) adminNavBtn.style.display = 'none';
    }
  };

  if (openAuthBtn) {
    openAuthBtn.addEventListener('click', () => {
      const userStr = localStorage.getItem('astream_user');
      if (userStr) {
        if (confirm('Voulez-vous vous déconnecter de votre compte astream ?')) {
          localStorage.removeItem('astream_user');
          localStorage.removeItem('astream_token');
          localStorage.removeItem('astream_admin_pass');
          updateUserUI();
          showTab('catalog', 'all');
        }
      } else {
        openModal(authModal);
      }
    });
  }

  if (closeAuthBtn) closeAuthBtn.addEventListener('click', () => closeModal(authModal));

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.style.display = 'block';
      regForm.style.display = 'none';
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      loginForm.style.display = 'none';
      regForm.style.display = 'block';
    });
  }

  // Soumission Connexion (Login)
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = $('login-username').value.trim();
      const password = $('login-password').value.trim();

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
          localStorage.setItem('astream_user', JSON.stringify(data.user));
          localStorage.setItem('astream_token', data.token);
          if (data.user.role === 'admin') {
            localStorage.setItem('astream_admin_pass', password);
          }
          loginStatus.style.color = '#10b981';
          loginStatus.textContent = `✓ Bienvenue ${data.user.username} !`;
          updateUserUI();
          setTimeout(() => closeModal(authModal), 1200);
        } else {
          loginStatus.style.color = '#ef4444';
          loginStatus.textContent = data.error || 'Erreur de connexion.';
        }
      } catch (err) {
        loginStatus.style.color = '#ef4444';
        loginStatus.textContent = `Erreur serveur : ${err.message}`;
      }
    });
  }

  // Soumission Inscription (Register)
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = $('reg-username').value.trim();
      const email    = $('reg-email').value.trim();
      const password = $('reg-password').value.trim();

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();

        if (data.success) {
          localStorage.setItem('astream_user', JSON.stringify(data.user));
          localStorage.setItem('astream_token', data.token);
          regStatus.style.color = '#10b981';
          regStatus.textContent = `✓ Compte créé avec succès ! Bienvenue ${data.user.username}.`;
          updateUserUI();
          setTimeout(() => closeModal(authModal), 1200);
        } else {
          regStatus.style.color = '#ef4444';
          regStatus.textContent = data.error || 'Erreur d\'inscription.';
        }
      } catch (err) {
        regStatus.style.color = '#ef4444';
        regStatus.textContent = `Erreur serveur : ${err.message}`;
      }
    });
  }

  updateUserUI();
}

// ─── Panneau d'Administration Dashboard (Admin Panel) ─────────
function setupConsole() {
  const importBtn          = $('import-btn');
  const importInput        = $('json-import-input');
  const importStat         = $('import-status');
  const testBtn            = $('test-proxy-btn');
  const testUrl            = $('test-proxy-url');
  const testRef            = $('test-proxy-referer');
  const toggleMaintBtn     = $('toggle-maintenance-btn');
  const disableMaintOverlayBtn = $('disable-maintenance-overlay-btn');
  const maintStatus        = $('maintenance-toggle-status');
  const exportBtn          = $('export-catalog-btn');
  const addItemBtn         = $('add-item-btn');
  const logoutBtn          = $('admin-logout-btn');

  // Authentification & Mot de passe Admin
  const getAdminPassword = () => {
    let pass = localStorage.getItem('astream_admin_pass');
    if (!pass) {
      pass = prompt('🔐 Entrez le mot de passe Administrateur astream :');
      if (pass) localStorage.setItem('astream_admin_pass', pass);
    }
    return pass;
  };

  // 1. Déconnexion Admin
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('astream_admin_pass');
      alert('🔒 Déconnecté du Panneau d\'Administration.');
      showTab('catalog', 'all');
    });
  }

  // 2. Basculement Mode Maintenance (Protégé)
  const toggleMaintenance = async (forceDisable = false) => {
    let password = getAdminPassword();
    if (!password) return alert('Action annulée. Mot de passe administrateur requis.');

    try {
      const payload = { password };
      if (forceDisable) payload.enabled = false;
      const maintMsgInput = $('admin-maint-msg-input');
      if (maintMsgInput && maintMsgInput.value.trim()) {
        payload.message = maintMsgInput.value.trim();
      }

      const res = await fetch('/api/maintenance/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        localStorage.removeItem('astream_admin_pass');
        alert(`❌ Accès refusé : ${data.error || 'Mot de passe incorrect'}`);
        return;
      }

      const maintOverlay = $('maintenance-overlay');
      if (maintOverlay) {
        if (data.maintenance) maintOverlay.classList.add('active');
        else maintOverlay.classList.remove('active');
      }

      if (maintStatus) {
        maintStatus.style.color = data.maintenance ? '#f59e0b' : '#10b981';
        maintStatus.textContent = data.maintenance ? '🟡 Mode Maintenance ACTIVÉ' : '🟢 Mode Normal (En ligne)';
      }
    } catch (e) {
      alert(`Erreur : ${e.message}`);
    }
  };

  if (toggleMaintBtn) toggleMaintBtn.addEventListener('click', () => toggleMaintenance(false));
  if (disableMaintOverlayBtn) disableMaintOverlayBtn.addEventListener('click', () => toggleMaintenance(true));

  // 3. Ajouter un Titre au Catalogue Live
  if (addItemBtn) {
    addItemBtn.addEventListener('click', () => {
      const title  = $('add-item-title')?.value.trim();
      const type   = $('add-item-type')?.value || 'anime';
      const rating = parseFloat($('add-item-rating')?.value || '9.0');
      const poster = $('add-item-poster')?.value.trim() || NO_IMAGE_SVG;
      const stream = $('add-item-stream')?.value.trim();
      const statusSpan = $('add-item-status');

      if (!title) return alert('Veuillez entrer au moins un titre.');

      const newItem = {
        id: stream || `custom_${Date.now()}`,
        title,
        type,
        rating,
        poster,
        streamUrl: stream,
        embedUrl: stream,
        genres: [{ name: 'Ajout Admin' }]
      };

      const gridId = type === 'live' ? 'grid-live-channels' : `grid-${type}`;
      const grid = $(gridId) || $('grid-anime');
      if (grid) {
        renderCards(grid, [newItem]);
        if (statusSpan) {
          statusSpan.style.color = '#10b981';
          statusSpan.textContent = `✓ "${title}" ajouté avec succès au catalogue !`;
        }
      }
    });
  }

  // 4. Exporter le Catalogue JSON en Téléchargement Fichier
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const catalogData = window._currentCatalogData || [];
      const jsonStr = JSON.stringify(catalogData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `astream_catalog_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // 5. Importer du JSON Manuel
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      try {
        const data = JSON.parse(importInput.value.trim());
        if (!Array.isArray(data)) throw new Error('Le JSON doit être un tableau.');
        const grid = $('grid-anime');
        grid.innerHTML = '';
        renderCards(grid, data);
        importStat.style.color = '#10b981';
        importStat.textContent = `✓ ${data.length} éléments importés !`;
      } catch (e) {
        importStat.style.color = '#ef4444';
        importStat.textContent = `Erreur : ${e.message}`;
      }
    });
  }

  // 6. Testeur de Flux Vidéo
  if (testBtn) {
    testBtn.addEventListener('click', () => {
      const url = testUrl.value.trim();
      if (!url) return alert('Entrez une URL.');
      stopPlayer();
      playerAnimeTitle.textContent = 'Test Proxy Admin';
      playerEpTitle.textContent    = url;
      videoLoader.classList.add('active');
      openModal(playerModal);
      let pUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      if (testRef.value.trim()) pUrl += `&referer=${encodeURIComponent(testRef.value.trim())}`;
      buildSourceSelector({ streamUrl: pUrl, embeds: {} });
      playStream(pUrl);
    });
  }

  // 7. Rendu des Suggestions Utilisateurs dans le Dashboard
  window.renderAdminSuggestions = () => {
    const listContainer = $('admin-suggestions-list');
    if (!listContainer) return;
    const sugs = JSON.parse(localStorage.getItem('astream_suggestions') || '[]');
    if (sugs.length === 0) {
      listContainer.innerHTML = `<p style="font-size:0.85rem;color:var(--text-muted)">Aucune nouvelle suggestion reçue.</p>`;
      return;
    }

    listContainer.innerHTML = sugs.map(s => `
      <div class="sug-list-item">
        <div>
          <strong style="color:#fff">${s.title}</strong>
          <span style="font-size:0.75rem;color:var(--accent-cyan);margin-left:8px">[${s.category.toUpperCase()}]</span>
          <div style="font-size:0.75rem;color:var(--text-muted)">Par ${s.pseudo} à ${s.date}</div>
        </div>
        <button onclick="approveSuggestion(${s.id}, '${s.title.replace(/'/g, "\\'")}', '${s.category}')" class="btn btn-primary btn-sm" style="padding:4px 10px;font-size:0.75rem">
          <i class="fa-solid fa-plus"></i> Ajouter
        </button>
      </div>
    `).join('');
  };

  window.approveSuggestion = (id, title, category) => {
    const titleInput = $('add-item-title');
    const typeInput  = $('add-item-type');
    if (titleInput) titleInput.value = title;
    if (typeInput)  typeInput.value  = category === 'film' ? 'movie' : (category === 'serie' ? 'tv' : category);

    const sugs = JSON.parse(localStorage.getItem('astream_suggestions') || '[]');
    const filtered = sugs.filter(s => s.id !== id);
    localStorage.setItem('astream_suggestions', JSON.stringify(filtered));
    renderAdminSuggestions();
    alert(`💡 Titre "${title}" prérempli dans le formulaire d'ajout !`);
  };

  renderAdminSuggestions();
}

// ════════════════════════════════════════════════════════════════
//   WATCH PARTY TEMPS-RÉEL (SYNCHRONISATION VIDÉO & TCHAT EN DIRECT)
// ════════════════════════════════════════════════════════════════
let currentWatchParty = null;
let watchPartyEventSource = null;
let isSyncingPlayback = false;

// Helper pour les appels API locaux (Watch Party, Auth, Suggestions)
async function localFetch(url, data = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await r.json();
}

function setupWatchParty() {
  const openModalBtn = $('open-watchparty-modal-btn');
  const wpModal = $('watchparty-modal');
  const closeWpBtn = $('close-watchparty-btn');
  const tabCreate = $('wp-tab-create');
  const tabJoin = $('wp-tab-join');
  const formCreate = $('wp-form-create');
  const formJoin = $('wp-form-join');
  const btnCreate = $('wp-btn-create-submit');
  const btnJoin = $('wp-btn-join-submit');
  const statusMsg = $('wp-status-msg');

  const toggleSidebarBtn = $('toggle-watchparty-sidebar-btn');
  const mainLayout = document.querySelector('.player-main-layout');

  const copyLinkBtn = $('wp-copy-link-btn');
  const chatInput = $('wp-chat-input');
  const sendChatBtn = $('wp-send-chat-btn');

  if (openModalBtn) openModalBtn.onclick = () => openModal(wpModal);
  if (closeWpBtn) closeWpBtn.onclick = () => closeModal(wpModal);

  if (tabCreate && tabJoin) {
    tabCreate.onclick = () => {
      tabCreate.classList.add('active');
      tabJoin.classList.remove('active');
      formCreate.style.display = 'block';
      formJoin.style.display = 'none';
    };
    tabJoin.onclick = () => {
      tabJoin.classList.add('active');
      tabCreate.classList.remove('active');
      formJoin.style.display = 'block';
      formCreate.style.display = 'none';
    };
  }

  if (toggleSidebarBtn) {
    toggleSidebarBtn.onclick = () => {
      if (mainLayout) mainLayout.classList.toggle('has-sidebar');
    };
  }

  if (btnCreate) {
    btnCreate.onclick = async () => {
      const username = $('wp-create-username').value.trim() || 'Hôte';
      statusMsg.innerHTML = '<span style="color:var(--accent-cyan)">Création de la Watch Party…</span>';

      try {
        const res = await localFetch('/api/watchparty/create', { username, media: currentAnime });

        if (res && res.success) {
          currentWatchParty = {
            code: res.roomCode,
            userId: res.userId,
            isHost: true,
            username
          };

          initRoomState(res.room);
          connectWatchPartySSE(res.roomCode);
          closeModal(wpModal);
          alert(`🍿 Watch Party ${res.roomCode} créée ! Partagez le code ou le lien avec vos amis.`);
        } else {
          statusMsg.innerHTML = `<span style="color:#ef4444">Erreur : ${res.error || 'Impossible de créer la salle.'}</span>`;
        }
      } catch (err) {
        statusMsg.innerHTML = `<span style="color:#ef4444">Erreur : ${err.message}</span>`;
      }
    };
  }

  if (btnJoin) {
    btnJoin.onclick = async () => {
      const code = $('wp-join-code').value.trim().toUpperCase();
      const username = $('wp-join-username').value.trim() || 'Spectateur';

      if (!code) return alert('Veuillez entrer le code de la salle (ex: WP-1234).');
      statusMsg.innerHTML = '<span style="color:var(--accent-cyan)">Connexion à la Watch Party…</span>';

      try {
        const res = await localFetch('/api/watchparty/join', { code, username });

        if (res && res.success) {
          currentWatchParty = {
            code: res.roomCode,
            userId: res.userId,
            isHost: false,
            username
          };

          initRoomState(res.room);
          connectWatchPartySSE(res.roomCode);
          closeModal(wpModal);

          if (res.room.media) {
            resolveAndPlay(res.room.media);
          }
        } else {
          statusMsg.innerHTML = `<span style="color:#ef4444">${res.error || 'Code invalide.'}</span>`;
        }
      } catch (err) {
        statusMsg.innerHTML = `<span style="color:#ef4444">Erreur : ${err.message}</span>`;
      }
    };
  }

  if (copyLinkBtn) {
    copyLinkBtn.onclick = () => {
      if (!currentWatchParty) return;
      const link = `${window.location.origin}${window.location.pathname}?room=${currentWatchParty.code}`;
      navigator.clipboard.writeText(link).then(() => {
        alert(`📋 Lien d'invitation copié dans le presse-papier !\n${link}`);
      });
    };
  }

  const handleSendChat = async () => {
    const text = chatInput.value.trim();
    if (!text || !currentWatchParty) return;
    chatInput.value = '';

    try {
      await localFetch('/api/watchparty/chat', {
        code: currentWatchParty.code,
        userId: currentWatchParty.userId,
        username: currentWatchParty.username,
        text
      });
    } catch(e) {}
  };

  if (sendChatBtn) sendChatBtn.onclick = handleSendChat;
  if (chatInput) {
    chatInput.onkeydown = e => { if (e.key === 'Enter') handleSendChat(); };
  }

  document.querySelectorAll('.wp-emoji-btn').forEach(btn => {
    btn.onclick = async () => {
      const emoji = btn.dataset.emoji;
      if (!emoji || !currentWatchParty) return;
      try {
        await localFetch('/api/watchparty/chat', {
          code: currentWatchParty.code,
          userId: currentWatchParty.userId,
          username: currentWatchParty.username,
          emoji
        });
      } catch(e) {}
    };
  });

  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam && wpModal) {
    openModal(wpModal);
    if (tabJoin) tabJoin.click();
    const joinCodeInput = $('wp-join-code');
    if (joinCodeInput) joinCodeInput.value = roomParam.trim().toUpperCase();
  }
}

function initRoomState(room) {
  if (!room) return;
  const codeDisp = $('wp-room-code-display');
  const roleDisp = $('wp-role-badge');
  const membersCount = $('wp-members-count');
  const memberBadge = $('wp-member-badge');
  const avatars = $('wp-members-avatars');

  if (codeDisp) codeDisp.textContent = room.code;
  if (roleDisp) {
    roleDisp.textContent = currentWatchParty.isHost ? '👑 Hôte' : '👁 Spectateur';
    roleDisp.className = currentWatchParty.isHost ? 'wp-badge-host' : 'wp-badge-viewer';
  }

  if (membersCount) membersCount.textContent = room.members ? room.members.length : 1;
  if (memberBadge)  memberBadge.textContent  = room.members ? room.members.length : 1;

  if (avatars && room.members) {
    avatars.innerHTML = room.members.map(m => `
      <span class="wp-member-pill" title="${m.username}">
        <i class="fa-solid ${m.isHost ? 'fa-crown' : 'fa-user'}" style="color:${m.isHost ? '#f59e0b' : 'var(--accent-cyan)'}"></i>
        ${m.username}
      </span>
    `).join('');
  }

  if (room.messages) {
    const chatContainer = $('wp-chat-messages');
    if (chatContainer) {
      chatContainer.innerHTML = room.messages.map(m => renderChatMessage(m)).join('');
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }
}

function renderChatMessage(m) {
  if (m.isSystem) {
    return `<div class="wp-sys-msg">${m.text}</div>`;
  }
  const isOwn = currentWatchParty && m.userId === currentWatchParty.userId;
  if (m.emoji) {
    return `<div class="wp-msg ${isOwn ? 'wp-msg-own' : ''}"><strong>${m.username}</strong> : <span style="font-size:1.4rem">${m.emoji}</span></div>`;
  }
  return `<div class="wp-msg ${isOwn ? 'wp-msg-own' : ''}"><strong>${m.username}</strong> : ${escapeHtml(m.text)}</div>`;
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function connectWatchPartySSE(code) {
  if (watchPartyEventSource) {
    watchPartyEventSource.close();
  }

  watchPartyEventSource = new EventSource(`/api/watchparty/events/${code}`);

  watchPartyEventSource.addEventListener('INIT', e => {
    const data = JSON.parse(e.data);
    if (data.room) initRoomState(data.room);
  });

  watchPartyEventSource.addEventListener('ROOM_UPDATE', e => {
    const data = JSON.parse(e.data);
    if (data.room) initRoomState(data.room);
  });

  watchPartyEventSource.addEventListener('CHAT_MESSAGE', e => {
    const data = JSON.parse(e.data);
    if (data.message) {
      const chatContainer = $('wp-chat-messages');
      if (chatContainer) {
        chatContainer.insertAdjacentHTML('beforeend', renderChatMessage(data.message));
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
      if (data.message.emoji) {
        triggerFloatingEmoji(data.message.emoji);
      }
    }
  });

  watchPartyEventSource.addEventListener('PLAYBACK_SYNC', e => {
    const data = JSON.parse(e.data);
    if (!currentWatchParty || data.senderId === currentWatchParty.userId) return;

    const video = $('premium-video-player');
    if (!video) return;

    isSyncingPlayback = true;

    if (typeof data.currentTime === 'number' && Math.abs(video.currentTime - data.currentTime) > 1.5) {
      video.currentTime = data.currentTime;
    }

    if (data.isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!data.isPlaying && !video.paused) {
      video.pause();
    }

    setTimeout(() => { isSyncingPlayback = false; }, 300);
  });
}

function triggerFloatingEmoji(emoji) {
  const overlay = $('wp-emoji-overlay');
  if (!overlay) return;
  const el = document.createElement('div');
  el.className = 'floating-emoji';
  el.textContent = emoji;
  el.style.left = `${Math.floor(20 + Math.random() * 60)}%`;
  overlay.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function setupHostVideoSync() {
  const video = $('premium-video-player');
  if (!video) return;

  const broadcastSync = (action) => {
    if (!currentWatchParty || !currentWatchParty.isHost || isSyncingPlayback) return;
    localFetch('/api/watchparty/sync', {
      code: currentWatchParty.code,
      userId: currentWatchParty.userId,
      action,
      currentTime: video.currentTime,
      isPlaying: !video.paused
    }).catch(() => {});
  };

  video.addEventListener('play', () => broadcastSync('play'));
  video.addEventListener('pause', () => broadcastSync('pause'));
  video.addEventListener('seeked', () => broadcastSync('seek'));
}

function setupAnimeVersionFilters() {
  const container = $('anime-version-filter-group');
  if (!container) return;

  const buttons = container.querySelectorAll('.sub-tab');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAnimeVersionFilter = btn.dataset.version || 'all';
      pages.anime = 1;
      loadCategory('anime');
    });
  });
}

let currentAnimeSearchQuery = '';
let currentAnimeSelectedGenre = 'all';

function setupAnimeVoirAnimeSearch() {
  const searchInput = $('anime-dedicated-search');
  const resetBtn = $('anime-search-reset-btn');
  const genreBar = $('anime-genre-pills-bar');

  if (searchInput) {
    searchInput.addEventListener('input', e => {
      clearTimeout(searchDebounce);
      const q = e.target.value.trim();
      currentAnimeSearchQuery = q;

      if (resetBtn) resetBtn.style.display = q ? 'inline-flex' : 'none';

      searchDebounce = setTimeout(() => {
        pages.anime = 1;
        loadCategory('anime');
      }, 350);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      currentAnimeSearchQuery = '';
      resetBtn.style.display = 'none';
      pages.anime = 1;
      loadCategory('anime');
    });
  }

  if (genreBar) {
    const genreButtons = genreBar.querySelectorAll('.genre-pill');
    genreButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        genreButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentAnimeSelectedGenre = btn.dataset.animeGenre || 'all';
        pages.anime = 1;
        loadCategory('anime');
      });
    });
  }
}

function setupWelcomeModal() {
  const welcomeModal = $('welcome-onboarding-modal');
  const closeBtn     = $('close-welcome-modal-btn');
  const loginBtn     = $('welcome-login-btn');
  const regBtn       = $('welcome-register-btn');
  const laterBtn     = $('welcome-later-btn');

  if (!welcomeModal) return;

  const closeWelcome = () => {
    closeModal(welcomeModal);
  };

  if (closeBtn) closeBtn.addEventListener('click', closeWelcome);
  if (laterBtn) laterBtn.addEventListener('click', closeWelcome);

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      closeWelcome();
      const authModal = $('auth-modal');
      const loginTab = $('auth-tab-login');
      if (loginTab) loginTab.click();
      if (authModal) openModal(authModal);
    });
  }

  if (regBtn) {
    regBtn.addEventListener('click', () => {
      closeWelcome();
      const authModal = $('auth-modal');
      const regTab = $('auth-tab-register');
      if (regTab) regTab.click();
      if (authModal) openModal(authModal);
    });
  }

  // Déclencher l'affichage automatique 900ms après l'arrivée sur le site
  setTimeout(() => {
    if (!localStorage.getItem('japoplay_user')) {
      openModal(welcomeModal);
    }
  }, 900);
}

document.addEventListener('DOMContentLoaded', () => {
  setupWatchParty();
  setupHostVideoSync();
  setupAnimeVersionFilters();
  setupAnimeVoirAnimeSearch();
  setupWelcomeModal();
});

// ─── Écran de Chargement Initial (Splash Screen) ───────────────
function initSplashLoader() {
  const loader = $('app-initial-loader');
  const progressFill = $('initial-loader-progress-fill');
  const statusText = $('loader-status-text');

  if (!loader) return;

  const messages = [
    "Initialisation du moteur JapoPlay HD…",
    "Connexion aux résolveurs sécurisés…",
    "Chargement des tendances & nouveautés…",
    "Plateforme prête !"
  ];

  let progress = 0;
  let msgIdx = 0;

  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 18) + 12;
    if (progress > 100) progress = 100;

    if (progressFill) progressFill.style.width = `${progress}%`;

    if (progress > 30 && msgIdx === 0) { msgIdx = 1; if (statusText) statusText.textContent = messages[1]; }
    if (progress > 65 && msgIdx === 1) { msgIdx = 2; if (statusText) statusText.textContent = messages[2]; }
    if (progress >= 100) {
      if (statusText) statusText.textContent = messages[3];
      clearInterval(interval);
      setTimeout(() => {
        loader.classList.add('fade-out');
        setTimeout(() => {
          try { loader.remove(); } catch(e) {}
        }, 600);
      }, 350);
    }
  }, 140);
}

