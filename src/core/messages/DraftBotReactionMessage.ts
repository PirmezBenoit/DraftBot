import {
	CommandInteraction,
	DMChannel,
	GuildEmoji,
	Message,
	MessageReaction,
	NewsChannel,
	ReactionCollector,
	TextBasedChannel,
	TextChannel,
	User
} from "discord.js";
import {CallbackLike, DraftBotReaction} from "./DraftBotReaction";
import {Constants} from "../Constants";
import {DraftBotEmbed} from "./DraftBotEmbed";
import {draftBotClient} from "../bot";

/**
 * Error thrown if the message has not been sent before
 */
const MESSAGE_NOT_SENT_ERROR = "Message has not been sent";

type ReactionInformation = {
	reactions: DraftBotReaction[],
	allowEnd: boolean,
	allowedUsersDiscordIdToReact: string[],
	maxReactions?: number,
	anyUserAllowed?: boolean,
}

/**
 * A class corresponding to a reaction message used in the bot
 */
export class DraftBotReactionMessage extends DraftBotEmbed {
	/**
	 * The list of reactions of the message
	 */
	private readonly _reactions: DraftBotReaction[];

	/**
	 * True if the collector allows the user to react with an "end" reaction
	 */
	private readonly _allowEnd: boolean;

	/**
	 * The ids used to filter the allowed reactions
	 * The ids are not checked if {@link _anyUserAllowed} is true
	 */
	private readonly _allowedUsersDiscordIdToReact: string[];

	/**
	 * A list used to retrieve the reactions quickly from name
	 */
	private _reactionsNames: string[];

	/**
	 * The callback called when the collector ends. Can be null
	 */
	private readonly _endCallback: CallbackLike;

	/**
	 * The max number of reactions the collector allows
	 */
	private readonly _maxReactions: number;

	/**
	 * A variable defining is any user can react to the message
	 */
	private readonly _anyUserAllowed: boolean;

	/**
	 * A variable which indicates the time of the collector
	 */
	private readonly _collectorTime: number;

	/**
	 * Default constructor
	 * @param reactionInformation
	 * @param endCallback
	 * @param collectorTime
	 */
	constructor(
		reactionInformation: ReactionInformation,
		endCallback: CallbackLike = null,
		collectorTime = 0) {
		super();
		this._reactions = reactionInformation.reactions;
		this._allowEnd = reactionInformation.allowEnd;
		this._allowedUsersDiscordIdToReact = reactionInformation.allowedUsersDiscordIdToReact;
		this._endCallback = endCallback;
		this._maxReactions = reactionInformation.maxReactions ?? 0;
		this._anyUserAllowed = reactionInformation.anyUserAllowed ?? false;
		this._collectorTime = collectorTime;
		this._reactionsNames = [];
		for (const reaction of reactionInformation.reactions) {
			this._reactionsNames.push(reaction.emote);
		}
	}

	/**
	 * The collector of the message
	 */
	private _collector: ReactionCollector = null;

	/**
	 * Returns the message collector
	 */
	get collector(): ReactionCollector {
		return this._collector;
	}

	/**
	 * The message sent
	 * @private
	 */
	private _sentMessage: Message;

	/**
	 * Returns the message that was sent
	 */
	get sentMessage(): Message {
		return this._sentMessage;
	}

	/**
	 * Reply to a command interaction
	 * @param interaction
	 * @param collectorCallback
	 */
	async reply(interaction: CommandInteraction, collectorCallback: (collector: ReactionCollector) => void = null): Promise<Message> {
		this._sentMessage = await interaction.reply({embeds: [this], fetchReply: true}) as Message;
		await this.collectAndReact(collectorCallback);
		return this._sentMessage;
	}

	/**
	 * edit the reply to a command interaction
	 * @param interaction
	 * @param collectorCallback
	 */
	async editReply(interaction: CommandInteraction, collectorCallback: (collector: ReactionCollector) => void = null): Promise<Message> {
		this._sentMessage = await interaction.editReply({embeds: [this]}) as Message;
		await this.collectAndReact(collectorCallback);
		return this._sentMessage;
	}

	/**
	 * Send the message to a channel
	 * @param channel
	 * @param collectorCallback The callback called when the collector is initialized. Often used to block the player
	 */
	async send(channel: TextChannel | DMChannel | NewsChannel | TextBasedChannel, collectorCallback: (collector: ReactionCollector) => void = null): Promise<Message> {
		this._sentMessage = await channel.send({embeds: [this]});
		await this.collectAndReact(collectorCallback);
		return this._sentMessage;
	}

	/**
	 * Stop the collector of the message
	 */
	stop(): void {
		if (!this._collector) {
			throw MESSAGE_NOT_SENT_ERROR;
		}
		this._collector.stop();
	}

	/**
	 * Get the first reaction of the message
	 * Can be null if there is no reaction
	 */
	getFirstReaction(): MessageReaction {
		if (!this._collector) {
			throw MESSAGE_NOT_SENT_ERROR;
		}
		return this._collector.collected.first();
	}

