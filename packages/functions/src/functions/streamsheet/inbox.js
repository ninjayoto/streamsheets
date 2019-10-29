const ERROR = require('../errors');
const {runFunction, sheet: { getStreamSheet } } = require('../../utils');


const inbox = (sheet, ...terms) =>
	runFunction(sheet, terms)
		.withMaxArgs(2)
		.mapNextArg((term) => getStreamSheet(term, sheet) || ERROR.NO_STREAMSHEET)
		.mapNextArg((msgid) => (msgid ? msgid.value || '' : ''))
		.run((streamsheet, messageId) => `[${streamsheet.name}][${messageId}]`);

module.exports = inbox;
