import {DraftBotReactionMessage} from "./DraftBotReactionMessage";
import {DraftBotReaction} from "./DraftBotReaction";
import {TranslationModule, Translations} from "../Translations";
import {Constants} from "../Constants";
import {CommandInteraction, User} from "discord.js";
import {DraftBotValidateReactionMessage} from "./DraftBotValidateReactionMessage";
import {format} from "../utils/StringFormatter";
import {sendErrorMessage} from "../utils/ErrorUtils";
import {NumberChangeReason} from "../constants/LogsConstants";
import {Players} from "../database/game/models/Player";

/**
 * Reasons when the shop ends
 */
export enum ShopEndReason {
	/**
	 * The player didn't react and the collector ends
	 */
	TIME,
	/**
	 * The player reacted with cancel
	 */
	REACTION,
	/**
	 * The player tried to buy something, but he doesn't have enough money
	 */
	NOT_ENOUGH_MONEY,
	/**
	 * The player tried to buy something but at the last moment chose to cancel
	 */
	REFUSED_CONFIRMATION,
	/**
	 * The player bought an item successfully
	 */
	SUCCESS
}

export class DraftBotShopMessage extends DraftBotReactionMessage {

	private readonly _getUserMoney: (userId: string) => Promise<number>;

	private readonly _interaction: CommandInteraction;

	private readonly _removeUserMoney: (userId: string, amount: number) => Promise<void>;

	private readonly _shopEndCallback: (message: DraftBotShopMessage, reason: ShopEndReason) => void;

	private readonly _shopItems: ShopItem[];

	private readonly _shopItemReactions: string[];

	private readonly _language: string;

	private readonly _translationModule: TranslationModule;

	/**
	 * Default constructor
	 * @param shopItemCategories
	 * @param language
	 * @param title
	 * @param interaction
	 * @param currentMoney
	 * @param getUserMoney
	 * @param removeUserMoney
	 * @param shopEndCallback
	 * @param translationPosition
	 */
	// eslint-disable-next-line max-params
	constructor(
		shopItemCategories: ShopItemCategory[],
		language: string,
		title: string,
		interaction: CommandInteraction,
		currentMoney: number,
		getUserMoney: (userId: string) => Promise<number>,
		removeUserMoney: (userId: string, amount: number) => Promise<void>,
		shopEndCallback: (message: DraftBotShopMessage, reason: ShopEndReason) => void,
		translationPosition: string
	) {
		const translationModule = Translations.getModule(translationPosition, language);
		const reactions: DraftBotReaction[] = [];
		const shopItems: ShopItem[] = [];
		const shopItemReactions: string[] = [];
		let content = "";
		for (const shopItemCategory of shopItemCategories) {
			content += `**${shopItemCategory.categoryTitle}${language === Constants.LANGUAGE.ENGLISH ? "" : " "}:**\n`;
			for (const shopItem of shopItemCategory.items) {
				content += format(translationModule.get("display"), {
					emote: shopItem.emote,
					name: shopItem.name,
					price: shopItem.price
				}) + "\n";
				const emoji = shopItem.emote.includes("<") ? shopItem.emote.split(":")[2].replace(">", "") : shopItem.emote;
				reactions.push(new DraftBotReaction(emoji));
				shopItems.push(shopItem);
				shopItemReactions.push(shopItem.emote);
			}
			content += "\n";
		}
		reactions.push(new DraftBotReaction(Constants.REACTIONS.REFUSE_REACTION));
		content += format(translationModule.get("moneyQuantity"), {
			money: currentMoney
		});
		super(
			{
				reactions,
				allowEnd: false,
				allowedUsersDiscordIdToReact: [interaction.user.id]
			}, DraftBotShopMessage.shopCallback
		);
		this.setTitle(title);
		this.setDescription(content);
		this._getUserMoney = getUserMoney;
		this._interaction = interaction;
		this._removeUserMoney = removeUserMoney;
		this._shopEndCallback = shopEndCallback;
		this._shopItems = shopItems;
		this._shopItemReactions = shopItemReactions;
		this._language = language;
		this._translationModule = translationModule;
	}

