import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'public', 'items');
const attributionPath = path.join(outputDirectory, 'ATTRIBUTION.json');
const userAgent = 'KONTMiniApp/1.0 (item artwork; contact: project maintainers)';
const apiUrl = 'https://commons.wikimedia.org/w/api.php';
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const items = [
  { file: 'carhartt-cap.png', name: 'Carhartt cap', query: 'Carhartt beanie cap' },
  { file: 'thrasher-hoodie.png', name: 'Thrasher hoodie', query: 'Thrasher skateboarding hoodie' },
  { file: 'vans-old-skool.png', name: 'Vans Old Skool shoes', query: 'Vans Old Skool shoes' },
  { file: 'adidas-vintage.png', name: 'Adidas vintage tracksuit jacket', query: 'Adidas track jacket vintage' },
  { file: 'eastpak-bag.png', name: 'Eastpak backpack', query: 'Eastpak backpack' },
  { file: 'market-glasses.png', name: 'Streetwear sunglasses', query: 'sunglasses street fashion' },
  { file: 'adidas-pants.png', name: 'Adidas track pants', query: 'Adidas track pants' },
  { file: 'levis-501.png', name: "Levi's 501 jeans", query: 'Levis 501 jeans' },
  { file: 'yeezy-350.png', name: 'Yeezy Boost 350', query: 'Adidas Yeezy Boost 350' },
  { file: 'trapstar-puffer.png', name: 'Trapstar puffer jacket', query: 'Trapstar puffer jacket' },
  { file: 'supreme-jeans.png', name: 'Supreme baggy jeans', query: 'Supreme clothing jeans' },
  { file: 'stussy-8ball.png', name: 'Stussy 8 Ball hoodie', query: 'Stussy 8 ball hoodie' },
  { file: 'oakley-glasses.png', name: 'Oakley sunglasses', query: 'Oakley sunglasses' },
  { file: 'goyard-bag.png', name: 'Goyard bag', query: 'Goyard bag' },
  { file: 'stone-island-cargo.png', name: 'Stone Island cargo pants', query: 'Stone Island cargo pants' },
  { file: 'polar-big-boy.png', name: 'Polar Skate Co Big Boy jeans', query: 'Polar Skate Co Big Boy jeans' },
  { file: 'rick-owens-geobasket.png', name: 'Rick Owens Geobasket sneakers', query: 'Rick Owens Geobasket sneakers' },
  { file: 'raf-simons-riot.png', name: 'Raf Simons Riot bomber', query: 'Raf Simons Riot bomber jacket' },
  { file: 'balenciaga-hoodie.png', name: 'Balenciaga hoodie', query: 'Balenciaga hoodie' },
  { file: 'chrome-hearts-chain.png', name: 'Chrome Hearts chain belt', query: 'Chrome Hearts silver chain' },
  { file: 'balenciaga-strike.png', name: 'Balenciaga Strike boots', query: 'Balenciaga Strike boots' },
  { file: 'margiela-jacket.png', name: 'Maison Margiela jacket', query: 'Maison Margiela jacket' },
  { file: 'rick-owens-pants.png', name: 'Rick Owens leather pants', query: 'Rick Owens leather pants' },
  { file: 'margiela-jeans.png', name: 'Maison Margiela painted jeans', query: 'Maison Margiela jeans' },
  { file: 'vaz-2107.png', name: 'Lada Riva 2107', query: 'Lada Riva 2107' },
  { file: 'lada-priora.png', name: 'Lada Priora', query: 'Lada Priora' },
  { file: 'toyota-mark2-jzx90.png', name: 'Toyota Mark II JZX90', query: 'Toyota Mark II JZX90' },
  { file: 'honda-civic-eg.png', name: 'Honda Civic EG hatchback', query: 'Honda Civic EG hatchback' },
  { file: 'bmw-e34.png', name: 'BMW E34', query: 'BMW E34' },
  { file: 'toyota-camry-v40.png', name: 'Toyota Camry XV40', query: 'Toyota Camry XV40' },
  { file: 'subaru-wrx-sti.png', name: 'Subaru Impreza WRX STI', query: 'Subaru Impreza WRX STI' },
  { file: 'bmw-e60.png', name: 'BMW E60', query: 'BMW 5 Series E60' },
  { file: 'nissan-silvia-s15.png', name: 'Nissan Silvia S15', query: 'Nissan Silvia S15' },
  { file: 'toyota-prius-xw20.png', name: 'Toyota Prius XW20', query: 'Toyota Prius XW20' },
  { file: 'bmw-m5-f90.png', name: 'BMW M5 F90', query: 'BMW M5 F90' },
  { file: 'mercedes-g63.png', name: 'Mercedes-AMG G63', query: 'Mercedes AMG G63' },
  { file: 'porsche-911-gt3rs.png', name: 'Porsche 911 GT3 RS', query: 'Porsche 911 GT3 RS' },
  { file: 'nissan-gtr-r35.png', name: 'Nissan GT-R R35 Nismo', query: 'Nissan GT-R R35 Nismo' },
  { file: 'lamborghini-urus.png', name: 'Lamborghini Urus', query: 'Lamborghini Urus' },
];

