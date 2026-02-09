/**
 * Script to add baseItemId fields to inventory-form legendary items
 * in comprehensive_item_mapping.json by matching name_en fields
 * with legendary-gear-mapping.json
 */

const fs = require('fs');
const path = require('path');

const LEGENDARY_MAPPING_PATH = path.join(__dirname, '../legendary-gear-mapping.json');
const COMPREHENSIVE_MAPPING_PATH = path.join(__dirname, '../comprehensive_item_mapping.json');

function main() {
  console.log('Reading legendary-gear-mapping.json...');
  const legendaryGearMapping = JSON.parse(fs.readFileSync(LEGENDARY_MAPPING_PATH, 'utf8'));

  console.log('Reading comprehensive_item_mapping.json...');
  const comprehensiveMapping = JSON.parse(fs.readFileSync(COMPREHENSIVE_MAPPING_PATH, 'utf8'));

  // Build a map: name_en -> baseItemId from legendary-gear-mapping.json
  const nameToBaseId = new Map();
  for (const [baseId, item] of Object.entries(legendaryGearMapping)) {
    if (item.name_en && item.type_en === 'Legendary Gear') {
      nameToBaseId.set(item.name_en, baseId);
    }
  }
  console.log(`Found ${nameToBaseId.size} legendary items in legendary-gear-mapping.json`);

  // Add baseItemId to inventory-form legendaries in comprehensive mapping
  let updateCount = 0;
  // eslint-disable-next-line no-unused-vars
  for (const [itemId, item] of Object.entries(comprehensiveMapping)) {
    if (item.type_en === 'Legendary Gear' && item.name_en) {
      const baseId = nameToBaseId.get(item.name_en);
      if (baseId) {
        item.baseItemId = baseId;
        updateCount++;
      }
    }
  }

  console.log(`Added baseItemId to ${updateCount} inventory-form legendary items`);

  // Write updated comprehensive mapping back to file
  console.log('Writing updated comprehensive_item_mapping.json...');
  fs.writeFileSync(
    COMPREHENSIVE_MAPPING_PATH,
    JSON.stringify(comprehensiveMapping, null, 2),
    'utf8'
  );

  console.log('Done!');
  console.log(`\nSummary:`);
  console.log(`- Legendary base items: ${nameToBaseId.size}`);
  console.log(`- Updated inventory items: ${updateCount}`);
}

main();
