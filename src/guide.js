// WHERE NEXT.  When a master falls whose death lights a sigil on a sealed door, the Lady comes to the Stranger and tells him where to go (Game.ladyGuides).  Which words depends on how far he has got: whether the
// other sigil already burns, and whether he holds what the road to it asks.  The words are the [guide ...] sections of assets/dialogue.txt (the ones here are only what is said if a section is missing there).
import * as D from './dialogue.js';
import { voiced } from './story.js';

const WORDS = {
  'guide sulphur': ['The Lady: One sigil burns on the chapel door, my love. The other is held by a wyrm under the ice, far below the city.', 'The Lady: Drop through the loose planks of Karluv Bridge. Leap twice as you fall, and let quicksilver carry you to the door in the pier.', 'The Lady: The keeper of the waters down there holds the fire that will melt your way to the ice.'],
  'guide sulphur fire': ['The Lady: One sigil burns on the chapel door. The other is held by the wyrm under the ice.', 'The Lady: Past the flooded gate of the Cistern stands a wall of ice. Burn it, and go down.'],
  'guide water': ['The Lady: One sigil burns on the chapel door. The other belongs to the steed that rides in the Great Hall.'],
  'guide chapel open': ['The Lady: Both sigils burn. The chapel door will open to you now.', 'The Lady: Between the Entrance Hall and the Portrait Gallery, draw back the grate, and go down to the foot of the Oubliette.'],
  'guide salt': ['The Lady: One sigil burns on the throne door. The other is the Hierophant\'s, who winds the great works of the clock.', 'The Lady: His road begins in Prague, behind the high door above Smouldering Lane, up through the Orloj Tower.'],
  'guide tin': ['The Lady: That door is locked. The Key of Tin lies at the top of the Bone Stair.'],
  'guide hierophant': ['The Lady: Father... what did you do? What had you become?'],
  'guide air': ['The Lady: One sigil burns on the throne door. The other is the Count\'s, who keeps his table in the Crypts.', 'The Lady: Their door is in the Barricaded Gallery. Burn the barricade, and go down.'],
  'guide throne open': ['The Lady: Both sigils burn on the throne door. It waits in the Throne Approach, below the Black Stair.', 'The Lady: Break the crystal that bars it with your lightning.'],
  'guide gold': ['The Lady: It is locked as well. The Librarian keeps the Key of Gold, at the top of the Index Stair.'],
  'guide earth': ['The Lady: The golem\'s seal is lit. The way on from the Boiler Loft is open to you.', 'The Lady: Go through to the clockwork. The one who winds it holds a sigil you will need.'],
};

// -> the sections to say, in order, for the master whose flag is `boss` ('boss_h4' ...); [] if there is nothing to say
export function guideSections(flags, boss) {
  const has = k => !!(flags['has_' + k] || flags['unlocked_' + k]);
  if (boss === 'boss_kb') return ['guide hierophant', ...(flags.boss_u3 ? ['guide throne open', ...(has('key_gold') ? [] : ['guide gold'])] : ['guide air'])];          // (he was her father: she speaks to him before she says anything of the road)
  if (boss === 'boss_h4') return flags.boss_ib ? ['guide chapel open'] : [flags.boss_qb ? 'guide sulphur fire' : 'guide sulphur'];
  if (boss === 'boss_ib') return [flags.boss_h4 ? 'guide chapel open' : 'guide water'];
  if (boss === 'boss_u3' && !flags.boss_kb) return ['guide salt', ...(has('key_crypt') ? [] : ['guide tin'])];
  if (boss === 'boss_u3') return ['guide throne open', ...(has('key_gold') ? [] : ['guide gold'])];
  if (boss === 'boss_og') return ['guide earth'];
  return [];
}
// -> [[who, words, font], ...] as Game.talk wants them, or null
export function guideLines(flags, boss) {
  const lines = guideSections(flags, boss).flatMap(k => D.lines(k) || WORDS[k] || []).map(voiced);
  return lines.length ? lines : null;
}
