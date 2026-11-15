// SHADOWKEEP - THE STORY.  Every word the game speaks is in the plain text file assets/dialogue.txt (read by src/dialogue.js when the game starts), so it can be rewritten without touching the code.
// This file is only the story NOTES, and the frame that dialogue.js fills in.
//
// Prague, Bohemia, 1541 - the year of the great fire of Prague, when the Lesser Town and the Castle hill burned.  A castle has come up out of the earth in the countryside and taken the sun.  The monsters of the shadow realm
// walk.  A man known only as THE STRANGER kneels at a grave on a hill above the city - the grave of someone he loved (his wife? his sister? his lover? the game never says) - and watches
// Prague begin to burn.  He rises, draws SILBERZAHN, the silver tooth, and goes down to the city to put an end to Shadowkeep.
//
// She is still with him.  She is a ghost, pale and see-through, her lower half fading into nothing, and she is visible only in an arcane (BLUE) light.  Every gravestone and tablet he
// reads is her, speaking to him: advice about the road ahead, and what it is to be a ghost.  Her name, and what she was to him, are never said on the stones (the stone on the hill is worn smooth);
// they are told only by the six PAGES hidden in the castle (assets/letters/letter1..6.txt, src/letters.js): the Stranger was WENZEL, a Bohemian conscript at Katzianer's disastrous Hungarian campaign (Gorjani, 1537), who found
// the sword Silberzahn in the ice on the road home and married ZORA, the daughter of a Prague house of alchemists whose Great Work raised Shadowkeep.  She was killed by what it let loose; he left his name in her grave.
//
// The alchemists' Great Work has four stages - Nigredo (the blackening, death and rot), Albedo (the whitening, washing clean), Citrinitas (the yellowing) and Rubedo (the reddening, the sun).
// Shadowkeep is a Great Work gone wrong: its lord means to finish it by locking the Sun - gold, Sol - inside his furnace, the athanor, until all the world is still and incorruptible.
// The seven metals are the seven planets, so the six keys of the locked vaults are six metals (lead, iron, silver, tin, copper, mercury) and the Sun - gold, the Dawn - is what he stole.
//
// Most text is capital letters (the game's font); the gravestones and tablets are written in mixed case, because they are drawn in the face of the stones (Eroded Motta, which has no colon: they become dashes).  Lines for boxes are kept short.

export const STORY = {
  speaker: 'HER VOICE',          // (who speaks from the gravestones)
  // the rest is filled in from assets/dialogue.txt:
  opening: { title: '', sun: '', fire: '', sword: ['', ''] },
  chase: '', bell: [], lantern: [], convos: {}, tablets: {}, talk: {},
  ending: { title: '', lines: [] },
};
