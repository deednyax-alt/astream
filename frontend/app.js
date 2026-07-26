// ============================================================
//  astream — Animes · Séries · Films · Mangas · TV & Sports
// ============================================================
const API_KEY = 'dc_live_c5d15446a0c5cf51b22b5be9';
const DC_API  = 'https://deadcow-streaming.lol/api/v1';

window.NO_IMAGE_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280"><rect width="200" height="280" fill="%23121420"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%238b5cf6" font-family="sans-serif" font-size="18" font-weight="bold">astream</text><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-family="sans-serif" font-size="12">Image indisponible</text></svg>';
const NO_IMAGE_SVG = window.NO_IMAGE_SVG;

// ─── État Global ─────────────────────────────────────────────
let currentAnime   = null;
let currentVersion = 'vf';
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
  setupNavTabs();
  setupCategoryTabs();
  setupSubTabs();
  setupSearch();
  setupPlayerEvents();
  setupMangaReaderEvents();
  setupSuggestionEvents();
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
}

// ─── Appel API DeadCow v1 ─────────────────────────────────────
async function dcFetch(endpoint, params = {}, options = {}) {
  const { retries = 0, retryDelay = 2000, timeout = 45000 } = options;
  const url = new URL(`${DC_API}${endpoint}`);
  url.searchParams.set('key', API_KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        if (res.status === 429) {
          console.warn(`[API] Limite de requêtes atteinte (429) sur ${endpoint}, attente de 2s...`);
          await new Promise(r => setTimeout(r, 2000));
          const error429 = new Error('Serveur API DeadCow saturé (429 - Surcharge de requêtes)');
          error429.status = 429;
          throw error429;
        }
        const error = new Error(res.status === 408 ? 'Délai d\'attente dépassé (408)' : `Erreur API ${res.status}`);
        error.status = res.status;
        throw error;
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        console.warn(`[API] Tentative ${attempt + 1}/${retries + 1} échouée pour ${endpoint}, nouvelle tentative...`);
        await new Promise(r => setTimeout(r, retryDelay));
      }
    }
  }

  // Télémétrie d'erreur automatique (POST /send-key-bug)
  sendErrorTelemetry(endpoint, lastError?.message || 'Erreur API inconnue');

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
      // Animes : Chargement par lot léger (3 requêtes à la fois) pour éviter la saturation API
      const countPerPage = 3;
      const startIdx = ((pages.anime - 1) * countPerPage) % ANIME_QUERIES.length;
      const batchQueries = [];
      for (let i = 0; i < countPerPage; i++) {
        batchQueries.push(ANIME_QUERIES[(startIdx + i) % ANIME_QUERIES.length]);
      }

      const resultsList = await Promise.all(
        batchQueries.map(q => dcFetch('/search', { q, type: 'anime' }).catch(() => ({ results: [] })))
      );

      const seen = new Set();
      if (append && grid._seenIds) {
        grid._seenIds.forEach(id => seen.add(id));
      } else {
        grid._seenIds = new Set();
      }

      const combined = [];
      resultsList.forEach(r => {
        (r.results || []).forEach(item => {
          if (item.poster && !seen.has(item.id)) {
            seen.add(item.id);
            grid._seenIds.add(item.id);
            combined.push(item);
          }
        });
      });

      items = combined;

      if (!append) grid.innerHTML = '';
      renderCards(grid, items);
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

    card.innerHTML = `
      <div class="card-img-container">
        <img src="${item.poster || NO_IMAGE_SVG}" alt="${item.title}" loading="lazy"
          onerror="this.onerror=null;this.src=window.NO_IMAGE_SVG">
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
    const items = (data.results || []).filter(r => r.poster);
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
  const bg = item.backdrop || item.banner || item.poster || '';
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
  modalBanner.style.backgroundImage = `url('${item.backdrop || item.poster}')`;
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

  // Normaliser le paramètre saison (ex: "Saison 1" -> 1)
  let cleanSeason = season;
  if (typeof cleanSeason === 'string') {
    const numMatch = cleanSeason.match(/\d+/);
    cleanSeason = numMatch ? parseInt(numMatch[0], 10) : cleanSeason;
  }
  season = cleanSeason;

  playerAnimeTitle.textContent = currentAnime?.title || 'Lecture…';
  const displaySeason = season || 1;
  playerEpTitle.textContent = `S${displaySeason} • Ép. ${episode} (${currentVersion.toUpperCase()}) — Extraction en cours…`;
  
  videoLoader.classList.add('active');
  const loaderText = videoLoader.querySelector('p');
  if (loaderText) loaderText.textContent = "Extraction ultra-rapide de la vidéo depuis l'API DeadCow...";

  videoPlayer.style.display = 'block';
  openModal(playerModal);

  let primaryId = id;
  if (type === 'movie' && currentAnime?.playUrl) {
    primaryId = currentAnime.playUrl;
  }
  if (typeof primaryId === 'string' && primaryId.includes('anime-sama.to') && !primaryId.endsWith('/')) {
    primaryId = primaryId + '/';
  }

  const attemptFetch = async (targetId, v, s, timeoutMs = 20000) => {
    const params = { id: targetId, type, episode, version: v };
    if (s !== undefined && s !== null) params.season = s;
    return await dcFetch('/resolve', params, { retries: 0, timeout: timeoutMs });
  };

  try {
    let data = null;

    // Fast-path 1 : Résolution parallèle immédiate (VF et VOSTFR simultanés)
    try {
      data = await Promise.any([
        attemptFetch(primaryId, currentVersion, undefined, 20000),
        attemptFetch(primaryId, currentVersion === 'vf' ? 'vostfr' : 'vf', undefined, 20000),
        ...(season !== undefined ? [attemptFetch(primaryId, currentVersion, season, 20000)] : [])
      ]);
    } catch (eFast) {}

    // Fast-path 2 : Si la résolution parallèle n'a rien renvoyé, essayer avec le slug relatif
    if ((!data || !data.success || !data.streamUrl) && typeof primaryId === 'string' && primaryId.startsWith('http')) {
      const relativeSlug = primaryId.replace(/^https?:\/\/[^\/]+\//, '');
      if (relativeSlug && relativeSlug !== primaryId) {
        try {
          if (loaderText) loaderText.textContent = "Recherche via identifiant alternatif...";
          const relData = await Promise.any([
            attemptFetch(relativeSlug, currentVersion, undefined, 20000),
            attemptFetch(relativeSlug, currentVersion === 'vf' ? 'vostfr' : 'vf', undefined, 20000)
          ]);
          if (relData && relData.success && (relData.streamUrl || relData.embedUrl)) data = relData;
        } catch (eRel) {}
      }
    }

    // Fast-path 3 : Si le film n'a toujours pas de flux direct (ex: Backrooms (2026)), chercher par titre TMDB ID
    if ((!data || !data.success || !data.streamUrl) && (currentAnime?.title || typeof primaryId === 'string')) {
      let rawTitle = currentAnime?.title || primaryId;
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
            const tmdbData = await attemptFetch(tmdbMatch.id, currentVersion, undefined, 20000);
            if (tmdbData && tmdbData.success && (tmdbData.streamUrl || tmdbData.embedUrl)) {
              data = tmdbData;
            }
          }
        } catch (eTmdb) {}
      }
    }

    if (!data || !data.success) {
      throw new Error('Résolution temporairement indisponible pour cet épisode.');
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

// ─── Menu des Sources Lecteurs ────────────────────────────────
function buildSourceSelector(data) {
  streamSourceSelect.innerHTML = '';
  const sources = [];

  const tmdbId = currentAnime?.id || currentAnime?.tmdbId || data.id || data.tmdbId;
  const numericTmdb = (tmdbId && /^\d+$/.test(String(tmdbId).trim())) ? String(tmdbId).trim() : null;

  // Nettoyer et normaliser les URLs d'embeds malformées
  const cleanUrl = (u) => {
    if (!u || typeof u !== 'string') return u;
    if (u.includes('vidsrc') && (u.includes('/http') || u.includes('/https'))) {
      if (numericTmdb) {
        return `https://vidsrc.me/embed/movie?tmdb=${numericTmdb}`;
      }
      return null;
    }
    return u;
  };

  // 1. Placer le flux direct astream en premier s'il est disponible
  if (data.streamUrl) {
    const cleanStream = cleanUrl(data.streamUrl);
    if (cleanStream) {
      sources.push({ name: '🟢 Lecteur Direct astream (Recommandé)', url: cleanStream });
    }
  }

  // 2. Placer l'embed principal s'il est différent du flux direct
  if (data.embedUrl && data.embedUrl !== data.streamUrl) {
    const cleanEmbed = cleanUrl(data.embedUrl);
    if (cleanEmbed && isRealEmbedUrl(cleanEmbed)) {
      sources.push({ name: '🎬 Lecteur Embed Principal', url: cleanEmbed });
    }
  }

  // 3. Ajouter les autres miroir(s) disponibles
  if (data.embeds) {
    Object.entries(data.embeds).forEach(([key, url]) => {
      const targetUrl = cleanUrl(url);
      if (targetUrl && isRealEmbedUrl(targetUrl)) {
        let label = `🎬 Lecteur ${key.toUpperCase()}`;
        if (targetUrl.includes('sibnet')) label = '⚡ Lecteur Sibnet (Ultra Rapide)';
        else if (targetUrl.includes('vidmoly')) label = '🎬 Lecteur Vidmoly (HD)';
        else if (targetUrl.includes('vidoza')) label = '▶ Lecteur Vidoza (HD)';
        else if (targetUrl.includes('vidsrc')) label = '🎬 Lecteur Film HD (VidSrc)';
        if (!sources.some(s => s.url === targetUrl)) {
          sources.push({ name: label, url: targetUrl });
        }
      }
    });
  }

  // 4. Option alternative secondaire VidSrc pour les films si besoin
  if (numericTmdb && currentAnime?.type === 'movie') {
    const vidsrcUrl = `https://vidsrc.me/embed/movie?tmdb=${numericTmdb}`;
    if (!sources.some(s => s.url === vidsrcUrl)) {
      sources.push({ name: '🎬 Lecteur Film HD (VidSrc)', url: vidsrcUrl });
    }
  }

  if (sources.length === 0 && data.embedUrl) {
    const cleanEmbed = cleanUrl(data.embedUrl);
    if (cleanEmbed) sources.push({ name: '🟢 Lecteur Direct astream', url: cleanEmbed });
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

  // 1. Les flux MP4/HLS/Media-Proxy directs ne sont PAS des embeds iframe !
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.mp4') || clean.endsWith('.m3u8') || clean.endsWith('.ts')) return false;
  if (url.includes('/api/media-proxy') || url.includes('/api/hls-proxy')) return false;

  // 2. Hébergeurs avec pages d'embeds iframe
  const validEmbedHosts = ['sibnet.ru', 'vidmoly', 'vidoza', 'myvi', 'streamtape', 'sendvid', 'dood', 'filemoon', 'vidzy', 'multiup', 'franime', 'vidsrc'];
  return validEmbedHosts.some(host => url.toLowerCase().includes(host));
}