const carFiles = new Set(items.slice(24).map((item) => item.file));
const productTerms = new Map([
  ['carhartt-cap.png', ['cap', 'beanie', 'hat']],
  ['thrasher-hoodie.png', ['hoodie', 'sweatshirt']],
  ['vans-old-skool.png', ['shoe', 'sneaker', 'footwear']],
  ['adidas-vintage.png', ['jacket', 'tracksuit', 'track']],
  ['eastpak-bag.png', ['backpack', 'rucksack']],
  ['market-glasses.png', ['sunglass', 'eyewear', 'glasses']],
  ['adidas-pants.png', ['pants', 'trouser', 'track']],
  ['levis-501.png', ['jeans', 'denim']],
  ['yeezy-350.png', ['shoe', 'sneaker', 'footwear']],
  ['trapstar-puffer.png', ['puffer', 'jacket', 'coat']],
  ['supreme-jeans.png', ['jeans', 'denim']],
  ['stussy-8ball.png', ['hoodie', 'sweatshirt']],
  ['oakley-glasses.png', ['sunglass', 'eyewear', 'glasses']],
  ['goyard-bag.png', ['bag', 'handbag', 'purse']],
  ['stone-island-cargo.png', ['cargo', 'pants', 'trouser']],
  ['polar-big-boy.png', ['jeans', 'denim', 'pants']],
  ['rick-owens-geobasket.png', ['shoe', 'sneaker', 'footwear']],
  ['raf-simons-riot.png', ['bomber', 'jacket']],
  ['balenciaga-hoodie.png', ['hoodie', 'sweatshirt']],
  ['chrome-hearts-chain.png', ['chain', 'necklace', 'belt']],
  ['balenciaga-strike.png', ['boot', 'footwear']],
  ['margiela-jacket.png', ['jacket', 'coat']],
  ['rick-owens-pants.png', ['pants', 'trouser']],
  ['margiela-jeans.png', ['jeans', 'denim']],
]);

const normalizeTitle = (value) =>
  value.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, ' ').trim();

const isRelevantCandidate = (item, candidate) => {
  const title = normalizeTitle(candidate.title);
  const query = normalizeTitle(item.query);
  const titleTerms = new Set(title.split(' '));
  const disallowedTerms = [
    'badge', 'cameltoe', 'headlamp', 'interior', 'label', 'lamp', 'logo', 'poster',
    'sign', 'store', 'tag', 'tire', 'tyre', 'wedgie', 'wheel',
  ];
  if (disallowedTerms.some((term) => titleTerms.has(term)) || title.includes('head lamp')) return false;
  const ignored = new Set([
    'a', 'an', 'and', 'by', 'for', 'from', 'in', 'of', 'on', 'the', 'with',
    'street', 'fashion', 'clothing', 'wear', 'vintage', 'official', 'style',
    'boot', 'boots', 'cap', 'coat', 'denim', 'footwear', 'glasses', 'handbag',
    'hat', 'jeans', 'jacket', 'necklace', 'pants', 'purse', 'rucksack',
    'shoe', 'shoes', 'sneaker', 'sneakers', 'sunglass', 'sunglasses',
    'sweatshirt', 'track', 'tracksuit', 'trouser', 'trousers',
  ]);
  const significantTerms = query.split(' ').filter((term) => term.length > 1 && !ignored.has(term));
  const matchCount = significantTerms.filter((term) => titleTerms.has(term)).length;
  const minimumMatches = Math.min(2, significantTerms.length);
  if (matchCount < minimumMatches) return false;
  const modelNumbers = significantTerms.filter((term) => /\d/.test(term));
  if (modelNumbers.some((term) => !titleTerms.has(term))) return false;
  if (item.file === 'porsche-911-gt3rs.png' && !titleTerms.has('rs')) return false;
  if (carFiles.has(item.file)) return true;

  const hasProductType = (productTerms.get(item.file) ?? []).some((term) => title.includes(term));
  const exactModelMatched = significantTerms.length >= 2 && matchCount === significantTerms.length;
  return hasProductType || exactModelMatched;
};

