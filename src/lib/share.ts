import { dailyNumber } from './daily';
import { formatDuration, tierFor, type GameRecord } from './history';

const TIER_LABEL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' } as const;
const TOTAL_ROYALS = 12;
/** Where a shared result sends people. Per-build, because the right answer differs
 *  by host: the itch archive should advertise the itch page (tools/itch-package.sh
 *  sets this), and a self-hosted build should advertise its own domain.
 *
 *  TODO: the default still carries the pre-rename hostname. It works, so it stays
 *  until a paper-crowns host is pointed at the same build — a share line to a dead
 *  domain would be a worse trade than an old name. */
export const SHARE_URL = import.meta.env.VITE_SHARE_URL ?? 'https://regicide.kautiontape.com';

/** Build the spoiler-free Wordle-style share text for a finished run. Layout:
 *    L1: header line — "Paper Crowns" + (Daily #N | Run) + tier (won only)
 *    L2: outcome — "12/12 royals · 14T · 6:32" or "8/12 royals · fell to Q♥"
 *    L3 (optional): assist marks — 📖 tutorial, 🔁 retry
 *    L4: SHARE_URL
 *  Cards are intentionally not enumerated so dailies stay surprising for late-day players. */
export function buildShareText(record: GameRecord, lastEnemy?: string): string {
	const lines: string[] = [];
	lines.push(headerLine(record));
	lines.push(outcomeLine(record, lastEnemy));
	const marks = assistMarks(record);
	if (marks) lines.push(marks);
	lines.push(SHARE_URL);
	return lines.join('\n');
}

function headerLine(record: GameRecord): string {
	const parts: string[] = ['Paper Crowns'];
	if (record.mode === 'daily' && record.dailyDate) {
		parts.push(`Daily #${dailyNumber(record.dailyDate)}`);
	}
	const tier = tierFor(record);
	if (tier && record.outcome === 'won') parts.push(`★ ${TIER_LABEL[tier]}`);
	return parts.join(' ');
}

function outcomeLine(record: GameRecord, lastEnemy?: string): string {
	if (record.outcome === 'won') {
		return `${TOTAL_ROYALS}/${TOTAL_ROYALS} royals · ${record.turns}T · ${formatDuration(record.elapsedMs)}`;
	}
	const fell = lastEnemy ? ` · fell to ${lastEnemy}` : '';
	return `${record.royalsDefeated}/${TOTAL_ROYALS} royals${fell}`;
}

function assistMarks(record: GameRecord): string | null {
	const marks: string[] = [];
	if (record.tutorial) marks.push('📖 tutorial assist');
	if (record.attemptCount > 1) marks.push(`🔁 attempt ${record.attemptCount}`);
	return marks.length === 0 ? null : marks.join(' · ');
}

/** Try the Web Share API; fall back to clipboard. Returns 'shared' if the native sheet was
 *  used, 'copied' if we wrote to the clipboard, or 'failed' if neither path worked. */
export async function shareOrCopy(text: string): Promise<'shared' | 'copied' | 'failed'> {
	if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
		try {
			await navigator.share({ text });
			return 'shared';
		} catch (err) {
			// AbortError = user dismissed the share sheet; do NOT fall back to copy in that
			// case (silent paste behind their back is creepy). Real failures fall through.
			if (err instanceof Error && err.name === 'AbortError') return 'failed';
		}
	}
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return 'copied';
		} catch {
			// Fall through to the legacy path rather than giving up. On itch this is
			// the normal case, not an edge case — see legacyCopy.
		}
	}
	return legacyCopy(text) ? 'copied' : 'failed';
}

/** execCommand('copy') via an offscreen textarea. Deprecated, and still the only
 *  copy that works inside itch.io's game iframe.
 *
 *  itch embeds HTML games cross-origin with
 *  allow="autoplay; fullscreen *; geolocation; microphone; camera; midi;
 *  monetization; xr-spatial-tracking; gamepad; gyroscope; accelerometer; xr;
 *  cross-origin-isolated; web-share"
 *
 *  — note `web-share` is granted but `clipboard-write` is not, so the async
 *  Clipboard API throws NotAllowedError there. navigator.share covers the
 *  platforms that implement Web Share (Android, Windows, macOS, ChromeOS); on
 *  desktop Linux and in Firefox it doesn't exist, and without this the share
 *  button does nothing at all on itch. execCommand is governed by user
 *  activation instead of a permissions-policy feature, so it survives.
 *
 *  Only reachable from a click handler; it returns false without one. */
function legacyCopy(text: string): boolean {
	if (typeof document === 'undefined') return false;
	const ta = document.createElement('textarea');
	ta.value = text;
	// Off-screen rather than hidden: the selection has to be real for the copy
	// to pick anything up, so display:none and visibility:hidden both break it.
	ta.setAttribute('readonly', '');
	ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0;pointer-events:none';
	document.body.appendChild(ta);
	try {
		ta.select();
		ta.setSelectionRange(0, text.length);
		return document.execCommand('copy');
	} catch {
		return false;
	} finally {
		ta.remove();
	}
}