	get user(): User {
		return this._interaction.user;
	}

	get language(): string {
		return this._language;
	}

	private static async shopCallback(this: void, msg: DraftBotReactionMessage): Promise<void> {
		const shopMessage = msg as DraftBotShopMessage;
		const choseShopItem = shopMessage.getChoseShopItem(msg);
		if (!choseShopItem) {
			await sendErrorMessage(
				shopMessage.user,
				shopMessage._interaction,
				shopMessage.language,
				shopMessage._translationModule.get("error.leaveShop"),
				true);
			shopMessage._shopEndCallback(shopMessage, msg.getFirstReaction() ? ShopEndReason.REACTION : ShopEndReason.TIME);
			return;
		}
		const userMoney = await shopMessage.getUserMoney();
		if (userMoney < choseShopItem.price) {
			await sendErrorMessage(
				shopMessage.user,
				shopMessage._interaction,
				shopMessage._language,
				format(
					shopMessage._translationModule.get("error.cannotBuy"),
					{
						missingMoney: choseShopItem.price - userMoney
					}
				)
			);
			shopMessage._shopEndCallback(shopMessage, ShopEndReason.NOT_ENOUGH_MONEY);
			return;
		}
		if (choseShopItem.amounts.length === 1 && choseShopItem.amounts[0] === 1) {
			const confirmBuyMessage = new DraftBotValidateReactionMessage(
				shopMessage.user,
				async (reactionMessage) => {
					const validateMessage = reactionMessage as DraftBotValidateReactionMessage;
					if (validateMessage.isValidated()) {
						shopMessage._shopEndCallback(shopMessage, ShopEndReason.SUCCESS);
						const removeMoney = await choseShopItem.buyCallback(shopMessage, 1);
						if (removeMoney) {
							await shopMessage.removeUserMoney(choseShopItem.price);
						}
					}
					else {
						await sendErrorMessage(
							shopMessage.user,
							shopMessage._interaction,
							shopMessage.language,
							shopMessage._translationModule.get("error.canceledPurchase"),
							true
						);
						shopMessage._shopEndCallback(shopMessage, ShopEndReason.REFUSED_CONFIRMATION);
					}
				}
			);
			confirmBuyMessage.formatAuthor(shopMessage._translationModule.get("confirm"), shopMessage.user);
			confirmBuyMessage.setDescription(`${format(shopMessage._translationModule.get("display"), {
				emote: choseShopItem.emote,
				name: choseShopItem.name,
				price: choseShopItem.price
			})}\n\n${Constants.REACTIONS.WARNING} ${choseShopItem.description}`);
			await confirmBuyMessage.send(shopMessage.sentMessage.channel);
			return;
		}
		const numberReactions: DraftBotReaction[] = [];
		const prices: number[] = [];
		for (let i = 0; i < choseShopItem.amounts.length; ++i) {
			const amount = choseShopItem.amounts[i];
			const numberEmote: string = Constants.REACTIONS.NUMBERS[amount];
			const total = amount * choseShopItem.price;
			if (amount < 0 || amount > 10 || choseShopItem.amounts.indexOf(amount) < i || userMoney < total) {
				continue;
			}
			numberReactions.push(new DraftBotReaction(numberEmote, (reactionMessage: DraftBotReactionMessage) => {
				shopMessage._shopEndCallback(shopMessage, ShopEndReason.SUCCESS);
				choseShopItem.buyCallback(shopMessage, amount).then(async (result) => {
					if (result) {
						await shopMessage.removeUserMoney(total);
					}
					reactionMessage.stop();
				});
			}));
			prices.push(total);
		}
		numberReactions.push(new DraftBotReaction(
			Constants.REACTIONS.REFUSE_REACTION,
			(reactionMessage: DraftBotReactionMessage): void => {
				reactionMessage.stop();
				sendErrorMessage(
					shopMessage.user,
					shopMessage._interaction,
					shopMessage.language,
					shopMessage._translationModule.get("error.canceledPurchase"),
					true
				).then(() => shopMessage._shopEndCallback(shopMessage, ShopEndReason.REFUSED_CONFIRMATION));
			}
		));
		const confirmBuyMessage = new DraftBotReactionMessage(
			{
				reactions: numberReactions,
				allowEnd: false,
				allowedUsersDiscordIdToReact: [shopMessage.user.id]
			}
		);
		confirmBuyMessage.formatAuthor(shopMessage._translationModule.get("confirm"), shopMessage.user);
		let desc = format(shopMessage._translationModule.get("multipleChoice.display"), {
			emote: choseShopItem.emote,
			name: choseShopItem.name
		});
		for (const price of prices) {
			desc += format(shopMessage._translationModule.get("multipleChoice.priceDisplay"), {
				price
			});
		}
		desc += `\n\n${choseShopItem.description}\n\n${Constants.REACTIONS.WARNING} ${shopMessage._translationModule.get("multipleChoice.warning")}`;
		confirmBuyMessage.setDescription(desc);
		await confirmBuyMessage.send(shopMessage.sentMessage.channel);
	}

