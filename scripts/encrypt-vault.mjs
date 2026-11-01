import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PBKDF2_ITERATIONS = 150_000;
const SALT_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12;
const KEY_BYTE_LENGTH = 32;
const AUTH_TAG_BYTE_LENGTH = 16;
const MAX_IMAGE_DIMENSION_PX = 960;
const JPEG_QUALITY_PCT = 68;

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heif'
};

const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif']);

const FALLBACK_PALETTES = [
  { primary: '#f6b8d0', secondary: '#b8d8f8', accent: '#e86f9a' },
  { primary: '#a8dff4', secondary: '#fcd5b5', accent: '#3b82f6' },
  { primary: '#fbd3a7', secondary: '#f7b5ca', accent: '#f59e0b' },
  { primary: '#fbc4dc', secondary: '#d8c4fb', accent: '#d946ef' }
];

/**
 * Converts an SVG markup string into a compact UTF-8 base64 data URL.
 * @param {string} svgMarkup
 * @returns {string}
 */
function svgToDataUrl(svgMarkup) {
  const normalized = svgMarkup.trim().replace(/\s+/g, ' ');
  return `data:image/svg+xml;base64,${Buffer.from(normalized, 'utf8').toString('base64')}`;
}

/**
 * Returns 4 generic abstract chapter illustrations when raw-photos/ and images/ are absent.
 * Contains zero personal dates or location identifiers.
 * @returns {import('../js/config.js').VaultPhoto[]}
 */
export function buildCuratedChapterPhotos() {
  return [
    {
      id: 'chapter-1-origin',
      caption: '',
      dateLabel: 'Chapter 01',
      palette: {
        primary: '#f6b8d0',
        secondary: '#fde2b8',
        accent: '#e86f9a'
      },
      dataUrl: svgToDataUrl(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 920" fill="none">
          <defs>
            <linearGradient id="sky1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#ffd6e7"/>
              <stop offset="52%" stop-color="#ffe8c8"/>
              <stop offset="100%" stop-color="#c9e4ff"/>
            </linearGradient>
            <radialGradient id="sun1" cx="50%" cy="42%" r="36%">
              <stop offset="0%" stop-color="#fffdf7" stop-opacity="0.96"/>
              <stop offset="55%" stop-color="#ffb6c9" stop-opacity="0.55"/>
              <stop offset="100%" stop-color="#ffb6c9" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="sea1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#8ec5fc"/>
              <stop offset="100%" stop-color="#5b9bd5"/>
            </linearGradient>
          </defs>
          <rect width="800" height="920" fill="url(#sky1)"/>
          <circle cx="400" cy="390" r="270" fill="url(#sun1)"/>
          <circle cx="400" cy="390" r="95" fill="#fff7eb" fill-opacity="0.9"/>
          <path d="M0 575 Q200 555 400 575 T800 570 L800 920 L0 920 Z" fill="url(#sea1)" fill-opacity="0.78"/>
          <path d="M0 640 Q240 615 480 645 T800 635 L800 920 L0 920 Z" fill="#4f8bc9" fill-opacity="0.65"/>
        </svg>
      `)
    },
    {
      id: 'chapter-2-horizons',
      caption: '',
      dateLabel: 'Chapter 02',
      palette: {
        primary: '#b8dff8',
        secondary: '#fbd5b8',
        accent: '#3b82f6'
      },
      dataUrl: svgToDataUrl(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 920" fill="none">
          <defs>
            <linearGradient id="leftSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#b8dcff"/>
              <stop offset="100%" stop-color="#e3f2fd"/>
            </linearGradient>
            <linearGradient id="rightSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ffd5b8"/>
              <stop offset="100%" stop-color="#fff0d9"/>
            </linearGradient>
          </defs>
          <rect width="400" height="920" fill="url(#leftSky)"/>
          <rect x="400" width="400" height="920" fill="url(#rightSky)"/>
          <circle cx="155" cy="220" r="56" fill="#ffffff" fill-opacity="0.88"/>
          <circle cx="645" cy="220" r="64" fill="#ffb38a" fill-opacity="0.82"/>
          <path d="M0 640 L125 430 L235 565 L320 395 L400 545 L400 920 L0 920 Z" fill="#6488b4"/>
          <path d="M400 580 Q510 470 570 595 L635 450 Q700 505 800 610 L800 920 L400 920 Z" fill="#3a9d9b" fill-opacity="0.75"/>
        </svg>
      `)
    },
    {
      id: 'chapter-3-lanterns',
      caption: '',
      dateLabel: 'Chapter 03',
      palette: {
        primary: '#fbd2a8',
        secondary: '#f6b8d2',
        accent: '#ea580c'
      },
      dataUrl: svgToDataUrl(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 920" fill="none">
          <defs>
            <linearGradient id="warmSky" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0%" stop-color="#fbc2b8"/>
              <stop offset="50%" stop-color="#fde1b8"/>
              <stop offset="100%" stop-color="#f8c8dc"/>
            </linearGradient>
          </defs>
          <rect width="800" height="920" fill="url(#warmSky)"/>
          <circle cx="395" cy="340" r="115" fill="#fff7df" fill-opacity="0.85"/>
          <path d="M0 640 Q220 620 420 640 T800 635 L800 920 L0 920 Z" fill="#487eb0" fill-opacity="0.72"/>
        </svg>
      `)
    },
    {
      id: 'chapter-4-blossoms',
      caption: '',
      dateLabel: 'Chapter 04',
      palette: {
        primary: '#fbc4dc',
        secondary: '#dcd0ff',
        accent: '#d946ef'
      },
      dataUrl: svgToDataUrl(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 920" fill="none">
          <defs>
            <linearGradient id="blossomSky" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#ffd6e8"/>
              <stop offset="50%" stop-color="#e8d7ff"/>
              <stop offset="100%" stop-color="#d0e8ff"/>
            </linearGradient>
          </defs>
          <rect width="800" height="920" fill="url(#blossomSky)"/>
          <circle cx="560" cy="310" r="130" fill="#fff5f9" fill-opacity="0.88"/>
          <path d="M90 700 L310 430 L490 430 L710 700 Z" fill="#8d99ae" fill-opacity="0.65"/>
          <path d="M0 700 L800 700 L800 920 L0 920 Z" fill="#f3c4dc" fill-opacity="0.72"/>
        </svg>
      `)
    }
  ];
}