// ─── Lancement du Stream (HLS / MP4 / Iframe) ─────────────────
let hlsInstance = null;

function playStream(url) {
  const video = videoPlayer;
  const iframe = $('premium-iframe-player');

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  if (!window._triedSources) window._triedSources = new Set();
  window._triedSources.add(url);

  const isEmbed = isRealEmbedUrl(url);

  if (isEmbed) {
    video.pause();
    video.style.display = 'none';
    if (iframe) {
      iframe.style.display = 'block';
      const proxiedEmbed = url.startsWith('/api/') ? url : `/api/embed-proxy?url=${encodeURIComponent(url)}`;
      iframe.src = proxiedEmbed;
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

  const isHlsManifest = url.includes('.m3u8') || url.includes('hls-proxy') || url.includes('hls');

  if (window.Hls && Hls.isSupported() && isHlsManifest) {
    let streamUrl = url;
    if (!url.includes('/api/proxy') && !url.includes('/api/hls-proxy') && !url.includes('/api/media-proxy')) {
      const targetUrl = url.startsWith('/') ? `https://deadcow-streaming.lol${url}` : url;
      streamUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}&referer=${encodeURIComponent('https://deadcow-streaming.lol/')}`;
    }

    hlsInstance = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
      xhrSetup: function(xhr, xhrUrl) {
        let realTarget = xhrUrl;
        if (realTarget.includes('localhost:') || realTarget.startsWith('/')) {
          realTarget = realTarget.replace(/^https?:\/\/[^\/]+/, 'https://deadcow-streaming.lol');
          if (realTarget.startsWith('/')) realTarget = `https://deadcow-streaming.lol${realTarget}`;
        }
        if (!realTarget.includes('/api/proxy') && !realTarget.includes('/api/hls-proxy') && !realTarget.includes('/api/media-proxy')) {
          xhr.open('GET', `/api/proxy?url=${encodeURIComponent(realTarget)}&referer=${encodeURIComponent('https://deadcow-streaming.lol/')}`, true);
        }
      }
    });

    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      videoLoader.classList.remove('active');
      video.play().catch(() => {});
    });
    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      const isExpired = data.response && (data.response.code === 403 || data.response.code === 404);
      if (data.fatal || isExpired) {
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        console.warn('[HLS] Erreur flux HLS (403/404), basculement vers une source disponible...');
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

function stopPlayer() {
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

// ─── Console Tools ────────────────────────────────────────────
function setupConsole() {
  const importBtn   = $('import-btn');
  const importInput = $('json-import-input');
  const importStat  = $('import-status');
  const testBtn     = $('test-proxy-btn');
  const testUrl     = $('test-proxy-url');
  const testRef     = $('test-proxy-referer');

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

  if (testBtn) {
    testBtn.addEventListener('click', () => {
      const url = testUrl.value.trim();
      if (!url) return alert('Entrez une URL.');
      stopPlayer();
      playerAnimeTitle.textContent = 'Test Proxy';
      playerEpTitle.textContent    = url;
      videoLoader.classList.add('active');
      openModal(playerModal);
      let pUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      if (testRef.value.trim()) pUrl += `&referer=${encodeURIComponent(testRef.value.trim())}`;
      buildSourceSelector({ streamUrl: pUrl, embeds: {} });
      playStream(pUrl);
    });
  }

  const toggleMaintBtn          = $('toggle-maintenance-btn');
  const disableMaintOverlayBtn  = $('disable-maintenance-overlay-btn');
  const maintStatus             = $('maintenance-toggle-status');

  const getAdminPassword = () => {
    let pass = localStorage.getItem('astream_admin_pass');
    if (!pass) {
      pass = prompt('🔐 Entrez le mot de passe Administrateur astream :');
      if (pass) localStorage.setItem('astream_admin_pass', pass);
    }
    return pass;
  };

  const toggleMaintenance = async (forceDisable = false) => {
    let password = getAdminPassword();
    if (!password) return alert('Action annulée. Mot de passe administrateur requis.');

    try {
      const payload = { password };
      if (forceDisable) payload.enabled = false;

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
}