	/**
	 * Get how much money the user have
	 * @private
	 */
	private async getUserMoney(): Promise<number> {
		return await this._getUserMoney(this._interaction.user.id);
	}

	/**
	 * Get which item from the shop got chosen
	 * @param msg
	 * @private
	 */
	private getChoseShopItem(msg: DraftBotReactionMessage): ShopItem {
		if (!msg.getFirstReaction()) {
			return null;
		}
		const reaction = msg.getFirstReaction().emoji;
		const emoji = !reaction.id ? reaction.name : `<:${reaction.name}:${reaction.id}>`;
		const index = this._shopItemReactions.indexOf(emoji);
		if (index === -1) {
			return null;
		}
		return this._shopItems[index];
	}

	/**
	 * Remove an amount of money to the user corresponding to the one needed to buy the shop item
	 * @param amount
	 * @private
	 */
	private async removeUserMoney(amount: number): Promise<void> {
		return await this._removeUserMoney(this._interaction.user.id, amount);
	}
}

/**
 * Builder for a shop
 */
export class DraftBotShopMessageBuilder {
	private _shopItemCategories: ShopItemCategory[] = [];

	private readonly _interaction: CommandInteraction;

	private readonly _title: string;

	private readonly _language: string;

	private _noShoppingCart = false;

	private _translationPosition = "commands.shop";

	/**
	 * Default constructor
	 * @param interaction
	 * @param title The title of the shop
	 * @param language The language of the shop
	 */
	constructor(
		interaction: CommandInteraction,
		title: string,
		language: string
	) {
		this._interaction = interaction;
		this._title = title;
		this._language = language;
	}

	/**
	 * Add a shop category
	 * @param category
	 */
	addCategory(category: ShopItemCategory): DraftBotShopMessageBuilder {
		if (!category || category.items.length === 0 || category.items.filter(item => item !== null && item).length === 0) {
			return this;
		}
		this._shopItemCategories.push(category);
		return this;
	}

	/**
	 * Remove the shopping cart icon before the title of the shop
	 */
	noShoppingCart(): DraftBotShopMessageBuilder {
		this._noShoppingCart = true;
		return this;
	}

	setTranslationPosition(position: string): DraftBotShopMessageBuilder {
		this._translationPosition = position;
		return this;
	}

	/**
	 * The callback called when the shp ends
	 * @param callback
	 */
	endCallback(callback: (message: DraftBotShopMessage, reason: ShopEndReason) => void): DraftBotShopMessageBuilder {
		this._shopEndCallback = callback;
		return this;
	}

