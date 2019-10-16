// eslint-disable-next-line
const GatewayClientWorker = require('./GatewayClientWorker');

const logger = console;

const deletePendingRequest = (requestId, requests) => {
	const request = requests.get(requestId);
	if (request) {
		clearTimeout(request.timeoutId);
		requests.delete(requestId);
	}
	return request;
};
const timeoutHandler = (requestId, requests) => {
	const { reject } = deletePendingRequest(requestId, requests);
	reject({
		message: 'WebWorkerGatewayClientProxy: Timeout'
	});
};

// eslint-disable-next-line
module.exports = class WebWorkerGatewayClientProxy {
	constructor({ timeout = 500000 } = {}) {
		this._pendingRequests = new Map();
		this._eventListeners = new Map();
		this._workerInstance = new GatewayClientWorker();
		this.timeout = timeout;
		this._workerInstance.addEventListener('message', (event) => {
			this._handleMessage(event.data);
		});
	}

	on(event, listener) {
		let listeners = this._eventListeners.get(event);
		if (!listeners) {
			listeners = [];
			this._eventListeners.set(event, listeners);
		}
		listeners.push(listener);
	}

	off(event, listener) {
		const listeners = this._eventListeners.get(event);
		if (listeners) {
			const index = listeners.indexOf(listener);
			if (index > -1) {
				listeners.splice(index, 1);
			}
		}
	}

	connect(config) {
		return this._proxy('connect', config);
	}

	waitUntilAllServersAreConnected(timeout) {
		return this._proxy('waitUntilAllServersAreConnected', timeout);
	}

	executeStreamCommand(cmd) {
		return this._proxy('executeStreamCommand', cmd);
	}

	graphql(query, variables) {
		return this._proxy('graphql', query, variables);
	}

	getMachineDefinitions() {
		return this._proxy('getMachineDefinitions');
	}

	getMachineDefinitionsByName(name) {
		return this._proxy('getMachineDefinitionsByName', name);
	}

	getMachineDefinition(machineId) {
		return this._proxy('getMachineDefinition', machineId);
	}

	saveMachineDefinition(machine) {
		return this._proxy('saveMachineDefinition', machine);
	}

	updateMachineDefinition(machineId, machine) {
		return this._proxy('updateMachineDefinition', machineId, machine);
	}

	deleteMachineDefinition(machineId) {
		return this._proxy('deleteMachineDefinition', machineId);
	}

	exportMachineStreamDefinitions(machineIds, streamIds) {
		return this._proxy(
			'exportMachineStreamDefinitions',
			machineIds,
			streamIds
		);
	}

	importMachineDefinition(importData, importAsNew) {
		return this._proxy('importMachineDefinition', importData, importAsNew);
	}

	backup() {
		return this._proxy('backup');
	}

	restore(file) {
		return this._proxy('restore', file);
	}

	cloneMachine(machineId, newNameSuffix = 'Copy') {
		return this._proxy('cloneMachine', machineId, newNameSuffix);
	}

	/**
	 * *********************************************
	 * User Definition API
	 * *********************************************
	 */

	// TODO: deprecate when done
	login(credentials) {
		return this._proxy('login', credentials);
	}

	authenticate(authRequest) {
		return this._proxy('authenticate', authRequest);
	}

	logout(id) {
		return this._proxy('logout', id);
	}

	authEntityCreate(entity) {
		return this._proxy('authEntityCreate', entity);
	}

	authEntityGet(entity) {
		return this._proxy('authEntityGet', entity);
	}

	authEntityDelete(entity) {
		return this._proxy('authEntityDelete', entity);
	}

	authEntityUpdate(entity) {
		return this._proxy('authEntityUpdate', entity);
	}

	getUserSettings(userId) {
		return this._proxy('getUserSettings', userId);
	}

	saveUserSettings(userId, settings) {
		return this._proxy('saveUserSettings', userId, settings);
	}

	getUser(userId) {
		return this._proxy('getUser', userId);
	}

	saveUser(user) {
		return this._proxy('saveUser', user);
	}
	/**
	 * *********************************************
	 * Machine API
	 * *********************************************
	 */

	getMachine(machineId) {
		return this._proxy('getMachine', machineId);
	}

	getMachines() {
		return this._proxy('getMachines');
	}

	deleteMachine(machineId) {
		return this._proxy('deleteMachine', machineId);
	}

	deleteMachines() {
		return this._proxy('deleteMachines');
	}

	startAllMachines(singleMachineStartedCallback) {
		return this._proxy('startAllMachines', singleMachineStartedCallback);
	}

	stopAllMachines(singleMachineStoppedCallback) {
		return this._proxy('stopAllMachines', singleMachineStoppedCallback);
	}

	pauseAllMachines(singleMachinePausedCallback) {
		return this._proxy('pauseAllMachines', singleMachinePausedCallback);
	}

	deleteAllMachines(singleMachineDeletedCallback) {
		return this._proxy('deleteAllMachines', singleMachineDeletedCallback);
	}

	loadMachine(machineId, settings) {
		return this._proxy('loadMachine', machineId, settings);
	}

	unloadMachine(machineId, settings) {
		return this._proxy('unloadMachine', machineId, settings);
	}

	loadSubscribeMachine(machineId, settings) {
		return this._proxy('loadSubscribeMachine', machineId, settings);
	}

	pauseMachine(machineId) {
		return this._proxy('pauseMachine', machineId);
	}

	updateMachineImage(machineId, previewImage) {
		return this._proxy('updateMachineImage', machineId, previewImage);
	}

	renameMachine(machineId, newName) {
		return this._proxy('renameMachine', machineId, newName);
	}

	createStreamSheet(machineId, activeItemId, position) {
		return this._proxy(
			'createStreamSheet',
			machineId,
			activeItemId,
			position
		);
	}

	deleteStreamSheet(machineId, streamsheetId) {
		return this._proxy('deleteStreamSheet', machineId, streamsheetId);
	}

	updateStreamSheetStreams(machineId, streamsheetId, streams) {
		return this._proxy(
			'updateStreamSheetStreams',
			machineId,
			streamsheetId,
			streams
		);
	}

	confirmProcessedMachineStep(machineId) {
		return this._proxy('confirmProcessedMachineStep', machineId);
	}

	startMachine(machineId) {
		return this._proxy('startMachine', machineId);
	}

	stepMachine(machineId) {
		return this._proxy('stepMachine', machineId);
	}

	stopMachine(machineId) {
		return this._proxy('stopMachine', machineId);
	}

	startMachines() {
		return this._proxy('startMachines');
	}

	stopMachines() {
		return this._proxy('stopMachines');
	}

	subscribeMachine(machineId) {
		return this._proxy('subscribeMachine', machineId);
	}

	unsubscribeMachine(machineId) {
		return this._proxy('unsubscribeMachine', machineId);
	}

	saveMachineAs(originalMachineId, newName) {
		return this._proxy('saveMachineAs', originalMachineId, newName);
	}

	saveMachineAsTemplate(machineId, templateId, templateName) {
		return this._proxy(
			'saveMachineAsTemplate',
			machineId,
			templateId,
			templateName
		);
	}

	saveMachineCopy(originalMachineId, newName) {
		return this._proxy('saveMachineCopy', originalMachineId, newName);
	}

	setCycleTime(machineId, cycleTime) {
		return this._proxy('setCycleTime', machineId, cycleTime);
	}

	setMachineLocale(machineId, locale) {
		return this._proxy('setMachineLocale', machineId, locale);
	}

	setStreamSheetStepInterval(machineId, streamsheetStepInterval) {
		return this._proxy(
			'setStreamSheetStepInterval',
			machineId,
			streamsheetStepInterval
		);
	}

	redo(machineId) {
		return this._proxy('redo', machineId);
	}

	undo(machineId) {
		return this._proxy('undo', machineId);
	}

	updateMachineSettings(machineId, settings) {
		return this._proxy('updateMachineSettings', machineId, settings);
	}

	/**
	 * *********************************************
	 * General API
	 * *********************************************
	 */

	getMetaInformation() {
		return this._proxy('getMetaInformation');
	}

	/**
	 * *********************************************
	 * Template API
	 * *********************************************
	 */

	getTemplates() {
		return this._proxy('getTemplates');
	}

	getTemplate(templateId) {
		return this._proxy('getTemplate', templateId);
	}

	/**
	 * *********************************************
	 * Graph Definition API
	 * *********************************************
	 */

	getGraphs() {
		return this._proxy('getGraphs');
	}

	getGraph(graphId) {
		return this._proxy('getGraph', graphId);
	}

	saveGraph(graph) {
		return this._proxy('saveGraph', graph);
	}

	updateGraph(graphId, graph) {
		return this._proxy('updateGraph', graphId, graph);
	}

	deleteGraph(graphId) {
		return this._proxy('deleteGraph', graphId);
	}

	/**
	 * *********************************************
	 * Graph API
	 * *********************************************
	 */

	sendSelection(selection) {
		return this._proxy('sendSelection', selection);
	}

	sendCommand(machineId, graphId, command, undo, redo) {
		return this._proxy(
			'sendCommand',
			machineId,
			graphId,
			command,
			undo,
			redo
		);
	}

	/**
	 * *********************************************
	 * Administration API
	 * *********************************************
	 */

	saveDSConfiguration(configuration) {
		return this._proxy('saveDSConfiguration', configuration);
	}

	loadAllDSConfigurations() {
		return this._proxy('loadAllDSConfigurations');
	}

	deleteDSConfiguration(configId) {
		return this._proxy('deleteDSConfiguration', configId);
	}

	reloadStreams(sources) {
		return this._proxy('reloadStreams', sources);
	}

	// TOBE deprecated:

	saveConfiguration(configuration) {
		return this._proxy('saveConfiguration', configuration);
	}

	getAllConfigurations() {
		return this._proxy('getAllConfigurations');
	}

	getConfigurationsByType(configType) {
		return this._proxy('getConfigurationsByType', configType);
	}

	getConnectorConfigurations() {
		return this._proxy('getConnectorConfigurations');
	}

	getProviderConfigurations() {
		return this._proxy('getProviderConfigurations');
	}

	getStreamsConfigurations() {
		return this._proxy('getStreamsConfigurations');
	}

	getConfigurationById(configId) {
		return this._proxy('getConfigurationById', configId);
	}

	deleteConfigurationById(configId) {
		return this._proxy('deleteConfigurationById', configId);
	}

	streamsReload() {
		return this._proxy('streamsReload');
	}

	/**
	 * *********************************************
	 * Machine process settings API
	 * *********************************************
	 */
	saveMachineProcessSettings(settings) {
		return this._proxy('saveMachineProcessSettings', settings);
	}

	getMachineProcessSettings(machineId) {
		return this._proxy('getMachineProcessSettings', machineId);
	}

	/**
	 * ******************************************************************************************
	 * Low Level Proxy API
	 * ******************************************************************************************
	 */

	_proxy(method, ...args) {
		return this._send(
			{
				method,
				args: args || []
			},
			this._generateRequestId()
		);
	}

	_generateRequestId() {
		return Math.random();
	}

	_send(message, requestId) {
		// logger.info(`Sending message with id '${requestId}'`);
		return new Promise((resolve, reject) => {
			if (requestId) {
				message.requestId = requestId;
				this._pendingRequests.set(requestId, { resolve, reject });
				const timeoutId = setTimeout(
					() => timeoutHandler(requestId, this._pendingRequests),
					this.timeout
				);
				this._pendingRequests.set(requestId, {
					resolve,
					reject,
					timeoutId
				});
			} else {
				resolve();
			}
			// logger.info(`Send message for ${message.method}`);
			this._workerInstance.postMessage(message);
		});
	}

	_handleMessage(message) {
		// logger.info(`handle message: ${message.event ? message.event.type : message.type}`);

		const type = message.type;
		const request = deletePendingRequest(message.requestId, this._pendingRequests);

		if (request && type === 'response') {
			request.resolve(message.result);
		} else if (type === 'event') {
			this._handleEvent(message.event);
		} else if (request && type === 'error') {
			request.reject(message.error)
			// TODO: improve error handling!!
		}
	}

	_handleEvent(event) {
		const listeners = this._eventListeners.get(event.type) || [];
		listeners.forEach((listener) => listener(event));
	}
};
