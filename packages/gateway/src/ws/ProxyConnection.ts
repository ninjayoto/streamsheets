import IdGenerator from '@cedalo/id-generator';
import ServerConnection from './ServerConnection';
import WebSocket from 'ws';

import Auth from '../Auth';
import { getClientIdFromWebsocketRequest, getUserFromWebsocketRequest } from '../utils';
import { MessagingClient } from '@cedalo/messaging-client';
import { Topics, GatewayMessagingProtocol } from '@cedalo/protocols';
import { LoggerFactory } from '@cedalo/logger';
import SocketServer from './SocketServer';
import * as http from 'http';

const logger = LoggerFactory.createLogger('gateway - ProxyConnection', process.env.STREAMSHEETS_LOG_LEVEL || 'info');

const OPEN_CONNECTIONS: Set<ProxyConnection> = new Set();

interface MessageContext {
	user: User;
	message: WSRequest;
	connection: ProxyConnection;
	graphserver?: any;
	machineserver?: any;
}

// MachineServer client connection => analog for GraphServer?!
export default class ProxyConnection {
	id: string;
	user: User;
	clientId: null | string;
	private request: http.IncomingMessage;
	private clientsocket: WebSocket;
	private socketserver: SocketServer;
	private messagingClient: MessagingClient;
	private graphserver: ServerConnection;
	private machineserver: ServerConnection;
	private interceptor: any;

	static get openConnections() {
		return OPEN_CONNECTIONS;
	}

	static create(ws: WebSocket, request: http.IncomingMessage, user: User, socketserver: SocketServer) {
		// think: check if we already have a connection for this user...
		const connection = new ProxyConnection(ws, request, user, socketserver);
		ProxyConnection.openConnections.add(connection);
		return connection;
	}

	constructor(ws: WebSocket, request: http.IncomingMessage, user: User, socketserver: SocketServer) {
		this.id = IdGenerator.generateUUID();
		this.request = request;
		this.user = user;
		this.clientsocket = ws;
		this.socketserver = socketserver;
		this.messagingClient = new MessagingClient();
		this.messagingClient.connect(process.env.MESSAGE_BROKER_URL || 'mqtt://localhost:1883');
		this.graphserver = new ServerConnection('graphserver', 'graphs');
		this.machineserver = new ServerConnection('machineserver', 'machines');
		this.clientsocket.on('message', (message) => {
			const parsedMessage = JSON.parse(message.toString());
			if (parsedMessage.type === GatewayMessagingProtocol.MESSAGE_TYPES.CONFIRM_PROCESSED_MACHINE_STEP) {
				this.machineserver.confirmMachineStep(parsedMessage.machineId);
			}
		});

		this.graphserver.eventHandler = (ev) => this.onServerEvent(ev);
		this.machineserver.eventHandler = (ev) => this.onServerEvent(ev);
		this.messagingClient.subscribe(`${Topics.SERVICES_STREAMS_EVENTS}/#`);
		this.messagingClient.subscribe(`${Topics.SERVICES_AUTH_EVENTS}/#`);
		this.messagingClient.subscribe(`${Topics.SERVICES_PERSISTENCE_EVENTS}/#`);
		// TODO: register to a topic that will receive all events from web client - adapt topic structure
		this.messagingClient.on('message', (topic, message) => {
			if (
				topic.startsWith(Topics.SERVICES_STREAMS_EVENTS) &&
				(topic.endsWith('response') || topic.endsWith('functions'))
			) {
				return;
			}
			let msg = message.toString();
			try {
				msg = JSON.parse(msg);
			} catch (err) {
				logger.error(msg);
			}
			this.onServerEvent(msg);
		});
		this.interceptor = null;

		// listen to clients error/close:
		ws.on('close', () => {
			logger.info('Closing WebSocket');
			this.close();
		});
		ws.on('error', (error) => {
			logger.error('WebSocket error');
			logger.error(error);
			this.close();
		});
		ws.on('message', async (message) => {
			try {
				const msg = JSON.parse(message.toString());
				if (msg.type !== 'ping') {
					await this.updateConnectionState(ws);
					msg.session = this.session;
					if (msg.type === GatewayMessagingProtocol.MESSAGE_TYPES.USER_LOGOUT_MESSAGE_TYPE) {
						this.socketserver.logoutUser({
							user: this.user,
							msg
						});
					} else if (msg.topic && msg.topic.indexOf('stream') >= 0) {
						this.messagingClient.publish(msg.topic, msg);
					} else if (msg.topic && msg.topic.indexOf('persistence') >= 0) {
						this.messagingClient.publish(msg.topic, msg);
					} else {
						const response = await this.sendToServer(msg);
						this.sendToClient(response);
					}
				}
			} catch (err) {
				logger.warn(err);
			}
		});
		this.sendSessionToClient();
		this.sendServicesStatusToClient();
	}

	setUser(user: User) {
		this.user = user;
	}

