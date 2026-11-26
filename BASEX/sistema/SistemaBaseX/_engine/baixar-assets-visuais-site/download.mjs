#!/usr/bin/env node
/**
 * Captura assets visuais de qualquer site: logo, banners desktop/mobile, capas de colecao.
 * Auto-detecta Shopify e usa /collections.json quando disponivel.
 *
 * Uso:
 *   node download.mjs --url https://exemplo.com [--destino /path] [--dry-run]
 *                     [--max-por-categoria 30] [--max-colecoes 50] [--timeout 30000]
 */

import { existsSync, mkdirSync, writeFileSync, statSync, createWriteStream } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function deriveSlug(urlString) {
  const u = new URL(urlString);
  return u.hostname.replace(/^www\./, '').split('.')[0];
}

function absUrl(base, src) {
  if (!src) return null;
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

function safeName(s, max = 60) {
  return s
    .replace(/[^a-z0-9._-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);
}

function extFromUrl(u) {
  try {
    const p = new URL(u).pathname;
    const e = extname(p).toLowerCase();
    if (e && e.length <= 5) return e;
  } catch {}
  return '.bin';
}

function extFromMime(mime) {
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/gif': '.gif',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
    'image/avif': '.avif',
  };
  return map[mime] || null;
}

async function fetchBuffer(u, timeout = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(u, {
      headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const mime = res.headers.get('content-type') || '';
    const ab = await res.arrayBuffer();
    return { buf: Buffer.from(ab), mime: mime.split(';')[0].trim() };
  } finally {
    clearTimeout(t);
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function classifyByUrl(url) {
  const u = url.toLowerCase();
  if (/(favicon|apple-touch-icon)/.test(u)) return 'logo';
  if (/\b(logo|brand[-_]?mark|wordmark|isotype)\b/.test(u)) return 'logo';
  return null;
}

function classifyByAttrs({ alt, className, parent }) {
  const haystack = `${alt || ''} ${className || ''} ${parent || ''}`.toLowerCase();
  if (/\blogo\b|brand[-_]?mark|wordmark/.test(haystack)) return 'logo';
  if (/\b(hero|banner|slide|carousel)\b/.test(haystack)) return 'banner';
  return null;
}

async function extractFromPage(page, viewport) {
  return await page.evaluate(({ viewport }) => {
    const out = {
      icons: [],
      images: [],
      backgrounds: [],
      svgInline: [],
      collectionLinks: [],
    };

    document.querySelectorAll('link[rel*="icon"], link[rel*="apple-touch-icon"], link[rel*="mask-icon"]').forEach((l) => {
      const href = l.getAttribute('href');
      if (href) out.icons.push({ href, rel: l.getAttribute('rel'), sizes: l.getAttribute('sizes') || '' });
    });

    document.querySelectorAll('img').forEach((img) => {
      const declaredW = parseInt(img.getAttribute('width') || '0', 10);
      const declaredH = parseInt(img.getAttribute('height') || '0', 10);
      if (declaredW > 5000 || declaredH > 5000) return;
      const alt = img.getAttribute('alt') || '';
      if (/lcphack|preloadhack|visionlcp/i.test(alt)) return;
      const style = img.getAttribute('style') || '';
      if (/position\s*:\s*absolute[^;]*top\s*:\s*0/i.test(style) && declaredW > 1000) return;

      const rect = img.getBoundingClientRect();
      const w = img.naturalWidth || rect.width || 0;
      const h = img.naturalHeight || rect.height || 0;
      const parent = (img.closest('header, [class*=header i]') && !img.closest('main') ? 'header ' : '') +
        (img.closest('nav, [class*=nav i]:not(main)') ? 'nav ' : '') +
        (img.closest('[class*=hero i], [class*=banner i], [class*=slide i], [class*=carousel i], [class*=slideshow i]') ? 'hero ' : '') +
        (img.closest('[class*=product i], [class*=card-product i], [class*=product-card i], [class*=card__media i]') ? 'product ' : '') +
        (img.closest('[class*=mega-menu i], [class*=dropdown i], [class*=submenu i], [class*=mobile-menu i], [class*=drawer i]') ? 'menu ' : '') +
        (img.closest('footer') ? 'footer ' : '');
      const srcsetUrls = [];
      const srcset = img.getAttribute('srcset');
      if (srcset) {
        srcset.split(',').forEach((s) => {
          const u = s.trim().split(/\s+/)[0];
          if (u) srcsetUrls.push(u);
        });
      }
      out.images.push({
        src: img.currentSrc || img.src || img.getAttribute('data-src') || '',
        srcsetUrls,
        alt,
        className: img.className || '',
        parent: parent.trim(),
        width: w,
        height: h,
        topPx: rect.top,
        declaredW,
        declaredH,
      });
    });

    document.querySelectorAll('picture').forEach((pic) => {
      const inProduct = pic.closest('[class*=product i], [class*=card-product i], [class*=product-card i], [class*=card__media i]') ? 'product ' : '';
      const inHero = pic.closest('[class*=hero i], [class*=banner i], [class*=slide i], [class*=carousel i], [class*=slideshow i]') ? 'hero ' : '';
      const inFooter = pic.closest('footer') ? 'footer ' : '';
      const inMenu = pic.closest('[class*=mega-menu i], [class*=dropdown i], [class*=submenu i], [class*=mobile-menu i], [class*=drawer i]') ? 'menu ' : '';
      pic.querySelectorAll('source').forEach((s) => {
        const ss = s.getAttribute('srcset') || '';
        const media = s.getAttribute('media') || '';
        ss.split(',').forEach((part) => {
          const url = part.trim().split(/\s+/)[0];
          if (url) {
            out.images.push({
              src: url, srcsetUrls: [], alt: '', className: 'picture-source',
              parent: `${inProduct}${inHero}${inFooter}${inMenu}`.trim(),
              media, width: 0, height: 0, topPx: 0, declaredW: 0, declaredH: 0,
            });
          }
        });
      });
    });

    const elements = Array.from(document.querySelectorAll('*')).slice(0, 4000);
    elements.forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') {
        const matches = bg.match(/url\((['"]?)([^'")]+)\1\)/g) || [];
        matches.forEach((m) => {
          const url = m.replace(/^url\((['"]?)/, '').replace(/(['"]?)\)$/, '');
          if (url && !url.startsWith('data:')) {
            const rect = el.getBoundingClientRect();
            out.backgrounds.push({
              src: url,
              width: rect.width,
              height: rect.height,
              topPx: rect.top,
              parent: (el.closest('header, nav') ? 'header ' : '') + (el.closest('[class*=hero i], [class*=banner i]') ? 'hero ' : ''),
            });
          }
        });
      }
    });

    document.querySelectorAll('header svg, nav svg, [class*="logo" i] svg, a[href="/"] svg').forEach((svg) => {
      const cls = (svg.getAttribute('class') || '').toLowerCase();
      if (/\bicon(__|--|-)|^icon\b|hamburger|search|cart|close|menu|chevron|arrow|caret|burger|account|user|wishlist|heart/.test(cls)) return;
      const w = parseInt(svg.getAttribute('width') || '0', 10);
      const h = parseInt(svg.getAttribute('height') || '0', 10);
      if (w > 0 && w <= 32 && h > 0 && h <= 32) return;
      const vb = svg.getAttribute('viewBox') || '';
      const vbParts = vb.split(/\s+/).map((n) => parseFloat(n));
      if (vbParts.length === 4 && vbParts[2] <= 32 && vbParts[3] <= 32) return;
      const clone = svg.cloneNode(true);
      if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      out.svgInline.push({ markup: clone.outerHTML, parent: 'header', class: cls, width: w, height: h });
    });

    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (/\/(collections|categoria|category|c|shop|loja|store)\/[a-z0-9_-]+/i.test(href)) {
        out.collectionLinks.push(href);
      }
    });

    return out;
  }, { viewport });
}

async function detectPlatform(page) {
  return await page.evaluate(() => {
    const html = document.documentElement.outerHTML.slice(0, 50000).toLowerCase();
    if (html.includes('cdn.shopify.com') || html.includes('shopify.theme') || html.includes('window.shopify')) return 'shopify';
    if (html.includes('wp-content') || html.includes('woocommerce')) return 'woocommerce';
    if (html.includes('vtex.com')) return 'vtex';
    if (html.includes('nuvemshop') || html.includes('tiendanube')) return 'nuvemshop';
    return 'generico';
  });
}

async function getShopifyCollections(baseUrl, maxColecoes) {
  try {
    const u = new URL('/collections.json', baseUrl);
    u.searchParams.set('limit', '250');
    const res = await fetch(u.href, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const cols = data.collections || [];
    return cols.slice(0, maxColecoes).map((c) => ({
      handle: c.handle,
      title: c.title,
      image: c.image?.src || null,
    }));
  } catch {
    return null;
  }
}

async function getShopifyCollectionImageFromProduct(baseUrl, handle) {
  try {
    const u = new URL(`/collections/${encodeURIComponent(handle)}/products.json`, baseUrl);
    u.searchParams.set('limit', '1');
    const res = await fetch(u.href, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const prod = (data.products || [])[0];
    if (!prod) return null;
    const img = (prod.images || [])[0];
    return img?.src || null;
  } catch {
    return null;
  }
}

async function genericCollectionsFromLinks(page, links, maxColecoes, baseOrigin) {
  const unique = Array.from(new Set(links)).slice(0, maxColecoes);
  const out = [];
  for (const href of unique) {
    try {
      const target = absUrl(baseOrigin, href);
      if (!target) continue;
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 20000 });
      try { await page.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}
      const data = await page.evaluate(() => {
        const handle = location.pathname.split('/').filter(Boolean).pop() || 'colecao';
        const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        if (og && !og.includes('data:')) return { handle, title: document.title, image: og };

        const header = document.querySelector('header');
        const footer = document.querySelector('footer');
        const isInside = (el, root) => root && (el === root || root.contains(el));

        const allImgs = Array.from(document.querySelectorAll('img'));
        const candidates = allImgs
          .filter((img) => {
            const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
            if (!src || src.startsWith('data:')) return false;
            if (isInside(img, header) || isInside(img, footer)) return false;
            if (/mega-menu|nav__|menu__|drawer|hidden|sr-only|visually-hidden/i.test(img.className || '')) return false;
            if (/lcphack|preloadhack/i.test(img.alt || '')) return false;
            const declaredW = parseInt(img.getAttribute('width') || '0', 10);
            const declaredH = parseInt(img.getAttribute('height') || '0', 10);
            if (declaredW > 5000 || declaredH > 5000) return false;
            const style = img.getAttribute('style') || '';
            if (/position\s*:\s*absolute[^;]*top\s*:\s*0/i.test(style)) return false;
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            return w >= 200 && h >= 200;
          })
          .sort((a, b) => {
            const aw = (a.naturalWidth || a.width || 0) * (a.naturalHeight || a.height || 0);
            const bw = (b.naturalWidth || b.width || 0) * (b.naturalHeight || b.height || 0);
            return bw - aw;
          });

        const pick = candidates[0];
        if (!pick) return { handle, title: document.title, image: null };
        const src = pick.currentSrc || pick.src || pick.getAttribute('data-src');
        return { handle, title: document.title, image: src };
      });
      if (data.image) {
        const abs = absUrl(target, data.image);
        if (abs) out.push({ ...data, image: abs });
      }
    } catch (e) {
      // skip
    }
  }
  return out;
}

function isProductImage(img) {
  if (img.parent && img.parent.includes('product')) return true;
  if (/\bproduct|card-product|product-card|product-grid|product__media|card__media\b/i.test(img.className || '')) return true;
  if (img.alt && /\b(t-shirt|tshirt|camiseta|bermuda|boné|bone|jaqueta|cal[çc]a|polo|short|sa[ií]a|vestido|tênis|tenis|jeans)\b/i.test(img.alt)) return true;
  return false;
}

function isMenuImage(img) {
  if (img.parent && img.parent.includes('menu')) return true;
  if (/\bmega-menu|menu__image|dropdown|submenu|drawer\b/i.test(img.className || '')) return true;
  return false;
}

function isThumbnail(img) {
  const w = img.width || 0;
  const h = img.height || 0;
  if (w > 0 && w < 120) return true;
  if (h > 0 && h < 120) return true;
  if (/\bthumbnail|thumb_|_thumb\b/i.test(img.src || '')) return true;
  return false;
}

function isLogoCandidate(img, url) {
  if (isMenuImage(img) || isProductImage(img)) return false;
  if (classifyByUrl(url) === 'logo') return true;
  if (classifyByAttrs(img) === 'logo') return true;
  const inHeader = img.parent && img.parent.includes('header');
  if (inHeader) {
    const cls = (img.className || '').toLowerCase();
    if (/\b(header__logo|logo__image|site-logo|brand-logo|navbar-brand)\b/.test(cls)) return true;
  }
  return false;
}

function isHeroBanner(img, isMobile) {
  if (isProductImage(img) || isMenuImage(img)) return false;
  if (img.parent && img.parent.includes('footer')) return false;

  if (img.parent && img.parent.includes('hero')) return true;

  const w = img.width || img.declaredW || 0;
  const h = img.height || img.declaredH || 0;
  const top = img.topPx || 0;

  if (img.className === 'picture-source') return false;

  if (isMobile) {
    if (top > 1600 || top < 0) return false;
    return w >= 600;
  }
  const ratio = h > 0 ? w / h : 0;
  return w >= 1100 && ratio >= 1.3 && top < 1200 && top >= 0;
}

function pickByCategory(images, backgrounds, baseUrl, isMobile) {
  const buckets = { favicon: [], logo: [], hero: [], product: [], outros: [] };

  const seen = new Set();
  const addImg = (img, bucket, url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    buckets[bucket].push({ url, parent: img.parent || '', alt: img.alt || '', w: img.width || img.declaredW || 0, h: img.height || img.declaredH || 0 });
  };

  images.forEach((img) => {
    const raw = img.src;
    if (!raw || raw.startsWith('data:')) return;
    const url = absUrl(baseUrl, raw);
    if (!url) return;
    if (isThumbnail(img)) {
      addImg(img, 'outros', url);
      return;
    }
    if (isLogoCandidate(img, url)) {
      addImg(img, 'logo', url);
      return;
    }
    if (isMenuImage(img)) {
      addImg(img, 'outros', url);
      return;
    }
    if (isProductImage(img)) {
      addImg(img, 'product', url);
      return;
    }
    if (isHeroBanner(img, isMobile)) {
      addImg(img, 'hero', url);
      return;
    }
    addImg(img, 'outros', url);
  });

  backgrounds.forEach((b) => {
    if (!b.src || b.src.startsWith('data:')) return;
    const url = absUrl(baseUrl, b.src);
    if (!url || seen.has(url)) return;
    if (b.parent && b.parent.includes('footer')) return;
    if (b.parent && b.parent.includes('hero')) {
      seen.add(url);
      buckets.hero.push({ url, parent: b.parent, alt: '', w: b.width, h: b.height });
      return;
    }
    const minW = isMobile ? 400 : 1100;
    if (b.width >= minW) {
      seen.add(url);
      buckets.hero.push({ url, parent: b.parent || '', alt: '', w: b.width, h: b.height });
    }
  });

  return buckets;
}

function pickFavicons(icons, baseUrl) {
  const out = [];
  icons.forEach((i) => {
    const u = absUrl(baseUrl, i.href);
    if (!u) return;
    out.push({ url: u, rel: i.rel, sizes: i.sizes });
  });
  return out;
}

function pickInlineSvgLogos(svgInline) {
  return svgInline.map((s, idx) => ({
    inlineSvg: s.markup,
    name: `logo-inline-${idx + 1}.svg`,
    source: 'header-svg',
  }));
}

function uniqByKey(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const url = args.url || args.URL;
  if (!url) {
    console.error('FAIL: --url e obrigatorio');
    console.error('Uso: node download.mjs --url https://exemplo.com [--destino /path] [--dry-run]');
    process.exit(1);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    console.error(`FAIL: URL invalida: ${url}`);
    process.exit(1);
  }

  const slug = deriveSlug(parsedUrl.href);
  const destino = args.destino || join(homedir(), 'Desktop', slug);
  const dryRun = !!args['dry-run'];
  const maxPorCategoria = parseInt(args['max-por-categoria'] || '30', 10);
  const maxColecoes = parseInt(args['max-colecoes'] || '50', 10);
  const timeout = parseInt(args.timeout || '30000', 10);

  console.log(`[info] URL: ${parsedUrl.href}`);
  console.log(`[info] Destino: ${destino}`);
  console.log(`[info] Modo: ${dryRun ? 'DRY-RUN' : 'EXECUCAO REAL'}`);
  console.log('');

  const subdirs = ['logo', 'favicon', 'banners-desktop', 'banners-mobile', 'colecoes', 'produtos', 'outros'];
  if (!dryRun) {
    subdirs.forEach((d) => mkdirSync(join(destino, d), { recursive: true }));
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await ctx.newPage();

  console.log('[info] Carregando home em viewport desktop 1920x1080...');
  await page.goto(parsedUrl.href, { waitUntil: 'networkidle', timeout }).catch(async () => {
    await page.goto(parsedUrl.href, { waitUntil: 'domcontentloaded', timeout });
  });
  await sleep(800);

  const platform = await detectPlatform(page);
  console.log(`[info] Plataforma detectada: ${platform}`);

  const desktopData = await extractFromPage(page, 'desktop');
  console.log(`[info] Desktop: ${desktopData.images.length} <img>, ${desktopData.backgrounds.length} bg, ${desktopData.icons.length} icons, ${desktopData.svgInline.length} svg-inline, ${desktopData.collectionLinks.length} collection-links`);

  console.log('[info] Recarregando em viewport mobile 390x844...');
  await ctx.close();
  const ctxMobile = await browser.newContext({
    userAgent: UA.replace('Macintosh', 'iPhone'),
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const pageMobile = await ctxMobile.newPage();
  await pageMobile.goto(parsedUrl.href, { waitUntil: 'networkidle', timeout }).catch(async () => {
    await pageMobile.goto(parsedUrl.href, { waitUntil: 'domcontentloaded', timeout });
  });
  await sleep(800);
  const mobileData = await extractFromPage(pageMobile, 'mobile');
  console.log(`[info] Mobile: ${mobileData.images.length} <img>, ${mobileData.backgrounds.length} bg`);

  let collections = [];
  let shopifyHandles = [];
  if (platform === 'shopify') {
    console.log('[info] Buscando coleções via /collections.json...');
    const shopCols = (await getShopifyCollections(parsedUrl.href, maxColecoes)) || [];
    shopifyHandles = shopCols.map((c) => c.handle);
    const withImage = shopCols.filter((c) => c.image);
    console.log(`[info] ${shopCols.length} colecoes via JSON (${withImage.length} com image direta)`);
    collections = withImage;
  }

  if (platform === 'shopify' && shopifyHandles.length > collections.length) {
    console.log('[info] Buscando imagem do 1º produto pra coleções sem image direta...');
    const pendentes = shopifyHandles.filter((h) => !collections.find((c) => c.handle === h));
    let achados = 0;
    for (const handle of pendentes.slice(0, maxColecoes - collections.length)) {
      const img = await getShopifyCollectionImageFromProduct(parsedUrl.origin, handle);
      if (img) {
        collections.push({ handle, title: handle, image: img });
        achados++;
      }
      await sleep(120);
    }
    console.log(`[info] +${achados} colecoes via /collections/{handle}/products.json (total: ${collections.length})`);
  }

  const needFallback = collections.length === 0 || (platform !== 'shopify' && desktopData.collectionLinks.length > 0);
  if (needFallback) {
    console.log('[info] Crawl DOM por handle (último fallback)...');
    const candidateLinks = [...desktopData.collectionLinks, ...mobileData.collectionLinks];
    if (candidateLinks.length > 0) {
      const ctxGen = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 } });
      const pgGen = await ctxGen.newPage();
      const more = await genericCollectionsFromLinks(pgGen, candidateLinks, maxColecoes - collections.length, parsedUrl.origin);
      collections = [...collections, ...more];
      console.log(`[info] +${more.length} colecoes via crawl DOM (total: ${collections.length})`);
      await ctxGen.close();
    }
  }

  await browser.close();

  const baseUrl = parsedUrl.href;

  const desktopBuckets = pickByCategory(desktopData.images, desktopData.backgrounds, baseUrl, false);
  const mobileBuckets = pickByCategory(mobileData.images, mobileData.backgrounds, baseUrl, true);

  const mergeUniq = (a, b) => {
    const seen = new Set();
    const out = [];
    for (const item of [...a, ...b]) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      out.push(item);
    }
    return out;
  };

  const favicons = pickFavicons(desktopData.icons, baseUrl);
  const inlineSvgs = pickInlineSvgLogos(desktopData.svgInline);
  const logos = mergeUniq(desktopBuckets.logo, mobileBuckets.logo).slice(0, maxPorCategoria);
  const desktopBanners = desktopBuckets.hero.slice(0, maxPorCategoria);
  const mobileBanners = mobileBuckets.hero.slice(0, maxPorCategoria);
  const produtos = mergeUniq(desktopBuckets.product, mobileBuckets.product).slice(0, maxPorCategoria);
  const outros = mergeUniq(desktopBuckets.outros, mobileBuckets.outros).slice(0, maxPorCategoria);
  const colecoes = uniqByKey(
    collections
      .map((c) => ({ url: absUrl(baseUrl, c.image), handle: c.handle, title: c.title }))
      .filter((c) => c.url),
    (c) => c.url,
  ).slice(0, maxColecoes);

  const plan = [
    { dir: 'logo', items: [
        ...logos.map((l, i) => ({ url: l.url, order: i + 1, label: `${l.alt || ''} ${l.url}`.trim() })),
        ...inlineSvgs.map((s, i) => ({ inlineSvg: s.inlineSvg, nameOverride: s.name, order: 900 + i, label: s.name })),
      ],
    },
    { dir: 'favicon', items: favicons.map((f, i) => ({ url: f.url, order: i + 1, label: `${f.rel} ${f.sizes} ${f.url}` })) },
    { dir: 'banners-desktop', items: desktopBanners.map((b, i) => ({ url: b.url, order: i + 1, label: `${b.w}x${b.h} ${b.url}` })) },
    { dir: 'banners-mobile', items: mobileBanners.map((b, i) => ({ url: b.url, order: i + 1, label: `${b.w}x${b.h} ${b.url}` })) },
    { dir: 'colecoes', items: colecoes.map((c, i) => ({ url: c.url, order: i + 1, handle: c.handle, label: `${c.handle} - ${c.url}` })) },
    { dir: 'produtos', items: produtos.map((p, i) => ({ url: p.url, order: i + 1, label: `${p.alt || ''} ${p.url}`.trim() })) },
    { dir: 'outros', items: outros.map((o, i) => ({ url: o.url, order: i + 1, label: `${o.alt || ''} ${o.url}`.trim() })) },
  ];

  console.log('');
  console.log('=== Plano de captura ===');
  for (const p of plan) {
    console.log(`[plano] ${p.dir}/: ${p.items.length} itens`);
    p.items.slice(0, 5).forEach((it) => console.log(`         - ${it.label}`));
    if (p.items.length > 5) console.log(`         ... +${p.items.length - 5} mais`);
  }
  console.log('');

  if (dryRun) {
    console.log('[dry-run] Nenhum arquivo baixado. Remover --dry-run para executar.');
    process.exit(0);
  }

  const seenHashes = new Set();
  const report = [`# Captura visual de ${parsedUrl.host}`, '', `- URL: ${parsedUrl.href}`, `- Plataforma: ${platform}`, `- Destino: ${destino}`, '', '## Arquivos'];

  for (const p of plan) {
    report.push('', `### ${p.dir}/`, '');
    let idx = 1;
    for (const item of p.items) {
      try {
        if (item.inlineSvg) {
          const name = item.nameOverride || `logo-inline-${idx}.svg`;
          const dest = join(destino, p.dir, name);
          writeFileSync(dest, item.inlineSvg, 'utf8');
          report.push(`- ${name} (svg inline do header)`);
          idx++;
          continue;
        }
        if (!item.url) continue;
        const { buf, mime } = await fetchBuffer(item.url, 20000);
        const hash = createHash('sha256').update(buf).digest('hex').slice(0, 12);
        if (seenHashes.has(hash)) {
          report.push(`- (skip duplicata) ${item.url}`);
          continue;
        }
        seenHashes.add(hash);
        let ext = extFromMime(mime) || extFromUrl(item.url);
        const baseName = item.handle
          ? safeName(item.handle)
          : safeName(decodeURIComponent(new URL(item.url).pathname.split('/').pop() || `item-${idx}`).replace(/\.[a-z0-9]+$/i, ''));
        const prefix = String(item.order || idx).padStart(2, '0');
        const fileName = `${prefix}-${baseName || 'item'}${ext}`;
        const dest = join(destino, p.dir, fileName);
        writeFileSync(dest, buf);
        const kb = (buf.length / 1024).toFixed(1);
        report.push(`- ${fileName} (${kb} KB, ${mime || 'unknown'}) <- ${item.url}`);
        idx++;
        await sleep(200);
      } catch (e) {
        report.push(`- (falhou) ${item.url || item.label}: ${e.message}`);
      }
    }
  }

  writeFileSync(join(destino, 'relatorio.md'), report.join('\n'), 'utf8');

  console.log('');
  console.log('=== Captura concluida ===');
  for (const p of plan) {
    let count = 0, bytes = 0;
    try {
      const entries = await import('node:fs').then((fs) => fs.readdirSync(join(destino, p.dir)));
      count = entries.length;
      entries.forEach((f) => {
        try { bytes += statSync(join(destino, p.dir, f)).size; } catch {}
      });
    } catch {}
    const mb = (bytes / 1024 / 1024).toFixed(2);
    console.log(`  ${p.dir}/: ${count} arquivos (${mb} MB)`);
  }
  console.log(`  Relatorio: ${join(destino, 'relatorio.md')}`);
  console.log('');
}

main().catch((e) => {
  console.error('[FAIL] Erro inesperado:', e.message);
  console.error(e.stack);
  process.exit(99);
});