/**
 * Fallback generic TripConfig used only when private/trip-config.json is absent in synthetic test environments.
 * @returns {import('../js/config.js').TripConfig}
 */
export function buildDefaultTripConfig() {
  return {
    coupleNames: {
      partnerA: 'Partner A',
      partnerB: 'Partner B'
    },
    relationshipOriginDate: '2025-01-01',
    homeCountryCode: 'US',
    primaryDepartureDate: '2025-06-01',
    secondaryDepartureDate: '2025-06-02',
    pinnedCountryCodes: ['US', 'GB', 'FR', 'JP'],
    defaultSoloLocations: {
      preTrip: {
        partnerA: { countryCode: 'US', cityNote: '' },
        partnerB: { countryCode: 'US', cityNote: '' }
      },
      apartPhase1: {
        partnerA: { countryCode: 'GB', cityNote: '' },
        partnerB: { countryCode: 'FR', cityNote: '' }
      },
      apartPhase2: {
        partnerA: { countryCode: 'GB', cityNote: '' },
        partnerB: { countryCode: 'JP', cityNote: '' }
      },
      apartPhase3: {
        partnerA: { countryCode: 'JP', cityNote: '' },
        partnerB: { countryCode: 'JP', cityNote: '' }
      }
    },
    reunions: [
      {
        id: 'reunion-sample-1',
        title: 'Reunion Chapter 1',
        emoji: '✨',
        startDate: '2025-07-01',
        endDate: '2025-07-10',
        description: 'Sample shared chapter',
        legs: [
          {
            id: 'leg-sample-1',
            countryCode: 'FR',
            startDate: '2025-07-01',
            endDate: '2025-07-10',
            notes: 'Sample leg'
          }
        ]
      }
    ],
    milestones: [
      {
        id: 'ms-origin',
        date: '2025-01-01',
        category: 'origin',
        emoji: '💕',
        title: 'Origin Milestone',
        details: 'Start date',
        person: 'both',
        countryCode: 'US'
      }
    ],
    timeTravelPresets: [],
    timeTravelRange: {
      minMs: 1735689600000,
      maxMs: 1767225600000,
      stepMs: 3600000
    }
  };
}

