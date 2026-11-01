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
 * Returns the 4 curated romantic chapter illustrations when raw-photos/ is absent or empty.
 * @returns {import('../js/config.js').VaultPhoto[]}
 */
export function buildCuratedChapterPhotos() {
  return [
    {
      id: 'chapter-1-home-israel',
      caption: '',
      dateLabel: '10-01-2026',
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
          <rect x="330" y="592" width="140" height="6" rx="3" fill="#fff6ea" fill-opacity="0.8"/>
          <rect x="352" y="608" width="96" height="5" rx="2.5" fill="#fff6ea" fill-opacity="0.65"/>
          <rect x="372" y="624" width="56" height="4" rx="2" fill="#fff6ea" fill-opacity="0.45"/>
          <path d="M0 715 Q260 675 530 735 L800 710 L800 920 L0 920 Z" fill="#f7d9c4"/>
          <g fill="#2b2d42" fill-opacity="0.82">
            <circle cx="378" cy="656" r="18"/>
            <path d="M356 718 C356 684 400 684 400 718 Z"/>
            <circle cx="422" cy="652" r="19"/>
            <path d="M398 718 C398 680 446 680 446 718 Z"/>
          </g>
          <path d="M400 605 C392 593 374 595 374 609 C374 622 400 634 400 641 C400 634 426 622 426 609 C426 595 408 593 400 605 Z" fill="#e85d88"/>
        </svg>
      `)
    },
    {
      id: 'chapter-2-apart-horizons',
      caption: '',
      dateLabel: '06-12-2026',
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
          <path d="M125 430 L165 485 L120 495 L88 490 Z" fill="#ffffff" fill-opacity="0.9"/>
          <path d="M320 395 L358 468 L315 478 L280 466 Z" fill="#ffffff" fill-opacity="0.9"/>
          <path d="M400 580 Q510 470 570 595 L635 450 Q700 505 800 610 L800 920 L400 920 Z" fill="#3a9d9b" fill-opacity="0.75"/>
          <path d="M0 700 Q200 665 400 700 T800 695 L800 920 L0 920 Z" fill="#2d6a9f" fill-opacity="0.58"/>
          <path d="M155 220 Q400 85 645 220" stroke="#ffffff" stroke-width="4" stroke-dasharray="10 10" fill="none"/>
          <circle cx="400" cy="155" r="32" fill="#ffffff" fill-opacity="0.92"/>
          <path d="M400 144 C394 135 381 137 381 147 C381 157 400 166 400 172 C400 166 419 157 419 147 C419 137 406 135 400 144 Z" fill="#e05d87"/>
        </svg>
      `)
    },
    {
      id: 'chapter-3-thailand-reunion',
      caption: '',
      dateLabel: '31-12-2026',
      palette: {
        primary: '#fbd2a8',
        secondary: '#f6b8d2',
        accent: '#ea580c'
      },
      dataUrl: svgToDataUrl(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 920" fill="none">
          <defs>
            <linearGradient id="thaiSky" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0%" stop-color="#fbc2b8"/>
              <stop offset="50%" stop-color="#fde1b8"/>
              <stop offset="100%" stop-color="#f8c8dc"/>
            </linearGradient>
            <radialGradient id="lanternGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#fff8dc" stop-opacity="0.95"/>
              <stop offset="50%" stop-color="#ffb347" stop-opacity="0.55"/>
              <stop offset="100%" stop-color="#ffb347" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect width="800" height="920" fill="url(#thaiSky)"/>
          <g>
            <circle cx="230" cy="240" r="85" fill="url(#lanternGlow)"/>
            <rect x="206" y="205" width="48" height="66" rx="22" fill="#fff2cc"/>
            <ellipse cx="230" cy="268" rx="14" ry="5" fill="#ff9f43"/>
            <circle cx="545" cy="195" r="95" fill="url(#lanternGlow)"/>
            <rect x="518" y="156" width="54" height="74" rx="24" fill="#fff4d2"/>
            <ellipse cx="545" cy="227" rx="16" ry="6" fill="#ff9f43"/>
            <circle cx="395" cy="340" r="115" fill="url(#lanternGlow)"/>
            <rect x="363" y="294" width="64" height="88" rx="28" fill="#fff7df"/>
            <ellipse cx="395" cy="378" rx="20" ry="7" fill="#ff8c42"/>
            <circle cx="640" cy="380" r="70" fill="url(#lanternGlow)"/>
            <rect x="620" y="352" width="40" height="54" rx="18" fill="#fff2cc"/>
            <circle cx="165" cy="430" r="65" fill="url(#lanternGlow)"/>
            <rect x="147" y="405" width="36" height="48" rx="16" fill="#fff2cc"/>
          </g>
          <path d="M0 640 Q220 620 420 640 T800 635 L800 920 L0 920 Z" fill="#487eb0" fill-opacity="0.72"/>
          <path d="M120 695 Q400 755 680 675 L645 735 Q395 790 155 735 Z" fill="#5c4033"/>
          <path d="M680 675 Q700 620 670 590" stroke="#5c4033" stroke-width="8" stroke-linecap="round"/>
        </svg>
      `)
    },
    {
      id: 'chapter-4-cherry-blossom-trio',
      caption: '',
      dateLabel: '10-03-2027',
      palette: {
        primary: '#fbc4dc',
        secondary: '#dcd0ff',
        accent: '#d946ef'
      },
      dataUrl: svgToDataUrl(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 920" fill="none">
          <defs>
            <linearGradient id="sakuraSky" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#ffd6e8"/>
              <stop offset="50%" stop-color="#e8d7ff"/>
              <stop offset="100%" stop-color="#d0e8ff"/>
            </linearGradient>
          </defs>
          <rect width="800" height="920" fill="url(#sakuraSky)"/>
          <circle cx="560" cy="310" r="130" fill="#fff5f9" fill-opacity="0.88"/>
          <path d="M90 700 L310 430 L490 430 L710 700 Z" fill="#8d99ae" fill-opacity="0.65"/>
          <path d="M310 430 L400 415 L490 430 L535 510 L465 495 L415 520 L365 492 L265 510 Z" fill="#ffffff" fill-opacity="0.95"/>
          <path d="M0 160 Q220 210 380 140 M180 185 Q280 265 420 245" stroke="#6d4c41" stroke-width="10" stroke-linecap="round"/>
          <g fill="#ff8fab">
            <circle cx="140" cy="175" r="24"/>
            <circle cx="220" cy="195" r="28"/>
            <circle cx="310" cy="165" r="22"/>
            <circle cx="380" cy="140" r="26"/>
            <circle cx="290" cy="240" r="25"/>
            <circle cx="420" cy="245" r="22"/>
            <circle cx="520" cy="205" r="14" fill-opacity="0.75"/>
            <circle cx="610" cy="285" r="12" fill-opacity="0.7"/>
            <circle cx="465" cy="340" r="11" fill-opacity="0.65"/>
          </g>
          <g fill="#ffe5ec">
            <circle cx="140" cy="175" r="10"/>
            <circle cx="220" cy="195" r="12"/>
            <circle cx="310" cy="165" r="9"/>
            <circle cx="380" cy="140" r="11"/>
            <circle cx="290" cy="240" r="10"/>
            <circle cx="420" cy="245" r="9"/>
          </g>
          <path d="M0 700 L800 700 L800 920 L0 920 Z" fill="#f3c4dc" fill-opacity="0.72"/>
          <rect x="285" y="560" width="230" height="16" rx="8" fill="#d90429" fill-opacity="0.82"/>
          <rect x="305" y="592" width="190" height="12" rx="6" fill="#d90429" fill-opacity="0.82"/>
          <rect x="330" y="576" width="16" height="128" fill="#d90429" fill-opacity="0.82"/>
          <rect x="454" y="576" width="16" height="128" fill="#d90429" fill-opacity="0.82"/>
        </svg>
      `)
    }
  ];
}

