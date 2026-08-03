/**
 * LinkedIn celebration frame — canvas composite.
 * Browser-only. SSOT for share caption + downloadable 1200×630.
 */
import { formatUsdFull } from '$lib/game';

function drawCover(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number,
	y: number,
	w: number,
	h: number
) {
	const ir = img.width / img.height;
	const tr = w / h;
	let sx = 0;
	let sy = 0;
	let sw = img.width;
	let sh = img.height;
	if (ir > tr) {
		sw = img.height * tr;
		sx = (img.width - sw) / 2;
	} else {
		sh = img.width / tr;
		sy = (img.height - sh) / 2;
	}
	ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function loadImg(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Image load failed'));
		img.src = src;
	});
}

/** Share caption — event + ZyetaI celebration. */
export function linkedInShareText(functionName: string, tokens: number, event = 'CoreNet'): string {
	return `We found common ground at ${event} with ZyetaI! ${functionName} · ${formatUsdFull(tokens)}. #WeFoundCommonGround #${event.replace(/\s+/g, '')} #ZyetaI`;
}

export function openLinkedInShare(pageUrl: string) {
	const shareUrl = encodeURIComponent(pageUrl);
	window.open(
		`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
		'_blank',
		'noopener,noreferrer'
	);
}

/**
 * Build 1200×630 PNG:
 *  - selfie (left) + primary AI workplace (right), or
 *  - if tableImages provided: selfie strip + mosaic of table/room renders
 */
export async function downloadLinkedInFrame(opts: {
	aiImageUrl: string;
	selfieDataUrl?: string;
	functionName: string;
	tokens: number;
	/** Event name for headline, header hashtag, and filename */
	event?: string;
	/** Optional extra table/room renders for mosaic strip under AI hero */
	tableImageUrls?: string[];
}): Promise<void> {
	const { aiImageUrl, selfieDataUrl, functionName, tokens, event = 'CoreNet', tableImageUrls = [] } = opts;
	const canvas = document.createElement('canvas');
	canvas.width = 1200;
	canvas.height = 630;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas unavailable');

	// Cream boardroom frame (brand)
	ctx.fillStyle = '#FDF8ED';
	ctx.fillRect(0, 0, 1200, 630);

	ctx.strokeStyle = '#B8932E';
	ctx.lineWidth = 6;
	ctx.strokeRect(12, 12, 1176, 606);

	// ZyetaI teal bar under gold frame
	ctx.fillStyle = '#1F8B78';
	ctx.fillRect(12, 12, 1176, 4);

	ctx.fillStyle = '#1F8B78';
	ctx.font = '700 16px ui-monospace, monospace';
	ctx.textAlign = 'left';
	ctx.fillText(`ZYETAI  ·  #WeFoundCommonGround  ·  #${event.replace(/\s+/g, '')}`, 40, 48);

	ctx.fillStyle = '#111A14';
	ctx.font = '700 44px "Playfair Display", Georgia, serif';
	ctx.fillText(`We found common ground at ${event}`, 40, 104);

	ctx.fillStyle = '#B8932E';
	ctx.font = '700 20px ui-monospace, monospace';
	ctx.fillText(`${functionName} · ${formatUsdFull(tokens)} · powered by ZyetaI`, 40, 138);

	const extras = tableImageUrls.filter(Boolean).slice(0, 6);
	const [aiImg, selfieImg, ...extraImgs] = await Promise.all([
		loadImg(aiImageUrl).catch(() => null),
		selfieDataUrl ? loadImg(selfieDataUrl).catch(() => null) : Promise.resolve(null),
		...extras.map((u) => loadImg(u).catch(() => null))
	]);

	const hasMosaic = extraImgs.some(Boolean);
	const mainH = hasMosaic ? 320 : 390;
	const mainY = 150;

	if (selfieImg) {
		drawCover(ctx, selfieImg, 40, mainY, 540, mainH);
	} else {
		// No selfie — leave a quiet empty well (no instruction copy in a downloaded artifact)
		ctx.fillStyle = 'rgba(17, 26, 20, 0.06)';
		ctx.fillRect(40, mainY, 540, mainH);
	}
	ctx.strokeStyle = 'rgba(31, 139, 120, 0.45)';
	ctx.lineWidth = 3;
	ctx.strokeRect(40, mainY, 540, mainH);

	if (!aiImg) {
		throw new Error('AI image blocked by CORS — use Expand and screenshot, or try again.');
	}
	drawCover(ctx, aiImg, 620, mainY, 540, mainH);
	ctx.strokeStyle = 'rgba(184, 147, 46, 0.5)';
	ctx.lineWidth = 3;
	ctx.strokeRect(620, mainY, 540, mainH);

	// Mosaic of other table workplaces (room-wide combination)
	if (hasMosaic) {
		const stripY = 490;
		const valid = extraImgs.filter((i): i is HTMLImageElement => !!i);
		const gap = 8;
		const n = Math.min(valid.length, 6);
		const cellW = (1120 - gap * (n - 1)) / n;
		valid.slice(0, n).forEach((img, i) => {
			const x = 40 + i * (cellW + gap);
			drawCover(ctx, img, x, stripY, cellW, 90);
			ctx.strokeStyle = 'rgba(17, 26, 20, 0.15)';
			ctx.lineWidth = 1;
			ctx.strokeRect(x, stripY, cellW, 90);
		});
	}

	ctx.fillStyle = '#5A6A5E';
	ctx.font = '700 13px ui-monospace, monospace';
	ctx.textAlign = 'right';
	ctx.fillText('ZyetaI · Imagine the future of the workplace', 1160, 600);

	const dataUrl = canvas.toDataURL('image/png');
	const link = document.createElement('a');
	link.download = `CommonGround_${functionName.replace(/\s+/g, '_')}_${event.replace(/\s+/g, '_')}.png`;
	link.href = dataUrl;
	link.click();
}
