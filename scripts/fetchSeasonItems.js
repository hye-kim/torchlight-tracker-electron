#!/usr/bin/env node
/**
 * Fetches new items from a tlidb.com season page and adds them to comprehensive_item_mapping.json.
 *
 * Usage:   node scripts/fetchSeasonItems.js <season-url>
 * Example: node scripts/fetchSeasonItems.js https://tlidb.com/en/Lunaria_Season
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const MAPPING_FILE = path.join(__dirname, '..', 'comprehensive_item_mapping.json');
const DELAY_MS = 350;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url) {
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TorchTracker/1.0)' },
    timeout: 15000,
    responseType: 'text',
  });
  return res.data;
}

// Maps the tab pane id attribute to the section display name
const SECTION_ID_MAP = {
  Legendarygear: 'Legendary gear',
  Skill: 'Skill',
  Item: 'Item',
};

/**
 * Parse season page into a map of sectionName -> [{ slug, name }].
 * The page uses Bootstrap tab panes: <div id="Legendarygear" class="tab-pane ...">
 * @param {string} html
 */
function parseSeasonPage(html) {
  const result = new Map();

  // Find each tracked tab pane by its id attribute
  const paneRegex =
    /<div\s+id="([^"]+)"\s+class="[^"]*tab-pane[^"]*"[^>]*>([\s\S]*?)(?=<div\s+id="[^"]+"\s+class="[^"]*tab-pane|$)/gi;
  let m;
  while ((m = paneRegex.exec(html)) !== null) {
    const paneId = m[1];
    const sectionName = SECTION_ID_MAP[paneId];
    if (!sectionName) continue;

    const sectionHtml = m[2];

    // Collect <a href="slug">Display Name</a> pairs
    const items = [];
    const aRegex = /<a\s+[^>]*href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let am;
    while ((am = aRegex.exec(sectionHtml)) !== null) {
      const href = am[1];
      const displayName = am[2].replace(/<[^>]+>/g, '').trim();

      // Skip absolute URLs, root-relative paths, anchors, and protocol-prefixed values
      if (
        href.startsWith('http') ||
        href.startsWith('/') ||
        href.startsWith('#') ||
        href.includes(':')
      ) {
        continue;
      }

      const slug = decodeURIComponent(href);
      if (slug && displayName) items.push({ slug, rawHref: href, name: displayName });
    }

    // Deduplicate by slug
    const seen = new Set();
    const unique = items.filter(({ slug }) => {
      if (seen.has(slug)) return false;
      seen.add(slug);
      return true;
    });

    if (unique.length > 0) result.set(sectionName, unique);
  }

  return result;
}

/**
 * Parse an individual item page for id, img, baseSlug, and type.
 * @param {string} html
 * @returns {{ id: string|null, img: string|null, baseSlug: string|null, type: string|null }}
 */
function parseItemPage(html) {
  // Numeric ID — appears as "id: 12345" in a list item
  const idMatch = html.match(/\bid:\s*(\d+)/i);
  const id = idMatch ? idMatch[1] : null;

  // Item icon: the <img> inside <div class="text-center icon"> within the popupItem card
  const imgMatch = html.match(
    /class="text-center icon"[^>]*>[\s\S]*?<img[^>]+src="(https:\/\/cdn\.tlidb\.com\/[^"]+)"/i
  );
  const img = imgMatch ? imgMatch[1] : null;

  // Base item slug (legendary gear only): Base: <a href="Hunter%27s_Gloves">
  const baseMatch = html.match(/Base:\s*<a[^>]+href="([^"]+)"/i);
  const baseSlug = baseMatch ? decodeURIComponent(baseMatch[1]) : null;

  // Item type — appears as "type: Active Skill" or similar in a list item
  const typeMatch = html.match(/<li[^>]*>[^<]*type:\s*([^<\n]+)/i);
  const type = typeMatch ? typeMatch[1].trim() : null;

  return { id, img, baseSlug, type };
}

async function main() {
  const seasonUrl = process.argv[2];
  if (!seasonUrl) {
    console.error('Usage:   node scripts/fetchSeasonItems.js <season-url>');
    console.error('Example: node scripts/fetchSeasonItems.js https://tlidb.com/en/Lunaria_Season');
    process.exit(1);
  }

  // Load existing mapping
  const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
  const existingIds = new Set(Object.keys(mapping));
  console.log(`Loaded ${existingIds.size} existing items from mapping`);

  console.log(`\nFetching season page: ${seasonUrl}`);
  const seasonHtml = await fetchHtml(seasonUrl);
  const sections = parseSeasonPage(seasonHtml);

  if (sections.size === 0) {
    console.error(
      'No tracked sections found on page. Expected h2 headings: Legendary gear, Skill, Item'
    );
    process.exit(1);
  }

  console.log('Sections found:');
  for (const [section, items] of sections) {
    console.log(`  ${section}: ${items.length} items`);
  }

  // Build base URL for item pages by stripping the last path segment
  const itemBaseUrl = seasonUrl.replace(/\/[^/]*$/, '');

  const newEntries = {};
  let skipped = 0;
  let errors = 0;
  const baseItemCache = new Map(); // avoid re-fetching the same base item

  for (const [sectionName, items] of sections) {
    console.log(`\n── ${sectionName} ${'─'.repeat(Math.max(0, 34 - sectionName.length))}`);
    const isLegendary = sectionName === 'Legendary gear';

    for (const { rawHref, name } of items) {
      await sleep(DELAY_MS);

      const itemUrl = `${itemBaseUrl}/${rawHref}`;

      try {
        const itemHtml = await fetchHtml(itemUrl);
        const { id, img, baseSlug, type } = parseItemPage(itemHtml);

        if (!id) {
          console.warn(`  [SKIP]   ${name} — could not find item ID`);
          skipped++;
          continue;
        }

        if (existingIds.has(id)) {
          console.log(`  [EXISTS] ${name} (${id})`);
          skipped++;
          continue;
        }

        const type_en = isLegendary ? 'Legendary Gear' : (type ?? sectionName);
        const entry = { id, name_en: name, type_en, ...(img && { img }) };

        // For legendary gear, follow the base item link to get baseItemId
        if (isLegendary && baseSlug) {
          await sleep(DELAY_MS);
          try {
            let baseId = baseItemCache.get(baseSlug);
            if (!baseId) {
              const baseUrl = `${itemBaseUrl}/${baseSlug.replace(/ /g, '_')}`;
              const baseHtml = await fetchHtml(baseUrl);
              baseId = parseItemPage(baseHtml).id ?? undefined;
              if (baseId) baseItemCache.set(baseSlug, baseId);
            }
            if (baseId) entry.baseItemId = baseId;
          } catch (err) {
            console.warn(
              `  [WARN]   Could not fetch base item "${baseSlug}" for ${name}: ${err.message}`
            );
          }
        }

        newEntries[id] = entry;
        const extra = entry.baseItemId ? `, base: ${entry.baseItemId}` : '';
        console.log(`  [NEW]    ${name} (${id}, ${type_en}${extra})`);
      } catch (err) {
        console.error(`  [ERROR]  ${name}: ${err.message}`);
        errors++;
      }
    }
  }

  const newCount = Object.keys(newEntries).length;
  console.log(`\n${'─'.repeat(36)}`);
  console.log(`${newCount} new  |  ${skipped} skipped  |  ${errors} errors`);

  if (newCount > 0) {
    const updated = { ...mapping, ...newEntries };
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    console.log(`Wrote ${newCount} new items to ${path.basename(MAPPING_FILE)}`);
  } else {
    console.log('No changes written.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
