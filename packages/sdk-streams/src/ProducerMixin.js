const { ERRORS, EVENTS } = require('./Constants');
const ProducerConfiguration = require('./configurations/ProducerConfiguration');
const Stream = require('./Stream');
const Utils = require('./helpers/Utils');
const RequestResponse = require('./helpers/RequestResponse');

const DEF_CONF = {
	type: Stream.TYPE.PRODUCER
};

const ProducerMixin = (Connector) =>
	class Producer extends Connector {
		constructor(cfg = {}) {
			cfg = Object.assign({}, DEF_CONF, cfg);
			super(cfg);
		}

		defineLifeCycle() {
			this.on(ProducerMixin.EVENTS.CONNECT, async () => {
				if (this.ready === false) {
					try {
						this.logger.debug(
							`Connector ${this.toString()} initialize() start`
						);
						if (typeof this.initialize === 'function') {
							await this.initialize();
						}
						this.ready = true;
						this.logger.debug(
							`Connector ${this.toString()} initialize() done`
						);
						this._emitter.emit(ProducerMixin.EVENTS.READY);
						return true;
					} catch (err) {
						return this.handleError(
							err,
							ERRORS.FAILEDTOINITIALIZE,
							this
						);
					}
				}
				return false;
			});
			if (typeof this.test === 'function' && process.env.DL_CONSUMER_TEST) {
				this.on(ProducerMixin.EVENTS.READY, async () => {
					try {
						this.logger.info(
							`Starting test() for ${this.config.name}`
						);
						const result = await this._test();
						if (!result) {
							throw new Error(ERRORS.FAILEDTOTEST);
						}
						this.logger.info(`test() for ${this.config.name} pass`);
						this._emitter.emit(ProducerMixin.EVENTS.TEST, result);
					} catch (error) {
						this._emitter.emit(ProducerMixin.EVENTS.TEST, error);
						this.handleError(error, ERRORS.FAILEDTOTEST, this);
					}
				});
			}
		}

		// Lifecycle
		async _produce(config) {
			try {
				if (this._connected) {
					const { message } = config;
					let result;
					try {
						const transformedMessage = Utils.transformFromJSONObject(
							message,
							this.config.mimeType
						);
						const newConfig = {
							...config,
							message: transformedMessage,
							messageObject: message
						};
						this.logger.debug(`${this.toString()} produces`);
						result = await this.produce(newConfig);
						this._emitter.emit(
							Producer.EVENTS.PRODUCE,
							result || newConfig
						);
					} catch (e) {
						this.handleErrorOnce(e);
					}
				}
				return config;
			} catch (e) {
				this._dispose();
				return this.handleErrorOnce(e);
			}
		}

		async _request(config) {
			this._emitter.emit(Producer.EVENTS.REQUEST, config);
			try {
				const res = await this.request(config);
				if (res) {
					if (res instanceof RequestResponse) {
						return res.toJSON();
					}
					this.logger.warn(
						`${this.toString()} sends not expected RequestResponse`
					);
					return res;
				}
				throw new Error('Empty result message');
			} catch (e) {
				this.handleError(e);
				throw e;
			}
		}

		async update(configDiff) {
			const { type, $set } = configDiff;
			try {
				if (type === ProducerConfiguration.NAME) {
					Object.keys($set).forEach((id) => {
						this.config[id] = $set[id];
					});
					if ($set.filter !== undefined) {
						this.config.filter = $set.filter;
					}
					if ($set.labelAttribute !== undefined) {
						this.config.labelAttribute = $set.labelAttribute;
					}
					if ($set.idAttribute !== undefined) {
						this.config.idAttribute = $set.idAttribute;
					}
				}
				return super.update(configDiff);
			} catch (e) {
				this.logger.error(e);
				return false;
			}
		}
	};

ProducerMixin.EVENTS = {
	...EVENTS.CONNECTOR,
	...EVENTS.PRODUCER
};
module.exports = ProducerMixin;
