const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Smash characters list for variety
const characters = [
  'Mario', 'Donkey Kong', 'Link', 'Samus', 'Dark Samus', 'Yoshi', 'Kirby', 'Fox',
  'Pikachu', 'Luigi', 'Ness', 'Captain Falcon', 'Jigglypuff', 'Peach', 'Daisy',
  'Bowser', 'Ice Climbers', 'Sheik', 'Zelda', 'Dr. Mario', 'Pichu', 'Falco',
  'Marth', 'Lucina', 'Young Link', 'Ganondorf', 'Mewtwo', 'Roy', 'Chrom',
  'Mr. Game & Watch', 'Meta Knight', 'Pit', 'Dark Pit', 'Zero Suit Samus',
  'Wario', 'Snake', 'Ike', 'Pokemon Trainer', 'Diddy Kong', 'Lucas', 'Sonic',
  'King Dedede', 'Olimar', 'Lucario', 'R.O.B.', 'Toon Link', 'Wolf',
  'Villager', 'Mega Man', 'Wii Fit Trainer', 'Rosalina & Luma', 'Little Mac',
  'Greninja', 'Mii Brawler', 'Mii Swordfighter', 'Mii Gunner', 'Palutena',
  'Pac-Man', 'Robin', 'Shulk', 'Bowser Jr.', 'Duck Hunt', 'Ryu', 'Ken',
  'Cloud', 'Corrin', 'Bayonetta', 'Inkling', 'Ridley', 'Simon', 'Richter',
  'King K. Rool', 'Isabelle', 'Incineroar', 'Piranha Plant', 'Joker', 'Hero',
  'Banjo & Kazooie', 'Terry', 'Byleth', 'Min Min', 'Steve', 'Sephiroth',
  'Pyra', 'Mythra', 'Kazuya', 'Sora'
];

// Sample player names for test data
const playerNames = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho',
  'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega', 'Striker',
  'Phoenix', 'Shadow', 'Blaze', 'Storm', 'Frost', 'Thunder', 'Lightning',
  'Viper', 'Falcon', 'Eagle', 'Wolf', 'Tiger', 'Dragon', 'Phoenix',
  'Ninja', 'Samurai', 'Warrior', 'Knight', 'Paladin', 'Mage', 'Archer',
  'Hunter', 'Ranger', 'Scout', 'Champion'
];

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seedData() {
  console.log('🌱 Starting to seed match data...');

  try {
    // First, get or create some players
    const playersToCreate = playerNames.slice(0, 25); // Use first 25 names
    
    console.log('👥 Creating/finding players...');
    const players = [];
    
    for (const name of playersToCreate) {
      let player = await prisma.players.findUnique({
        where: { name }
      });
      
      if (!player) {
        player = await prisma.players.create({
          data: {
            name,
            display_name: name,
            elo: BigInt(getRandomInt(1000, 1500)),
            is_ranked: Math.random() > 0.3, // 70% chance of being ranked
            top_10_players_played: getRandomInt(0, 8)
          }
        });
      }
      
      players.push(player);
    }
    
    console.log(`✅ Found/created ${players.length} players`);

    // Create matches with realistic dates (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    console.log('⚔️ Creating matches...');
    const matchesToCreate = 150; // This should be enough to test pagination
    
    for (let i = 0; i < matchesToCreate; i++) {
      // Create a match
      const match = await prisma.matches.create({
        data: {
          created_at: getRandomDate(thirtyDaysAgo, now)
        }
      });

      // Determine if it's 1v1 or multiplayer (60% chance of 1v1)
      const is1v1 = Math.random() > 0.4;
      const participantCount = is1v1 ? 2 : getRandomInt(3, 8);
      
      // Select random participants
      const selectedPlayers = [];
      const availablePlayers = [...players];
      
      for (let j = 0; j < participantCount; j++) {
        const randomIndex = Math.floor(Math.random() * availablePlayers.length);
        selectedPlayers.push(availablePlayers.splice(randomIndex, 1)[0]);
      }
      
      // Determine winner (first participant wins)
      const winnerIndex = 0;
      
      // Create match participants
      for (let j = 0; j < selectedPlayers.length; j++) {
        const player = selectedPlayers[j];
        const isWinner = j === winnerIndex;
        
        await prisma.match_participants.create({
          data: {
            match_id: match.id,
            player: player.id,
            smash_character: getRandomElement(characters),
            is_cpu: false,
            total_kos: isWinner ? getRandomInt(3, 12) : getRandomInt(0, 8),
            total_falls: getRandomInt(0, 5),
            total_sds: getRandomInt(0, 2),
            has_won: isWinner,
            created_at: match.created_at
          }
        });
      }
      
      if (i % 25 === 0) {
        console.log(`📊 Created ${i + 1}/${matchesToCreate} matches...`);
      }
    }
    
    console.log(`🎉 Successfully created ${matchesToCreate} matches with participants!`);
    console.log('🔄 You should now be able to test the "Load More Matches" functionality');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedData();