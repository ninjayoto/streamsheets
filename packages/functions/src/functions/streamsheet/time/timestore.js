const { convert } = require('@cedalo/commons');
const { FunctionErrors } = require('@cedalo/error-codes');
const IdGenerator = require('@cedalo/id-generator');
const {	runFunction, terms: { hasValue } } = require('../../../utils');
const stateListener = require('./stateListener');

const ERROR = FunctionErrors.code;
const DEF_LIMIT = 1000;
const DEF_PERIOD = 60;

const insert = (entry, entries) => {
	let left = 0;
	let right = entries.length;
	const timestamp = entry.ts;
	while (left < right) {
		// eslint-disable-next-line no-bitwise
		const idx = (left + right) >>> 1;
		if (entries[idx].ts <= timestamp) left = idx + 1;
		else right = idx;
	}
	entries.splice(right, 0, entry);
	return entries;
};
const sizeFilter = (size) => (entries) => {
	if (entries.length > size) {
		entries.shift();
		return ERROR.LIMIT;
	}
	return true;
};
const periodFilter = (period) => (entries) => {
	const delta = entries[entries.length - 1].ts - entries[0].ts;
	if (delta > period) entries.shift();
};
class TimeStore {
	constructor(period, limit) {
		this.id = IdGenerator.generateShortId();
		this.entries = [];
		this.limit = limit;
		this.period = period;
		this.limitBySize = sizeFilter(limit);
		this.limitByPeriod = periodFilter(period * 1000);
		this.reset = this.reset.bind(this);
	}

	get size() {
		return this.entries.length;
	}

	reset() {
		this.entries = [];
	}

	values(key) {
		return this.entries.reduce((all, entry) => {
			if (entry.values.hasOwnProperty(key)) all.push(entry.values[key]);
			return all;
		}, []);
	}
	timestamps() {
		return this.entries.reduce((all, entry) => {
			all.push(entry.ts);
			return all;
		}, []);
	}

	push(ts, values) {
		insert({ ts, values }, this.entries);
		this.limitByPeriod(this.entries);
		return this.limitBySize(this.entries);
	}
}
const getTimeStore = (term, period, limit) => {
	if (!term._timestore || term._timestore.period !== period || term._timestore.limit !== limit) {
		term._timestore = new TimeStore(period, limit);
	}
	return term._timestore;
};

const store = (sheet, ...terms) =>
	runFunction(sheet, terms)
		.onSheetCalculation()
		.withMinArgs(1)
		.withMaxArgs(4)
		.mapNextArg((values) => values.value || ERROR.ARGS)
		.mapNextArg(period => hasValue(period) ? convert.toNumberStrict(period.value, ERROR.VALUE) : DEF_PERIOD)
		.mapNextArg(timestamp => timestamp != null && convert.toNumberStrict(timestamp.value))
		.mapNextArg(limit => hasValue(limit) ? convert.toNumberStrict(limit.value, ERROR.VALUE) : DEF_LIMIT)
		.run((values, period, timestamp, limit) => {
			const term = store.term;
			const timestore = getTimeStore(term, period, limit);
			stateListener.registerCallback(sheet, term, timestore.reset);
			return timestore.push(timestamp || Date.now(), values);
		});


module.exports = store;
