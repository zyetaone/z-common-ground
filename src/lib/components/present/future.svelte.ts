/**
 * Future Workplace screen UI state (co-located with FutureWorkspace.svelte).
 */
let progress = $state('');
let err = $state('');
let briefOpen = $state(false);

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
	openBrief() {
		briefOpen = true;
	},
	closeBrief() {
		briefOpen = false;
	},
	clearErr() {
		err = '';
	}
};