/**
 * Loads the canonical TripConfig from gitignored `private/trip-config.json` (or an explicit path).
 * @param {string} repoRootDir
 * @param {string} [explicitConfigPath]
 * @returns {import('../js/config.js').TripConfig}
 */
export function loadTripConfig(repoRootDir, explicitConfigPath) {
  const candidatePaths = [
    explicitConfigPath,
    path.join(repoRootDir, 'private', 'trip-config.json'),
    path.join(repoRootDir, 'raw-photos', 'trip-config.json')
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, 'utf8');
      return JSON.parse(raw);
    }
  }

  return buildDefaultTripConfig();
}

/**
 * Loads the GitHub PAT from CLI argument or gitignored `private/github-token.txt`.
 * @param {string | undefined} cliTokenArg
 * @param {string} repoRootDir
 * @returns {string | null}
 */
export function resolveGitHubToken(cliTokenArg, repoRootDir) {
  if (typeof cliTokenArg === 'string' && cliTokenArg.trim().length > 0) {
    return cliTokenArg.trim();
  }
  const privateTokenPath = path.join(repoRootDir, 'private', 'github-token.txt');
  if (fs.existsSync(privateTokenPath)) {
    const token = fs.readFileSync(privateTokenPath, 'utf8').trim();
    if (token.length > 0) {
      return token;
    }
  }
  return null;
}

/**
 * Extracts a display date "DD-MM-YYYY" from a filename or file metadata.
 * @param {string} filename
 * @param {string} [filePath]
 * @returns {string}
 */
