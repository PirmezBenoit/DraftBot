import {Constants} from "../Constants";
import {ItemConstants} from "./ItemConstants";

export abstract class SmallEventConstants {
	static readonly HEALTH = {
		MIN: 1,
		MAX: 4
	};

	static readonly EXPERIENCE = {
		MIN: 10,
		MAX: 35
	};

	static readonly SHOP = {
		MAX_RARITY: ItemConstants.RARITY.SPECIAL,
		SCAM_PROBABILITY: 0.1,
		BASE_MULTIPLIER: 0.6,
		SCAM_MULTIPLIER: 5,
		RESALE_MULTIPLIER: 0.1
	};

	static readonly GUILD_EXPERIENCE = {
		MIN: 20,
		MAX: 80
	};

	static readonly VOTE = {
		MONEY: {
			MIN: 150,
			MAX: 250
		}
	};

	static readonly SMALL_BAD = {
		HEALTH: {
			MIN: 1,
			MAX: 5
		},

		TIME: {
			MIN: 1,
			MAX: 24
		},

		MONEY: {
			MIN: 10,
			MAX: 50
		}
	};

	static readonly BIG_BAD = {
		HEALTH: {
			MIN: 5,
			MAX: 30
		},

		MONEY: {
			MIN: 50,
			MAX: 250
		}
	};

	static readonly CLASS = {
		MONEY: {
			MIN: 50,
			MAX: 150
		},

		HEALTH: {
			MIN: 1,
			MAX: 5
		}
	};

	static readonly LOTTERY = {
		REWARDS: {
			EXPERIENCE: 40,
			MONEY: 50,
			GUILD_EXPERIENCE: 70,
			POINTS: 35
		},

		REWARD_TYPES: {
			XP: "xp",
			MONEY: "money",
			GUILD_XP: "guildXp",
			POINTS: "points"
		}
	};

	static readonly ULTIMATE_FOOD_MERCHANT = {
		MINIMUM_LEVEL_GOOD_PLAYER: 30,
		MONEY_WON_NO_GUILD: 20,
		ULTIMATE_FOOD: {
			MULTIPLIER: 3,
			VARIATION: 1
		},
		COMMON_FOOD: {
			MULTIPLIER: 6,
			VARIATION: 4
		}
	};

	static readonly GOBLETS_GAME = {
		TIME_LOST: {
			BASE: 6,
			VARIATION: 5,
			LEVEL_MULTIPLIER: 0.42
		},

		HEALTH_LOST: {
			BASE: 5,
			VARIATION: 3,
			LEVEL_MULTIPLIER: 1 / 6,
			END_LEVEL_MULTIPLIER: 1 / 4
		}
	};

	static readonly WITCH = {
		ACTION_TYPE: {
			NOTHING: 0,
			ADVICE: 1,
			INGREDIENT: 2
		},
		BASE_LIFE_POINTS_REMOVED_AMOUNT: 5,
		OUTCOME_TYPE: {
			BASE: 0,
			POTION: 1,
			EFFECT: 2,
			HEALTH_LOSS: 3,
			NOTHING: 4
		},
		NO_EFFECT_CHANCE: 0.25,
		MIN_PROBABILITY: 1,
		MAX_PROBABILITY: 51
	};

	static readonly INTERACT_OTHER_PLAYERS = {
		COIN_EMOTE: "🪙"
	};

	static readonly FIND_ITEM = {
		MAXIMUM_RARITY: ItemConstants.RARITY.EPIC
	};

	static readonly FIND_PET = {
		FOOD_GIVEN_NO_PLACE: Constants.PET_FOOD.CARNIVOROUS_FOOD
	};

	static readonly PET = {
		MONEY: {
			MIN: 20,
			MAX: 70
		},

		HEALTH: {
			MIN: 1,
			MAX: 5
		},

		LOVE_POINTS: {
			MIN: 1,
			MAX: 3
		},

		TIME: {
			MIN: 5,
			MAX: 20
		},

		POINTS: {
			MIN: 20,
			MAX: 70
		},
		ENERGY: {
			MIN: 10,
			MAX: 250
		}
	};
}