import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./output/pokemon_names.json', 'utf8'));

// Create a reverse lookup: name → index
const nameToIndex = {};
data.names.forEach((entry, idx) => {
  nameToIndex[entry.name] = idx + 1; // 1-based index
});

// All 151 Pokemon in Pokedex order
const pokedexOrder = [
  'BULBASAUR', 'IVYSAUR', 'VENUSAUR', 'CHARMANDER', 'CHARMELEON', 'CHARIZARD', 'SQUIRTLE', 'WARTORTLE', 'BLASTOISE', 'CATERPIE',
  'METAPOD', 'BUTTERFREE', 'WEEDLE', 'KAKUNA', 'BEEDRILL', 'PIDGEY', 'PIDGEOTTO', 'PIDGEOT', 'RATTATA', 'RATICATE',
  'SPEAROW', 'FEAROW', 'EKANS', 'ARBOK', 'PIKACHU', 'RAICHU', 'SANDSHREW', 'SANDSLASH', 'NIDORANF', 'NIDORINA',
  'NIDOQUEEN', 'NIDORANM', 'NIDORINO', 'NIDOKING', 'CLEFAIRY', 'CLEFABLE', 'VULPIX', 'NINETALES', 'JIGGLYPUFF', 'WIGGLYTUFF',
  'ZUBAT', 'GOLBAT', 'ODDISH', 'GLOOM', 'VILEPLUME', 'PARAS', 'PARASECT', 'VENONAT', 'VENOMOTH', 'DIGLETT',
  'DUGTRIO', 'MEOWTH', 'PERSIAN', 'PSYDUCK', 'GOLDUCK', 'MANKEY', 'PRIMEAPE', 'GROWLITHE', 'ARCANINE', 'POLIWAG',
  'POLIWHIRL', 'POLIWRATH', 'ABRA', 'KADABRA', 'ALAKAZAM', 'MACHOP', 'MACHOKE', 'MACHAMP', 'BELLSPROUT', 'WEEPINBELL',
  'VICTREEBEL', 'TENTACOOL', 'TENTACRUEL', 'GEODUDE', 'GRAVELER', 'GOLEM', 'PONYTA', 'RAPIDASH', 'SLOWPOKE', 'SLOWBRO',
  'MAGNEMITE', 'MAGNETON', "FARFETCH'D", 'DODUO', 'DODRIO', 'SEEL', 'DEWGONG', 'GRIMER', 'MUK', 'SHELLDER',
  'CLOYSTER', 'GASTLY', 'HAUNTER', 'GENGAR', 'ONIX', 'DROWZEE', 'HYPNO', 'KRABBY', 'KINGLER', 'VOLTORB',
  'ELECTRODE', 'EXEGGCUTE', 'EXEGGUTOR', 'CUBONE', 'MAROWAK', 'HITMONLEE', 'HITMONCHAN', 'LICKITUNG', 'KOFFING', 'WEEZING',
  'RHYHORN', 'RHYDON', 'CHANSEY', 'TANGELA', 'KANGASKHAN', 'HORSEA', 'SEADRA', 'GOLDEEN', 'SEAKING', 'STARYU',
  'STARMIE', 'MR.MIME', 'SCYTHER', 'JYNX', 'ELECTABUZZ', 'MAGMAR', 'PINSIR', 'TAUROS', 'MAGIKARP', 'GYARADOS',
  'LAPRAS', 'DITTO', 'EEVEE', 'VAPOREON', 'JOLTEON', 'FLAREON', 'PORYGON', 'OMANYTE', 'OMASTAR', 'KABUTO',
  'KABUTOPS', 'AERODACTYL', 'SNORLAX', 'ARTICUNO', 'ZAPDOS', 'MOLTRES', 'DRATINI', 'DRAGONAIR', 'DRAGONITE', 'MEWTWO',
  'MEW'
];

// Generate mapping array
const mapping = pokedexOrder.map(name => nameToIndex[name.replace('.', ' ')]);

console.log('// Mapping from Pokedex number (1-151) to name index (1-190)');
console.log('export const POKEDEX_TO_NAME_INDEX = [');
for (let i = 0; i < mapping.length; i += 10) {
  const chunk = mapping.slice(i, i + 10);
  console.log('  ' + chunk.join(', ') + (i + 10 < mapping.length ? ',' : ''));
}
console.log('];');

console.log('\n\n// Verification:');
for (let i = 0; i < Math.min(20, mapping.length); i++) {
  console.log(`// Pokedex #${i+1}: ${pokedexOrder[i]} → Index ${mapping[i]}`);
}
