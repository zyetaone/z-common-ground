/**
 * LinkedIn celebration frame — canvas composite (extracted from MobileRender).
 * Browser-only.
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

export function linkedInShareText(functionName: string, tokens: number): string {
	return `We found common ground! ${functionName} · ${tokens} tokens · ${formatUsdFull(tokens)}. #WeFoundCommonGround #CoreNet #ZyetaI`;
}

/** Open LinkedIn share-offsite (url only — caption must be copied separately). */
export function openLinkedInShare(pageUrl: string) {
	const shareUrl = encodeURIComponent(pageUrl);
	window.open(
		`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
		'_blank',
		'noopener,noreferrer'
	);
}

/**
 * Build 1200×630 PNG: selfie (left) + AI workplace (right).
 * Downloads via anchor click.
 */
export async function downloadLinkedInFrame(opts: {
	aiImageUrl: string;
	selfieDataUrl?: string;
	functionName: string;
	tokens: number;
}): Promise<void> {
	const { aiImageUrl, selfieDataUrl, functionName, tokens } = opts;
	const canvas = document.createElement('canvas');
	canvas.width = 1200;
	canvas.height = 630;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas unavailable');

	const grad = ctx.createLinearGradient(0, 0, 0, 630);
	grad.addColorStop(0, '#0A0F1A');
	grad.addColorStop(1, '#131B26');
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, 1200, 630);

	ctx.strokeStyle = '#E0A458';
	ctx.lineWidth = 6;
	ctx.strokeRect(12, 12, 1176, 606);

	ctx.fillStyle = '#E0A458';
	ctx.font = 'bold 22px monospace';
	ctx.textAlign = 'left';
	ctx.fillText('#WEFOUNDCOMMONGROUND  ·  #CORENET', 40, 56);

	ctx.fillStyle = '#FFFFFF';
	ctx.font = 'bold 34px sans-serif';
	ctx.fillText(`${functionName} · Common Ground`, 40, 102);

	ctx.fillStyle = '#37B6A2';
	ctx.font = 'bold 18px monospace';
	ctx.fillText(`${tokens} tokens · ${formatUsdFull(tokens)}`, 40, 134);

	const [aiImg, selfieImg] = await Promise.all([
		loadImg(aiImageUrl).catch(() => null),
		selfieDataUrl ? loadImg(selfieDataUrl).catch(() => null) : Promise.resolve(null)
	]);

	if (selfieImg) {
		drawCover(ctx, selfieImg, 40, 160, 550, 390);
	} else {
		ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
		ctx.fillRect(40, 160, 550, 390);
		ctx.fillStyle = '#E0A458';
		ctx.font = 'bold 22px sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('Add selfie for full frame', 315, 355);
	}
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
	ctx.lineWidth = 3;
	ctx.strokeRect(40, 160, 550, 390);

	if (!aiImg) {
		throw new Error('AI image blocked by CORS — use Expand and screenshot, or try again.');
	}
	drawCover(ctx, aiImg, 620, 160, 540, 390);
	ctx.strokeStyle = 'rgba(224, 164, 88, 0.45)';
	ctx.lineWidth = 3;
	ctx.strokeRect(620, 160, 540, 390);

	ctx.fillStyle = '#E0A458';
	ctx.font = 'bold 16px monospace';
	ctx.textAlign = 'right';
	ctx.fillText('Powered by ZyetaI', 1160, 590);

	const dataUrl = canvas.toDataURL('image/png');
	const link = document.createElement('a');
	link.download = `CommonGround_${functionName.replace(/\s+/g, '_')}_Moment.png`;
	link.href = dataUrl;
	link.click();
}
