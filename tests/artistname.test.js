import { describe, it, expect } from 'vitest';
import { cleanArtistName } from '../fetcher/artistname.js';

describe('cleanArtistName leaves real names alone', () => {
  for (const name of [
    'Air Supply',
    'Dean Wareham',
    '5 Seconds of Summer',
    '1915',
    'This is Michael',
    'Stray Kids',
    'Fatboy Slim',
    'Earth, Wind & Fire',
    'Nick Cave and the Bad Seeds',
    'Florence + the Machine',
    'Simple Minds',
  ]) {
    it(`keeps "${name}"`, () => {
      expect(cleanArtistName(name)).toBe(name);
    });
  }
});

describe('cleanArtistName strips trailing dates', () => {
  it('strips a pipe-separated English day/month', () => {
    expect(cleanArtistName('Club 69 | 5 SEP')).toBe('Club 69');
  });

  it('strips a weekday plus day and month', () => {
    expect(cleanArtistName('DEEP SESSION #13 Sab 5 Sep')).toBe('DEEP SESSION #13');
  });

  it('strips a bare day and month', () => {
    expect(cleanArtistName('Mamba Clvb 11 Sep')).toBe('Mamba Clvb');
  });

  it('strips a Spanish "N de mes" tail', () => {
    expect(cleanArtistName('El Club de la Cumbia 4 de septiembre')).toBe('El Club de la Cumbia');
  });

  it('strips an uppercase month tail', () => {
    expect(cleanArtistName('DISTRITO produce 5 SEP')).toBe('DISTRITO produce');
  });

  it('strips a numeric dd.mm tail', () => {
    expect(cleanArtistName('Fiesta Caba 04.09')).toBe('Fiesta Caba');
  });
});

describe('cleanArtistName takes the headliner off a lineup', () => {
  it('takes the first act from a comma separated bill', () => {
    expect(cleanArtistName('Poseidotica, Sur Oculto, Mephistofeles, Frater, and Paso de Sombra'))
      .toBe('Poseidotica');
  });

  it('splits a b2b dj billing', () => {
    expect(cleanArtistName('doppel gangs b2b ygnacyo')).toBe('doppel gangs');
  });

  it('does not split a single comma, which is usually part of a name', () => {
    expect(cleanArtistName('Earth, Wind & Fire')).toBe('Earth, Wind & Fire');
  });
});

describe('cleanArtistName strips promo noise', () => {
  it('strips a trailing EN VIVO', () => {
    expect(cleanArtistName('GONDWANA EN VIVO')).toBe('GONDWANA');
  });

  it('strips a trailing tour tag with a year', () => {
    expect(cleanArtistName('CHINO SANCHEZ TOUR 2026')).toBe('CHINO SANCHEZ');
  });

  it('strips a trailing parenthetical country', () => {
    expect(cleanArtistName('CHINO SANCHEZ (ARGENTINA)')).toBe('CHINO SANCHEZ');
  });

  it('splits on a hyphen glued to the preceding word', () => {
    expect(cleanArtistName('TRINIDAD- SHOW')).toBe('TRINIDAD');
  });

  it('handles the glued hyphen with a long Spanish tail', () => {
    expect(cleanArtistName('Chinoy- concierto acústico junto a Julieta Díaz')).toBe('Chinoy');
  });

  it('collapses runs of whitespace', () => {
    expect(cleanArtistName('  Air   Supply  ')).toBe('Air Supply');
  });

  it('returns an empty string unchanged', () => {
    expect(cleanArtistName('')).toBe('');
  });

  it('never strips a name down to nothing', () => {
    expect(cleanArtistName('5 SEP')).toBe('5 SEP');
  });
});
