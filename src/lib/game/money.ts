import { TOKEN_VALUE_USD } from './types';

/** Board cells hold value in $M; convert to raw USD. */
function tokensToUsd(valueM: number): number {
	return valueM * TOKEN_VALUE_USD;
}

/** Single-chip legend: "$10M". */
export function tokenUnitLabel(): string {
	return '$10M';
}

export function tableWalletLabel(tableCapValueM: number): string {
	return `${formatUsd(tableCapValueM)}`;
}

/** Compact $ from token counts via TOKEN_VALUE_USD. */
export function formatUsd(tokens: number): string {
	if (tokens <= 0) return '—';
	const usd = tokensToUsd(tokens);
	if (usd >= 1_000_000_000) {
		const b = usd / 1_000_000_000;
		return `$${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B`;
	}
	if (usd >= 1_000_000) {
		const m = usd / 1_000_000;
		return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
	}
	return `$${usd / 1_000}k`;
}

export function formatUsdFull(tokens: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0
	}).format(tokensToUsd(tokens));
}
