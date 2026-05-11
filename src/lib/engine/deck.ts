import type { Card, Rank, Royal, Suit } from './types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const NUMBER_RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export function rankValue(rank: Rank | 'JESTER'): number {
	if (rank === 'JESTER') return 0;
	if (rank === 'A') return 1;
	if (rank === 'J') return 10;
	if (rank === 'Q') return 15;
	if (rank === 'K') return 20;
	return parseInt(rank, 10);
}

export function royalHealth(rank: 'J' | 'Q' | 'K'): number {
	return rank === 'J' ? 20 : rank === 'Q' ? 30 : 40;
}

function cardId(suit: Suit, rank: Rank): string {
	const r = rank === '10' ? 'T' : rank;
	const s = suit[0].toUpperCase();
	return `${r}${s}`;
}

/** Tavern deck: A-10 of all four suits. Ace=1. Solo Jesters live off to the side as one-shot
 *  abilities and are never shuffled into the tavern. */
export function buildTavernDeck(): Card[] {
	const cards: Card[] = [];
	for (const suit of SUITS) {
		for (const rank of NUMBER_RANKS) {
			cards.push({ id: cardId(suit, rank), suit, rank, value: rankValue(rank) });
		}
	}
	return cards;
}

/** Castle deck: J(shuffled), Q(shuffled), K(shuffled), stacked Js on top → Ks on bottom.
 * `shuffle` is supplied so callers can use a seeded RNG. */
export function royalAttack(rank: 'J' | 'Q' | 'K'): number {
	return rank === 'J' ? 10 : rank === 'Q' ? 15 : 20;
}

export function buildCastleDeck(shuffle: <T>(arr: T[]) => T[]): Royal[] {
	const make = (rank: 'J' | 'Q' | 'K'): Royal[] =>
		shuffle(
			SUITS.map((suit): Royal => ({
				id: cardId(suit, rank),
				suit,
				rank,
				value: rankValue(rank),
				attack: royalAttack(rank),
				maxHealth: royalHealth(rank),
				damageTaken: 0
			}))
		);
	// Order: top of array = top of deck = first to fight. Jacks first.
	return [...make('J'), ...make('Q'), ...make('K')];
}

/** Mulberry32 PRNG — seedable, deterministic, plenty of quality for shuffling 54 cards. */
export function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function shuffleWith(rand: () => number) {
	return <T>(arr: T[]): T[] => {
		const out = arr.slice();
		for (let i = out.length - 1; i > 0; i--) {
			const j = Math.floor(rand() * (i + 1));
			[out[i], out[j]] = [out[j], out[i]];
		}
		return out;
	};
}