	get session(): Session {
		const { id, user } = this;
		return {
			id,
			user: {
				id: user ? user.id : 'anon',
				roles: [],
				displayName: user ? [user.firstName, user.lastName].filter((e) => !!e).join(' ') || user.username : ''
			}
		};
	}

	async updateConnectionState(ws: WebSocket) {
		if (ws) {
			try {
				const user = await getUserFromWebsocketRequest(
					this.request,
					this.socketserver._config.tokenKey,
					Auth.parseToken.bind(Auth)
				);
				this.setUser(user);
			} catch (err) {
				logger.warn(err.name);
				this.user && this.socketserver.logoutUser({ user: this.user });
			}
		}
	}

	sendSessionToClient() {
		this.sendToClient({
			type: 'event',
			event: {
				type: GatewayMessagingProtocol.EVENTS.SESSION_INIT_EVENT,
				session: this.session
			}
		});
	}

	sendServicesStatusToClient() {
		// TODO: handle this more flexible
		this.sendToClient(this.socketserver.gatewayService.getServiceStatus('graphs'));
		this.sendToClient(this.socketserver.gatewayService.getServiceStatus('machines'));
	}

	onServerEvent(event: any) {
		switch (event.type) {
			case 'connect':
			case 'disconnect':
				logger.info(`${event.server}_${event.type}ed`);
				this.sendToClient({
					type: 'event',
					event: {
						type: `${event.server}_${event.type}ed`
					}
				});
				break;
			case 'event':
				this.sendToClient(event);
				break;
			case 'response':
				this.sendToClient(event);
				break;
			case 'message':
				this.sendToClient(event.data);
				break;
			case 'step':
				this.sendStepToClient(event.data);
				break;
			default:
			// logger.error(`unknown event type: ${event.type} send by ${event.server}`);
		}
	}

	connectGraphServer() {
		logger.info('Connecting to graph service');
		return this.graphserver.connect();
	}

	connectMachineServer() {
		logger.info('Connecting to machine service');
		return this.machineserver.connect();
	}

	createMessageContext(message: any): MessageContext {
		// if message is a string it should be an already stringified message!
		message = typeof message === 'string' ? JSON.parse(message) : message;
		return {
			user: this.user,
			message,
			connection: this
			// result: message.result || undefined
		};
	}

	async sendToServer(message: WSRequest) {
		const context = await this._beforeSendToServer(this.createMessageContext(message));
		const response: WSResponse = {
			type: 'response',
			requestId: context.message.requestId,
			requestType: context.message.type
			// TODO: Is this in use?
			// result: context.result || undefined
		};
		try {
			const machineServerResponse = await this._sendToMachineServer(context);
			response.machineserver = machineServerResponse && machineServerResponse.response;
		} catch (error) {
			logger.error(error);
			response.machineserver = {
				error: error.error || error
			};
		}
		try {
			const graphServerResponse = await this._sendToGraphServer(context);
			response.graphserver = graphServerResponse && graphServerResponse.response;
		} catch (error) {
			logger.error(error);
			response.graphserver = {
				error: error.error
			};
		}
		return response;
	}

	_beforeSendToServer(context: MessageContext) {
		return this.interceptor ? this.interceptor.beforeSendToServer(context) : Promise.resolve(context);
	}

	async _sendToGraphServer(context: MessageContext) {
		if (context.graphserver) {
			const graphServerResponse = await this.graphserver.send(context.message, context.message.requestId);
			if (graphServerResponse && graphServerResponse.requestType === 'command') {
				delete graphServerResponse.response.graph.graphdef;
			}
			return graphServerResponse;
		}
		return null;
	}

	_sendToMachineServer(context: MessageContext) {
		return !context.machineserver
			? Promise.resolve()
			: this.machineserver.send(context.message, context.message.requestId);
	}

	async sendStepToClient(stepMessage: EventData) {
		if (!this.clientsocket || this.clientsocket.readyState !== WebSocket.OPEN) {
			return;
		}
		this.socketserver.gatewayService.notifySendMessageToClient();
		this.clientsocket.send(stepMessage);
	}

	// called by proxy to send a message to client...
	async sendToClient(message: any) {
		try {
			const ctxt: MessageContext = await this._beforeSendToClient(this.createMessageContext(message));
			ctxt.message.session = this.session;
			this.clientsocket.send(JSON.stringify(ctxt.message));
		} catch (error) {
			logger.error('Failed to send message to client!', error);
		}
	}
	async _beforeSendToClient(context: MessageContext): Promise<MessageContext> {
		return new Promise((resolve /* , reject */) => {
			if (!this.clientsocket || this.clientsocket.readyState !== WebSocket.OPEN) {
				// reject(new Error('Client connection not established!'));
			} else {
				resolve(this.interceptor ? this.interceptor.beforeSendToClient(context) : context);
			}
		});
	}

	close() {
		this.socketserver.handleUserLeft(this.session);
		this.graphserver.disconnect();
		this.machineserver.disconnect();
		this.messagingClient.end();
		// remove connection:
		ProxyConnection.openConnections.delete(this);
		logger.info('closed & removed client connection...');
	}
}