export function extractDateLabel(filename, filePath) {
  const stem = path.basename(filename, path.extname(filename));

  // 1. DD-MM-YYYY or DD.MM.YYYY or DD_MM_YYYY
  const dmyMatch = stem.match(/(?:^|[-_.\s])(0?[1-9]|[12]\d|3[01])[-_.](0?[1-9]|1[0-2])[-_.](20\d{2})(?:[-_.\s]|$)/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }

  // 2. YYYY-MM-DD or YYYY.MM.DD or YYYY_MM_DD
  const ymdMatch = stem.match(/(?:^|[-_.\s])(20\d{2})[-_.](0?[1-9]|1[0-2])[-_.](0?[1-9]|[12]\d|3[01])(?:[-_.\s]|$)/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }

  // 3. DD-MM-YY or DD.MM.YY
  const dmyShortMatch = stem.match(/(?:^|[-_.\s])(0?[1-9]|[12]\d|3[01])[-_.](0?[1-9]|1[0-2])[-_.](\d{2})(?:[-_.\s]|$)/);
  if (dmyShortMatch) {
    const [, d, m, yy] = dmyShortMatch;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-20${yy}`;
  }

  // 4. Compact YYYYMMDD (e.g. 20260815 or IMG_20260815_123456)
  const compactMatch = stem.match(/(?:^|[-_A-Za-z])(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[-_.\s]|$)/);
  if (compactMatch) {
    const [, y, m, d] = compactMatch;
    return `${d}-${m}-${y}`;
  }

  // 5. Compact DDMMYYYY (e.g. 15082026 or photo_15082026)
  const compactDmyMatch = stem.match(/(?:^|[-_A-Za-z])(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(20\d{2})(?:[-_.\s]|$)/);
  if (compactDmyMatch) {
    const [, d, m, y] = compactDmyMatch;
    return `${d}-${m}-${y}`;
  }

  // 6. Fallback to file mtime / birthtime if filePath exists
  if (filePath && fs.existsSync(filePath)) {
    try {
      const stat = fs.statSync(filePath);
      const date = stat.birthtime && stat.birthtime.getTime() > 0 ? stat.birthtime : stat.mtime;
      if (date && !isNaN(date.getTime())) {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = String(date.getFullYear());
        return `${d}-${m}-${y}`;
      }
    } catch {}
  }

  return '';
}

/**
 * Resolves the photo source directory, preferring images/ then falling back to raw-photos/.
 * @param {string} repoRootDir
 * @returns {string}
 */
export function resolvePhotosDir(repoRootDir) {
  const imagesDir = path.join(repoRootDir, 'images');
  if (fs.existsSync(imagesDir)) {
    const files = fs.readdirSync(imagesDir).filter((name) => {
      const ext = path.extname(name).toLowerCase();
      return Boolean(MIME_BY_EXTENSION[ext]);
    });
    if (files.length > 0) return imagesDir;
  }
  const rawPhotosDir = path.join(repoRootDir, 'raw-photos');
  if (fs.existsSync(rawPhotosDir)) {
    return rawPhotosDir;
  }
  return imagesDir;
}

/**
 * Downscales and compresses a raster image via macOS `sips` into a temporary JPEG buffer.
 * Falls back to the raw file buffer if `sips` is unavailable or image optimization is disabled.
 * @param {string} fullPath
 * @param {string} ext
 * @param {boolean} optimizeImages
 * @returns {{ buffer: Buffer, mimeType: string }}
 */
function readAndOptimizeImage(fullPath, ext, optimizeImages) {
  const defaultMime = MIME_BY_EXTENSION[ext] || 'image/jpeg';
  if (!optimizeImages || !RASTER_EXTENSIONS.has(ext) || process.platform !== 'darwin') {
    return { buffer: fs.readFileSync(fullPath), mimeType: defaultMime };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-img-'));
  const tmpOutPath = path.join(tmpDir, 'optimized.jpg');
  try {
    execFileSync(
      'sips',
      [
        '-Z',
        String(MAX_IMAGE_DIMENSION_PX),
        '-s',
        'format',
        'jpeg',
        '-s',
        'formatOptions',
        String(JPEG_QUALITY_PCT),
        fullPath,
        '--out',
        tmpOutPath
      ],
      { stdio: 'ignore' }
    );
    if (fs.existsSync(tmpOutPath)) {
      const optimizedBuffer = fs.readFileSync(tmpOutPath);
      return { buffer: optimizedBuffer, mimeType: 'image/jpeg' };
    }
  } catch {
    // Fall back to original buffer if sips fails
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }

  return { buffer: fs.readFileSync(fullPath), mimeType: defaultMime };
}

/**
 * Scans photosDir for supported image files or falls back to curated chapter SVGs.
 * @param {string} photosDir
 * @param {{ optimizeImages?: boolean }} [options]
 * @returns {import('../js/config.js').VaultPhoto[]}
 */
export function loadVaultPhotosFromDir(photosDir, options = {}) {
  const optimizeImages = options.optimizeImages ?? true;

  if (!fs.existsSync(photosDir)) {
    return buildCuratedChapterPhotos();
  }

  const entries = fs
    .readdirSync(photosDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => {
      const ext = path.extname(name).toLowerCase();
      return Boolean(MIME_BY_EXTENSION[ext]);
    })
    .sort((a, b) => a.localeCompare(b, 'en'));

  if (entries.length === 0) {
    return buildCuratedChapterPhotos();
  }

  return entries.map((filename, index) => {
    const ext = path.extname(filename).toLowerCase();
    const fullPath = path.join(photosDir, filename);
    const { buffer, mimeType } = readAndOptimizeImage(fullPath, ext, optimizeImages);
    const base64 = buffer.toString('base64');
    const dateLabel = extractDateLabel(filename, fullPath) || `Photo #${index + 1}`;
    const fallbackPalette = FALLBACK_PALETTES[index % FALLBACK_PALETTES.length];
    return {
      id: `photo-${index + 1}`,
      dataUrl: `data:${mimeType};base64,${base64}`,
      caption: '',
      dateLabel,
      palette: fallbackPalette
    };
  });
}

/**
 * Parses an owner/repo slug from an explicit CLI argument or .git/config remote URL.
 * @param {string | undefined} explicitSlug
 * @param {string} repoRootDir
 * @returns {{ owner: string, repo: string, branch: string, path: string } | null}
 */
