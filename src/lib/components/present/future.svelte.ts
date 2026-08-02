/**
 * Future Workplace / ZyetaI pipeline UI state.
 */
import type { ZyetaIRunMode } from '$lib/game';

let progress = $state('');
let err = $state('');
let briefOpen = $state(false);
/** 0 = idle, 1–5 = active pipeline step */
let step = $state(0);
let regenOpen = $state(false);
/** Highest completed step this session (for pipeline UI) */
let completedThrough = $state(0);

export const futureUi = {
	get progress() {
		return progress;
	},
	set progress(v: string) {
		progress = v;
	},
	get err() {
		return err;
	},
	set err(v: string) {
		err = v;
	},
	get briefOpen() {
		return briefOpen;
	},
	set briefOpen(v: boolean) {
		briefOpen = v;
	},
	get step() {
		return step;
	},
	set step(v: number) {
		step = v;
	},
	get completedThrough() {
		return completedThrough;
	},
	set completedThrough(v: number) {
		completedThrough = v;
	},
	get regenOpen() {
		return regenOpen;
	},
	set regenOpen(v: boolean) {
		regenOpen = v;
	},
	openBrief() {
		briefOpen = true;
	},
	closeBrief() {
		briefOpen = false;
	},
	openRegen() {
		regenOpen = true;
	},
	closeRegen() {
		regenOpen = false;
	},
	clearErr() {
		err = '';
	},
	markStep(n: number) {
		step = n;
		if (n > completedThrough) completedThrough = n;
	},
	resetPipeline() {
		step = 0;
		completedThrough = 0;
		progress = '';
	}
};

export type { ZyetaIRunMode };
