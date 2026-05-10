/** Stable IDs for rule explanations the UI can show. Used by the guidance layer to track
 * how many times each rule has fired and to fade verbosity over time. */

export const RULE = {
	heartsHeal: 'heartsHeal',
	diamondsDraw: 'diamondsDraw',
	clubsDouble: 'clubsDouble',
	spadesShield: 'spadesShield',
	suitImmunity: 'suitImmunity',
	immunityCancelled: 'immunityCancelled',
	companion: 'companion',
	sameRankCombo: 'sameRankCombo',
	exactKill: 'exactKill',
	overkill: 'overkill',
	yieldRule: 'yieldRule',
	jesterPlayed: 'jesterPlayed',
	jesterForcedPlay: 'jesterForcedPlay',
	damagePhase: 'damagePhase',
	cantPay: 'cantPay'
} as const;

export type RuleId = (typeof RULE)[keyof typeof RULE];

export const RULE_TEXT: Record<RuleId, { short: string; long: string }> = {
	heartsHeal: {
		short: '♥ heal',
		long: '♥ Hearts heal: shuffle that many cards from the discard pile back into the bottom of the tavern deck.'
	},
	diamondsDraw: {
		short: '♦ draw',
		long: '♦ Diamonds draw: draw that many cards (up to your hand limit). No discarding.'
	},
	clubsDouble: {
		short: '♣ ×2',
		long: '♣ Clubs double: this attack deals double damage to the royal.'
	},
	spadesShield: {
		short: '♠ shield',
		long: '♠ Spades shield: reduce the royal\'s attack by that much for the rest of this battle (stacks).'
	},
	suitImmunity: {
		short: 'immune',
		long: 'A royal is immune to its own suit. The power on a card matching the royal\'s suit does not activate.'
	},
	immunityCancelled: {
		short: 'immunity cancelled',
		long: 'A Jester has cancelled this royal\'s immunity for the rest of the battle. Suit powers now activate normally.'
	},
	companion: {
		short: 'animal companion',
		long: 'Animal Companion: an Ace pairs with any one other card. Both suit powers activate; damage is the sum.'
	},
	sameRankCombo: {
		short: 'same-rank combo',
		long: 'Same-rank combo: two or more cards of the same rank that sum to 10 or less. All their suit powers activate.'
	},
	exactKill: {
		short: 'exact kill!',
		long: 'Exact kill: damage equalled remaining health. The defeated royal goes face-down on top of the tavern deck — your next draw is a known good card.'
	},
	overkill: {
		short: 'defeated',
		long: 'Defeated by overkill. The royal goes to the discard pile.'
	},
	yieldRule: {
		short: 'yield',
		long: 'Yield: skip your attack and take the royal\'s counter-attack anyway. You cannot yield twice in a row in solo.'
	},
	jesterPlayed: {
		short: 'jester',
		long: 'Jester: deals 0 damage, takes 0 damage, and cancels the royal\'s immunity. In solo, your next play will be chosen at random from your hand.'
	},
	jesterForcedPlay: {
		short: 'forced play',
		long: 'After playing a Jester in solo, the enemy chooses for you: a card is selected at random from your hand and played.'
	},
	damagePhase: {
		short: 'take damage',
		long: 'The royal counter-attacks. Discard cards from your hand whose values sum to at least the damage. Shields reduce the damage.'
	},
	cantPay: {
		short: 'game over',
		long: 'You cannot discard enough to cover the damage. The royals win.'
	}
};
