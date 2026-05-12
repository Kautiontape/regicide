/** Stable IDs for rule explanations the UI can show. Used by the guidance layer to track
 * how many times each rule has fired and to fade verbosity over time. */

export const RULE = {
	heartsHeal: 'heartsHeal',
	diamondsDraw: 'diamondsDraw',
	clubsDouble: 'clubsDouble',
	spadesShield: 'spadesShield',
	suitImmunity: 'suitImmunity',
	companion: 'companion',
	sameRankCombo: 'sameRankCombo',
	exactKill: 'exactKill',
	overkill: 'overkill',
	jesterAbility: 'jesterAbility',
	damagePhase: 'damagePhase',
	cantPay: 'cantPay'
} as const;

export type RuleId = (typeof RULE)[keyof typeof RULE];

export const RULE_TEXT: Record<RuleId, { short: string; long: string }> = {
	heartsHeal: {
		short: '♥ heal',
		long: '♥ Hearts heal: shuffle the discard pile, then place that many cards face-down under the tavern deck.'
	},
	diamondsDraw: {
		short: '♦ draw',
		long: '♦ Diamonds draw: draw that many cards (up to your hand limit). This is the only way to draw cards on a normal turn.'
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
		long: 'A royal is immune to its own suit. Cards of that suit still attack — the power just fizzles.'
	},
	companion: {
		short: 'animal companion',
		long: 'Animal Companion: an Ace pairs with any one other card. Both suit powers activate; damage is the sum.'
	},
	sameRankCombo: {
		short: 'same-rank combo',
		long: 'Same-rank combo: 2-4 cards of the same number that sum to 10 or less. All their suit powers activate.'
	},
	exactKill: {
		short: 'exact kill!',
		long: 'Exact kill: damage equalled remaining health. The defeated royal goes face-down on top of the tavern deck — your next ♦ draw is a known good card.'
	},
	overkill: {
		short: 'defeated',
		long: 'Defeated by overkill. The royal goes to the discard pile.'
	},
	jesterAbility: {
		short: 'jester ability',
		long: 'Jester (solo): discard your hand and refill from the tavern. One-shot — usable at the start of your turn or before taking damage.'
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