const metadataText = (metadata, key) =>
  metadata?.[key]?.value?.replace(/<[^>]*>/g, '').trim() ?? '';

async function searchCommons(item) {
  const { query } = item;
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '6',
    prop: 'imageinfo',
    iiprop: 'mime|url|extmetadata',
    iiurlwidth: '640',
    format: 'json',
  });
  let response;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(`${apiUrl}?${params}`, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.ok) break;
    if (response.status !== 429 || attempt === 3) {
      throw new Error(`Commons search failed (${response.status})`);
    }
    const retryAfter = Number(response.headers.get('retry-after')) * 1_000;
    await wait(retryAfter || (5_000 * (attempt + 1)));
  }
  const data = await response.json();
  return Object.values(data.query?.pages ?? [])
    .map((page) => ({ title: page.title, info: page.imageinfo?.[0] }))
    .filter((candidate) =>
      candidate.info?.thumburl &&
      candidate.info.mime?.startsWith('image/') &&
      isRelevantCandidate(item, candidate),
    );
};

async function downloadCandidate(candidate) {
  let lastError;
  for (const url of [candidate.info.thumburl, candidate.info.url]) {
    if (!url) continue;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': userAgent },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`Image download failed (${response.status})`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 2_000) throw new Error('Downloaded image is unexpectedly small');
      await sharp(buffer).metadata();
      return buffer;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Image URL is missing');
}

async function processClothingImage(buffer) {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(320, 320, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueue = (x, y) => {
    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) return;
    const offset = pixelIndex * channels;
    if (data[offset] <= 240 || data[offset + 1] <= 240 || data[offset + 2] <= 240) return;
    visited[pixelIndex] = 1;
    queue[tail++] = pixelIndex;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }
  while (head < tail) {
    const pixelIndex = queue[head++];
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    data[pixelIndex * channels + 3] = 0;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }

  return sharp(data, { raw: info }).png().toBuffer();
}

async function processCarImage(buffer) {
  const image = await sharp(buffer)
    .rotate()
    .resize(320, 320, { fit: 'cover', position: sharp.strategy.attention })
    .modulate({ brightness: 0.9, saturation: 1.08 })
    .linear(1.08, -8)
    .ensureAlpha()
    .png()
    .toBuffer();
  const maskSvg = Buffer.from(
    '<svg width="320" height="320" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="fade"><stop offset="48%" stop-color="white" stop-opacity="1"/><stop offset="100%" stop-color="white" stop-opacity="0"/></radialGradient></defs><rect width="320" height="320" fill="url(#fade)"/></svg>',
  );
  const mask = await sharp(maskSvg).png().toBuffer();
  return sharp(image).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function createFallback(item, outputPath) {
  const isCar = carFiles.has(item.file);
  const icon = isCar
    ? '<path d="M44 119 56 84q4-10 14-11l62-1q10 1 15 11l12 36-7 13H48Z" fill="url(#paint)" stroke="#ffe18b" stroke-width="4"/><path d="m71 81 9-22h48l12 23Z" fill="#17263a" stroke="#a9ecff" stroke-width="3"/><circle cx="70" cy="132" r="16" fill="#080b12" stroke="#dce6f3" stroke-width="6"/><circle cx="158" cy="132" r="16" fill="#080b12" stroke="#dce6f3" stroke-width="6"/><path d="M47 111h24m94 0h18" stroke="#ffe16f" stroke-width="5"/>'
    : '<path d="m63 47 19-19h39l19 19 25 14-13 27-12-7 2 57H51l2-57-12 7-13-27Z" fill="url(#paint)" stroke="#ffe18b" stroke-width="4" stroke-linejoin="round"/><path d="M81 30q19 20 39 0l-10 27H91Z" fill="#151924" stroke="#dbe4f0" stroke-width="3"/><path d="M99 60v56m-14-29h28" stroke="#f8e9bd" stroke-width="4"/>';
  const svg = `<svg width="320" height="320" viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="bg"><stop stop-color="#27304a"/><stop offset="1" stop-color="#11131a"/></radialGradient><linearGradient id="paint" x2="1" y2="1"><stop stop-color="#b8f4ff"/><stop offset=".52" stop-color="#9665df"/><stop offset="1" stop-color="#322448"/></linearGradient></defs><rect width="220" height="180" fill="url(#bg)"/><ellipse cx="110" cy="148" rx="78" ry="13" fill="#6ee7f9" opacity=".2"/><g transform="translate(0 4)">${icon}</g><text x="110" y="169" fill="#e6d6ff" font-family="Arial,sans-serif" font-size="8" font-weight="bold" text-anchor="middle">${item.name.replace(/[&<>"]/g, '')}</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  let previousAttribution = [];
  try {
    previousAttribution = JSON.parse(await readFile(attributionPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const attribution = new Map(
    previousAttribution.map((entry) => [entry.file, entry]),
  );

  for (const item of items) {
    const outputPath = path.join(outputDirectory, item.file);
    try {
      await wait(1_500);
      const candidates = await searchCommons(item);
      let processed;
      let sourceInfo;
      for (const candidate of candidates.slice(0, 3)) {
        try {
          const source = await downloadCandidate(candidate);
          processed = carFiles.has(item.file)
            ? await processCarImage(source)
            : await processClothingImage(source);
          sourceInfo = candidate;
          break;
        } catch (error) {
          console.warn(`Skipping ${candidate.title}: ${error.message}`);
        }
      }

      if (processed && sourceInfo) {
        await writeFile(outputPath, processed);
        const metadata = sourceInfo.info.extmetadata;
        attribution.set(item.file, {
          file: item.file,
          item: item.name,
          source: sourceInfo.title,
          sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(sourceInfo.title.replaceAll(' ', '_'))}`,
          license: metadataText(metadata, 'LicenseShortName') || 'License metadata unavailable',
          author: metadataText(metadata, 'Artist'),
          credit: metadataText(metadata, 'Credit'),
          attributionRequired: metadataText(metadata, 'AttributionRequired') === 'true',
        });
        console.log(`Downloaded ${item.file} from ${sourceInfo.title}`);
      } else {
        const existing = await readFile(outputPath).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
          return undefined;
        });
        const previous = attribution.get(item.file);
        if (!existing || previous?.source?.startsWith('File:')) {
          await createFallback(item, outputPath);
          attribution.set(item.file, {
            file: item.file,
            item: item.name,
            source: 'Generated fallback artwork',
            note: `No suitable Commons image found for "${item.query}".`,
            license: 'Generated for this project.',
          });
        }
        console.warn(`Using generated artwork for ${item.file}; no suitable Commons image found.`);
      }
    } catch (error) {
      console.warn(`Could not fetch ${item.file}: ${error.message}`);
      try {
        await readFile(outputPath);
      } catch (fileError) {
        if (fileError.code !== 'ENOENT') throw fileError;
        await createFallback(item, outputPath);
        attribution.set(item.file, {
          file: item.file,
          item: item.name,
          source: 'Generated fallback artwork',
          note: error.message,
          license: 'Generated for this project.',
        });
      }
    }
  }

  await writeFile(attributionPath, `${JSON.stringify([...attribution.values()], null, 2)}\n`);
}

await main();