/**
 * Extracts a display date "DD-MM-YYYY" from a filename or file metadata.
 * Supports:
 * - DD-MM-YYYY, DD.MM.YYYY, DD_MM_YYYY (e.g. 15-08-2026.jpg)
 * - YYYY-MM-DD, YYYY.MM.DD, YYYY_MM_DD (e.g. 2026-08-15.jpg)
 * - DD-MM-YY, DD.MM.YY (e.g. 15-08-26.jpg)
 * - YYYYMMDD (e.g. 20260815.jpg, IMG_20260815_123456.jpg)
 * - Fallback to file creation / modification timestamp.
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
 * Scans photosDir for supported image files or falls back to curated chapter SVGs.
 * @param {string} photosDir
 * @returns {import('../js/config.js').VaultPhoto[]}
 */
export function loadVaultPhotosFromDir(photosDir) {
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
    const mimeType = MIME_BY_EXTENSION[ext];
    const fullPath = path.join(photosDir, filename);
    const fileBuffer = fs.readFileSync(fullPath);
    const base64 = fileBuffer.toString('base64');
    const dateLabel = extractDateLabel(filename, fullPath) || `Photo #${index + 1}`;
    return {
      id: `photo-${index + 1}`,
      dataUrl: `data:${mimeType};base64,${base64}`,
      caption: '',
      dateLabel,
      palette: null
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
 * CLI entrypoint for generating vault.json in the repository root.
 * @param {string[]} argv
 */
export function runCli(argv = process.argv.slice(2)) {
  const [password, githubTokenArg, githubRepoSlugArg] = argv;
  if (!password) {
    console.error(
      'Usage: node scripts/encrypt-vault.mjs <password> [github-token] [github-repo-slug]'
    );
    process.exit(1);
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRootDir = path.resolve(scriptDir, '..');
  const photosDir = resolvePhotosDir(repoRootDir);
  const outputVaultPath = path.join(repoRootDir, 'vault.json');

  const photos = loadVaultPhotosFromDir(photosDir);
  const githubRepo = resolveGitHubRepoMetadata(githubRepoSlugArg, repoRootDir);

  /** @type {import('../js/config.js').VaultPayload} */
  const payload = {
    photos,
    githubToken: githubTokenArg ? githubTokenArg.trim() : null,
    githubRepo,
    generatedAt: new Date().toISOString()
  };

  const encryptedEnvelope = encryptVaultPayload(payload, password);
  fs.writeFileSync(outputVaultPath, `${JSON.stringify(encryptedEnvelope, null, 2)}\n`, 'utf8');

  console.log(
    `Encrypted ${photos.length} photo(s) into ${path.relative(process.cwd(), outputVaultPath) || 'vault.json'} (AES-256-GCM, PBKDF2-SHA256 ${PBKDF2_ITERATIONS} iterations).`
  );
}

const isExecutedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isExecutedDirectly) {
  runCli();
}
