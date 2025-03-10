import {error} from "console";
import {BaseGuildTextChannel, CommandInteraction, TextBasedChannel, User} from "discord.js";
import {DraftBotEmbed} from "../messages/DraftBotEmbed";
import {TranslationModule, Translations} from "../Translations";
import {draftBotClient} from "../bot";
import {NotificationsConstants} from "../constants/NotificationsConstants";
import {format} from "./StringFormatter";
import Player from "../database/game/models/Player";
import {Constants} from "../Constants";

export type TextInformation = { interaction: CommandInteraction, language: string, tr?: TranslationModule }

/**
 * Generate a notification embed
 * @param player
 */
export async function generateTravelNotification(player: Player = null): Promise<DraftBotEmbed> {
	const embed = new DraftBotEmbed().setTitle(Translations.getModule("commands.notifications", Constants.LANGUAGE.ENGLISH).get("title"));
	if (player) {
		embed.setDescription(`${
			Translations.getModule("commands.report", Constants.LANGUAGE.ENGLISH).format("newBigEvent", {destination: (await player.getDestination()).getDisplayName(Constants.LANGUAGE.ENGLISH)})
		}\n\n${
			Translations.getModule("commands.report", Constants.LANGUAGE.FRENCH).format("newBigEvent", {destination: (await player.getDestination()).getDisplayName(Constants.LANGUAGE.FRENCH)})
		}`);
	}
	return embed;
}

/**
 * Send a dm to a user
 * @param {User} user
 * @param {DraftBotEmbed} embed - The embed to send
 * @param {("fr"|"en")} language - Language to use in the response
 * @param DirectMessageFooter - Add the dmMessage footer
 */
export function sendDirectMessage(user: User, embed: DraftBotEmbed, language: string, DirectMessageFooter = true): void {
	if (DirectMessageFooter) {
		embed.setFooter({text: Translations.getModule("models.players", language).get("dmEnabledFooter")});
	}

	user.send({
		embeds: [embed]
	}).catch(() => {
		error(`Can't send dm to user ${user.id}`);
	});
}

/**
 * This function is called to verify if the bot have access to a channel
 * @param player
 * @param user
 * @param embed
 * @param language
 */
export async function checkChannelAccess(player: Player, user: User, embed: DraftBotEmbed, language: string): Promise<void> {
	const tr = Translations.getModule("commands.notifications", language);
	const channelAccess = await draftBotClient.shard.broadcastEval((client, context) =>
		client.channels.fetch(context.player.notifications).then((channel) => {
			if ((<BaseGuildTextChannel>channel).guild.shardId === client.shard.ids[0]) {
				(<TextBasedChannel>channel).send(context.embedNotification);
				return true;
			}
			return false;
		})
			.catch(() => false), {
		context: {
			player: {
				notifications: player.notifications
			},
			embedNotification: {
				content: player.getMention(),
				embeds: [embed.setFooter({text: tr.get("channelNotification")})
				]
			}
		}
	});
	if (!channelAccess.includes(true)) {
		player.notifications = NotificationsConstants.DM_VALUE;
		await player.save();
		sendDirectMessage(user, embed.setDescription(`${embed.data.description}\n\n${format(tr.get("noChannelAccess"), {})}`), language);
	}
}

/**
 * This function is called to send a notification to the player (dm or channel or nothing)
 * @param player
 * @param embed
 * @param language
 */
export async function sendNotificationToPlayer(player: Player, embed: DraftBotEmbed, language: string): Promise<void> {
	const user = await draftBotClient.users.fetch(player.discordUserId);
	if (!embed.data.author) {
		embed.formatAuthor(embed.data.title, user);
		embed.setTitle(null);
	}
	else {
		embed.formatAuthor(embed.data.author.name, user);
	}
	if (player.notifications === NotificationsConstants.DM_VALUE) {
		sendDirectMessage(user, embed, language);
	}
	else if (player.notifications !== NotificationsConstants.NO_NOTIFICATIONS_VALUE) {
		await checkChannelAccess(player, user, embed, language);
	}
}