export function resolveGitHubRepoMetadata(explicitSlug, repoRootDir) {
  if (explicitSlug && explicitSlug.includes('/')) {
    const [owner, repo] = explicitSlug.trim().replace(/\.git$/, '').split('/');
    if (owner && repo) {
      return { owner, repo, branch: 'main', path: 'live-state.json' };
    }
  }

  const gitConfigPath = path.join(repoRootDir, '.git', 'config');
  if (fs.existsSync(gitConfigPath)) {
    const gitConfig = fs.readFileSync(gitConfigPath, 'utf8');
    const remoteMatch = gitConfig.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\s*$/m);
    if (remoteMatch) {
      return {
        owner: remoteMatch[1],
        repo: remoteMatch[2],
        branch: 'main',
        path: 'live-state.json'
      };
    }
  }

  return null;
}

/**
 * Encrypts a VaultPayload object into the canonical vault.json wire structure.
 * Appends the 16-byte AES-GCM authentication tag to the ciphertext so Web Crypto
 * `crypto.subtle.decrypt` can consume the combined buffer directly.
 *
 * @param {import('../js/config.js').VaultPayload} payloadObj
 * @param {string} password
 * @returns {{
 *   version: 1,
 *   kdf: 'PBKDF2-SHA256',
 *   iterations: 150000,
 *   salt: string,
 *   iv: string,
 *   ciphertext: string
 * }}
 */
export function encryptVaultPayload(payloadObj, password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Vault password must be a non-empty string.');
  }

  const salt = crypto.randomBytes(SALT_BYTE_LENGTH);
  const iv = crypto.randomBytes(IV_BYTE_LENGTH);
  const derivedKey = crypto.pbkdf2Sync(
    Buffer.from(password, 'utf8'),
    salt,
    PBKDF2_ITERATIONS,
    KEY_BYTE_LENGTH,
    'sha256'
  );

  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv, {
    authTagLength: AUTH_TAG_BYTE_LENGTH
  });

  const plaintextBuffer = Buffer.from(JSON.stringify(payloadObj), 'utf8');
  const encryptedBody = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combinedCiphertext = Buffer.concat([encryptedBody, authTag]);

  return {
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: combinedCiphertext.toString('base64')
  };
}

/**
 * CLI entrypoint for generating vault.json.
 * @param {string[]} [argv]
 * @param {{
 *   repoRootDir?: string,
 *   photosDir?: string,
 *   outputVaultPath?: string,
 *   tripConfigPath?: string,
 *   optimizeImages?: boolean
 * }} [options]
 */
export function runCli(argv = process.argv.slice(2), options = {}) {
  const filteredArgs = argv.filter((arg) => arg !== '--migrate');
  const [password, githubTokenArg, githubRepoSlugArg] = filteredArgs;
  if (!password) {
    console.error(
      'Usage: node scripts/encrypt-vault.mjs <password> [github-token] [github-repo-slug]'
    );
    process.exit(1);
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRootDir = options.repoRootDir || path.resolve(scriptDir, '..');
  const photosDir = options.photosDir || resolvePhotosDir(repoRootDir);
  const outputVaultPath = options.outputVaultPath || path.join(repoRootDir, 'vault.json');

  const tripConfig = loadTripConfig(repoRootDir, options.tripConfigPath);
  const photos = loadVaultPhotosFromDir(photosDir, {
    optimizeImages: options.optimizeImages ?? true
  });
  const githubToken = resolveGitHubToken(githubTokenArg, repoRootDir);
  const githubRepo = resolveGitHubRepoMetadata(githubRepoSlugArg, repoRootDir);

  /** @type {import('../js/config.js').VaultPayload} */
  const payload = {
    tripConfig,
    photos,
    githubToken,
    githubRepo,
    generatedAt: new Date().toISOString()
  };

  const encryptedEnvelope = encryptVaultPayload(payload, password);
  fs.writeFileSync(outputVaultPath, `${JSON.stringify(encryptedEnvelope, null, 2)}\n`, 'utf8');

  console.log(
    `Encrypted tripConfig + ${photos.length} photo(s) into ${path.relative(process.cwd(), outputVaultPath) || 'vault.json'} (AES-256-GCM, PBKDF2-SHA256 ${PBKDF2_ITERATIONS} iterations).`
  );
}

const isExecutedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isExecutedDirectly) {
  runCli();
}
