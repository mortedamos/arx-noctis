// HER FAREWELL, and the ending's closing words.  What she says at the grave grows with the PAGES found in this game: everyone hears her thanks and her sorrow for her father; each Page adds a line of its own
// (Page 2 gives the line about her father more to say); with all six she gives him back his name, and the closing narration uses it.  The words are the [farewell ...] and [ending ...] sections of
// assets/dialogue.txt (the ones here are only what is said if a section is missing there).
import * as D from './dialogue.js';
import { voiced } from './story.js';
import { savePages, PAGE_COUNT } from './letters.js';

const WORDS = {
  'farewell': ['The Lady: Look. The sun still knows the way up.', 'The Lady: You went all the way up that keep for me. Thank you.'],
  'farewell father': ['The Lady: I am so sorry for what my father did.'],
  'farewell page 1': ['The Lady: Complain about the soup now and then. I will keep the window open.'],
  'farewell page 2': ['The Lady: My father only wanted nothing ever to die. I saw his furnace, and I could not stop him.'],
  'farewell page 3': ['The Lady: That sword was in the ice before any of our sorrow. If you had never taken it up, would we still... No. I will not leave you with that.'],
  'farewell page 4': ['The Lady: Your sergeant still wants to know if you are eating. Find him. Do not be alone.'],
  'farewell page 5': ['The Lady: I wrote that I could not be happier. It was true. Keep that day, not the steps.'],
  'farewell page 6': ['The Lady: You told the night you would not stop. You can stop now.'],
  'farewell all pages': ['The Lady: You left your name in my grave. Take it back, Wenzel.'],
  'farewell last': ['The Lady: Let me go now, my love.'],
};
const ORDER = [5, 6, 3, 4, 1];          // (after her father: the days, his vow, the sword, the friend, the window)

// which sections she says, in order, for the Pages held (a Set of page numbers)
export function farewellSections(pages) {
  return ['farewell', pages.has(2) ? 'farewell page 2' : 'farewell father', ...ORDER.filter(n => pages.has(n)).map(n => 'farewell page ' + n), ...(pages.size >= PAGE_COUNT ? ['farewell all pages'] : []), 'farewell last'];
}
// everything the ending needs to know, from the save: how many Pages, her lines ([who, words, font] as a Dialog wants them), the narration after she has gone, and (short of all six) the card that says so
export function farewell(S) {
  const pages = savePages(S), all = pages.size >= PAGE_COUNT;
  const narr = D.fields(all ? 'ending wenzel' : 'ending after'), after = (narr && narr.LINE) || (all ? ['WENZEL RISES, AND GOES DOWN TO THE CITY.', 'THE SWORD GOES WITH HIM.'] : ['THE STRANGER RISES FROM THE GRAVE.', 'THE SWORD COMES WITH HIM.']);
  const card = all ? null : (D.lines('ending more') || ['{FOUND} OF {TOTAL} PAGES FOUND.', 'SHE HAS MORE TO SAY.']).map(l => l.replace('{FOUND}', pages.size).replace('{TOTAL}', PAGE_COUNT));
  return { pages, all, after, card, lines: farewellSections(pages).flatMap(k => D.lines(k) || WORDS[k] || []).map(voiced) };
}
