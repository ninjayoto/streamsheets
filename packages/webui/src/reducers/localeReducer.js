import { DEFAULT_LOCALE } from '../languages/translations';
import { SETUP_LOCALE, USER_SETTING_SET, USER_FETCHED, USER_LOGIN_RESPONSE } from '../constants/ActionTypes';

const defaultState = {
	locale: DEFAULT_LOCALE,
};

const localeFromUser = (user) => user && user.settings && user.settings.locale;

const localeReducer = (state = defaultState, action) => {
	switch (action.type) {
		case SETUP_LOCALE: {
			const { locale } = action;
			return {
				locale,
			};
		}
		case USER_SETTING_SET: {
			const locale = localeFromUser({ settings: action.settings }) || state.locale;
			return {
				locale,
			};
		}
		case USER_FETCHED: {
			const user = Array.isArray(action.user) ? action.user[0] : action.user;
			const locale = localeFromUser(user) || state.locale;
			return {
				locale,
			};
		}
		case USER_LOGIN_RESPONSE: {
			const { user } = action.response;
			const locale = localeFromUser(user) || state.locale;
			return {
				locale,
			};
		}

		default:
			return state;
	}
};

export default localeReducer;