	/**
	 * Set the function which get the money from the player
	 * To be used in the case the money is not the base game money (ex: points)
	 * It MUST query the player from the database or whatever each time this function is called in order to prevent problems of concurrent modifications
	 * @param getUserMoney
	 */
	setGetUserMoney(getUserMoney: (userId: string) => Promise<number>): DraftBotShopMessageBuilder {
		this._getUserMoney = getUserMoney;
		return this;
	}

	/**
	 * Set the function which removes money from the player
	 * To be used in the case the money is not the base game money (ex: points)
	 * It MUST query the player from the database or whatever each time this function is called in order to prevent problems of concurrent modifications
	 * @param removeUserMoney
	 */
	setRemoveUserMoney(removeUserMoney: (userId: string, amount: number) => Promise<void>): DraftBotShopMessageBuilder {
		this._removeUserMoney = removeUserMoney;
		return this;
	}

	/**
	 * Build the shop message
	 */
	async build(): Promise<DraftBotShopMessage> {
		return new DraftBotShopMessage(
			this._shopItemCategories,
			this._language,
			`${this._noShoppingCart ? this._title : `${Constants.REACTIONS.SHOPPING_CART} ${this._title}`}${this._language === Constants.LANGUAGE.ENGLISH ? "" : " "}:`,
			this._interaction,
			await this._getUserMoney(this._interaction.user.id),
			this._getUserMoney,
			this._removeUserMoney,
			this._shopEndCallback,
			this._translationPosition
		);
	}

	private _getUserMoney: (userId: string) => Promise<number> = async (userId) => (await Players.getOrRegister(userId))[0].money;

	private _removeUserMoney: (userId: string, amount: number) => Promise<void> = async (userId, amount) => {
		const [player] = await Players.getOrRegister(userId);
		await player.addMoney({
			amount: -amount,
			channel: null, // It is negative, so we don't care about the channel and language
			language: "",
			reason: NumberChangeReason.SHOP
		});
		await player.save();
	};

	private _shopEndCallback: (message: DraftBotShopMessage, reason: ShopEndReason) => void = () => { /* do nothing */
	};
}

/**
 * An item in the shop
 */
export class ShopItem {
	private readonly _emote: string;

	private readonly _name: string;

	private readonly _price: number;

	private readonly _buyCallback: (message: DraftBotShopMessage, amount: number) => Promise<boolean>;

	private readonly _description: string;

	private readonly _amounts: number[];

	/**
	 * Default constructor
	 * @param emote The emote of the shop item
	 * @param name The name of the shop item
	 * @param price The price of the shop item (for x1)
	 * @param description The description of the shop item
	 * @param buyCallback The callback called when this item is try to be bought
	 * It must return false if the purchase failed in order not to remove money from the player, and true if bought with success
	 * @param amounts The possible amounts for this item
	 */
	constructor(emote: string, name: string, price: number, description: string, buyCallback: (message: DraftBotShopMessage, amount: number) => Promise<boolean>, amounts = [1]) {
		this._emote = emote;
		this._name = name;
		this._price = price;
		this._buyCallback = buyCallback;
		this._description = description;
		this._amounts = amounts;
	}

	get emote(): string {
		return this._emote;
	}

	get name(): string {
		return this._name;
	}

	get price(): number {
		return this._price;
	}

	get buyCallback(): (message: DraftBotShopMessage, amount: number) => Promise<boolean> {
		return this._buyCallback;
	}

	get description(): string {
		return this._description;
	}

	get amounts(): number[] {
		return this._amounts;
	}
}

/**
 * A category of the shop
 */
export class ShopItemCategory {
	private readonly _items: ShopItem[];

	private readonly _categoryTitle: string;

	/**
	 * Default constructor
	 * @param items The items in the category
	 * @param categoryTitle The title of the category
	 */
	constructor(items: ShopItem[], categoryTitle: string) {
		this._items = items;
		this._categoryTitle = categoryTitle;
	}

	get items(): ShopItem[] {
		return this._items;
	}

	get categoryTitle(): string {
		return this._categoryTitle;
	}
}