	/**
	 * Create the collector, add the reactions etc...
	 * @param collectorCallback
	 * @private
	 */
	private async collectAndReact(collectorCallback: (collector: ReactionCollector) => void = null): Promise<void> {

		const collectorFilter = (reaction: MessageReaction, user: User): boolean =>
			!user.bot &&
			(this._anyUserAllowed || this._allowedUsersDiscordIdToReact.indexOf(user.id) !== -1)
			&& (this._reactionsNames.indexOf(reaction.emoji.name) !== -1 || this._reactionsNames.indexOf(reaction.emoji.id) !== -1)
			|| reaction.emoji.name === Constants.REACTIONS.NOT_REPLIED_REACTION && this._allowEnd;

		this._collector = this._sentMessage.createReactionCollector({
			filter: collectorFilter,
			time: this._collectorTime <= 0 ? Constants.MESSAGES.COLLECTOR_TIME : this._collectorTime,
			max: this._maxReactions,
			dispose: true
		});

		if (collectorCallback) {
			collectorCallback(this._collector);
		}
		this._collector.on("collect", (reaction, user) => {
			const reactionName = this._reactionsNames.indexOf(reaction.emoji.id) !== -1 ? reaction.emoji.id : reaction.emoji.name;
			if (this._reactionsNames.indexOf(reactionName) === -1 || !this._reactions[this._reactionsNames.indexOf(reactionName)].callback) {
				// The reaction is an end reaction or the reaction has no callback associated
				this._collector.stop();
			}
			else {
				this._reactions[this._reactionsNames.indexOf(reactionName)].callback(this, reaction, user);
			}
		});
		this._collector.on("remove", (reaction, user) => {
			const reactionName = this._reactionsNames.indexOf(reaction.emoji.id) !== -1 ? reaction.emoji.id : reaction.emoji.name;
			const callback = this._reactions[this._reactionsNames.indexOf(reactionName)].removeCallback;
			if (callback) {
				callback(this, reaction, user);
			}
		});
		this._collector.on("end", () => {
			if (this._endCallback) {
				this._endCallback(this);
			}
		});
		for (const reaction of this._reactions) {
			try {
				await this._sentMessage.react(reaction.emote);
			}
			catch {
				const emoji = ((await draftBotClient.shard.broadcastEval((client, context) => {
					const emoji = client.emojis.cache.get(context.emote);
					if (emoji) {
						return emoji;
					}
				}, {
					context: {
						emote: reaction.emote
					}
				})) as GuildEmoji[]).filter(e => e)[0];
				await this._sentMessage.react(emoji.identifier);
			}
		}
	}
}

/**
 * Builder for {@link DraftBotReactionMessage}
 */
export class DraftBotReactionMessageBuilder {
	private _reactions: DraftBotReaction[] = [];

	private _allowEnd = false;

	private _allowedUsersDiscordIdToReact: string[] = [];

	private _endCallback: CallbackLike = null;

	private _maxReactions = 0;

	private _anyUserAllowed = false;

	private _collectorTime = 0;

	/**
	 * Allow a user to react to the message
	 * @param user
	 */
	allowUser(user: User): DraftBotReactionMessageBuilder {
		this._allowedUsersDiscordIdToReact.push(user.id);
		return this;
	}

	/**
	 * Allow a user id to react to the message
	 * @param id
	 */
	allowUserId(id: string): DraftBotReactionMessageBuilder {
		this._allowedUsersDiscordIdToReact.push(id);
		return this;
	}

	/**
	 * Add a reaction to the message
	 * @param reaction
	 */
	addReaction(reaction: DraftBotReaction): DraftBotReactionMessageBuilder {
		this._reactions.push(reaction);
		return this;
	}

	/**
	 * Set the callback when the message collector ends
	 * @param callback
	 */
	endCallback(callback: CallbackLike): DraftBotReactionMessageBuilder {
		this._endCallback = callback;
		return this;
	}

	/**
	 * Set the max reactions to the message
	 * @param max
	 */
	maxReactions(max: number): DraftBotReactionMessageBuilder {
		this._maxReactions = max;
		return this;
	}

	/**
	 * Allow any user to react to the message
	 */
	allowAnyUser(): DraftBotReactionMessageBuilder {
		this._anyUserAllowed = true;
		return this;
	}

	/**
	 * Allow the user to react with the end reaction
	 */
	allowEndReaction(): DraftBotReactionMessageBuilder {
		this._allowEnd = true;
		return this;
	}

	/**
	 * Indicate the time of the collector
	 * @param time
	 */
	collectorTime(time: number): DraftBotReactionMessageBuilder {
		this._collectorTime = time;
		return this;
	}

	/**
	 * Build the message
	 */
	build(): DraftBotReactionMessage {
		return new DraftBotReactionMessage(
			{
				reactions: this._reactions,
				allowEnd: this._allowEnd,
				allowedUsersDiscordIdToReact: this._allowedUsersDiscordIdToReact,
				maxReactions: this._maxReactions,
				anyUserAllowed: this._anyUserAllowed
			},
			this._endCallback,
			this._collectorTime);
	}
}