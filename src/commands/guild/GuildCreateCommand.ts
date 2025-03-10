import {SlashCommandBuilder} from "@discordjs/builders";
import {CommandInteraction} from "discord.js";
import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";
import {DraftBotValidateReactionMessage} from "../../core/messages/DraftBotValidateReactionMessage";
import Guild, {Guilds} from "../../core/database/game/models/Guild";
import {MissionsController} from "../../core/missions/MissionsController";
import {BlockingUtils, sendBlockedError} from "../../core/utils/BlockingUtils";
import {ICommand} from "../ICommand";
import {Constants} from "../../core/Constants";
import {checkNameString} from "../../core/utils/StringUtils";
import {replyErrorMessage, sendErrorMessage} from "../../core/utils/ErrorUtils";
import {TranslationModule, Translations} from "../../core/Translations";
import {BlockingConstants} from "../../core/constants/BlockingConstants";
import {NumberChangeReason} from "../../core/constants/LogsConstants";
import {draftBotInstance} from "../../core/bot";
import {EffectsConstants} from "../../core/constants/EffectsConstants";
import {GuildCreateConstants} from "../../core/constants/GuildCreateConstants";
import {SlashCommandBuilderGenerator} from "../SlashCommandBuilderGenerator";
import Player from "../../core/database/game/models/Player";
import {GuildConstants} from "../../core/constants/GuildConstants";

/**
 * Get a guild by its name
 * @param askedName
 */
async function getGuildByName(askedName: string): Promise<Guild> {
	try {
		return await Guilds.getByName(askedName);
	}
	catch (error) {
		return null;
	}
}

/**
 * Get the callback for the guild create command
 * @param player
 * @param guild
 * @param askedName
 * @param interaction
 * @param language
 * @param guildCreateModule
 */
function endCallbackGuildCreateValidationMessage(
	player: Player,
	guild: Guild,
	askedName: string,
	interaction: CommandInteraction,
	language: string,
	guildCreateModule: TranslationModule
): (validateMessage: DraftBotValidateReactionMessage) => Promise<void> {
	return async (validateMessage: DraftBotValidateReactionMessage): Promise<void> => {
		BlockingUtils.unblockPlayer(player.discordUserId, BlockingConstants.REASONS.GUILD_CREATE);
		if (validateMessage.isValidated()) {
			guild = await getGuildByName(askedName);
			if (guild !== null) {
				// the name is already used
				await sendErrorMessage(interaction.user, interaction, language, guildCreateModule.get("nameAlreadyUsed"));
				return;
			}
			if (player.money < GuildCreateConstants.PRICE) {
				await sendErrorMessage(interaction.user, interaction, language, guildCreateModule.get("notEnoughMoney"));
				return;
			}

			const newGuild = await Guild.create({
				name: askedName,
				chiefId: player.id
			});

			player.guildId = newGuild.id;
			await player.addMoney({
				amount: -GuildCreateConstants.PRICE,
				channel: interaction.channel,
				language,
				reason: NumberChangeReason.GUILD_CREATE
			});
			newGuild.updateLastDailyAt();
			await newGuild.save();
			await player.save();

			draftBotInstance.logsDatabase.logGuildCreation(player.discordUserId, newGuild).then();

			await MissionsController.update(player, interaction.channel, language, {missionId: "joinGuild"});
			await MissionsController.update(player, interaction.channel, language, {
				missionId: "guildLevel",
				count: newGuild.level,
				set: true
			});

			await interaction.followUp({
				embeds: [new DraftBotEmbed()
					.formatAuthor(guildCreateModule.get("createTitle"), interaction.user)
					.setDescription(guildCreateModule.format("createSuccess", {guildName: askedName}))]
			});
			return;
		}

		// Cancel the creation
		await sendErrorMessage(interaction.user, interaction, language, guildCreateModule.get("creationCancelled"), true);
	};
}

/**
 * Get the validation embed for a guild creation
 * @param interaction
 * @param endCallback
 * @param askedName
 * @param guildCreateModule
 */
function createValidationEmbedGuildCreation(
	interaction: CommandInteraction,
	endCallback: (validateMessage: DraftBotValidateReactionMessage) => Promise<void>,
	askedName: string,
	guildCreateModule: TranslationModule
): DraftBotValidateReactionMessage {
	return new DraftBotValidateReactionMessage(interaction.user, endCallback)
		.formatAuthor(guildCreateModule.get("buyTitle"), interaction.user)
		.setDescription(
			guildCreateModule.format("buyConfirm",
				{
					guildName: askedName,
					price: GuildCreateConstants.PRICE
				}
			))
		.setFooter({text: guildCreateModule.get("buyFooter")});
}

/**
 * Allow to Create a guild
 * @param interaction
 * @param {("fr"|"en")} language - Language to use in the response
 * @param player
 */
async function executeCommand(interaction: CommandInteraction, language: string, player: Player): Promise<void> {
	if (await sendBlockedError(interaction, language)) {
		return;
	}
	const guildCreateModule = Translations.getModule("commands.guildCreate", language);
	// search for a user's guild
	let guild;
	try {
		guild = await Guilds.getById(player.guildId);
	}
	catch (error) {
		guild = null;
	}
	if (guild !== null) {
		// already in a guild
		await replyErrorMessage(interaction, language, guildCreateModule.get("alreadyInAGuild"));
		return;
	}

	const askedName = interaction.options.get(Translations.getModule("commands.guildCreate", Constants.LANGUAGE.ENGLISH).get("optionGuildName")).value as string;

	if (!checkNameString(askedName, GuildConstants.GUILD_NAME_LENGTH_RANGE)) {
		await replyErrorMessage(
			interaction,
			language,
			`${guildCreateModule.get("invalidName")}\n${Translations.getModule("error", language).format("nameRules", {
				min: GuildConstants.GUILD_NAME_LENGTH_RANGE.MIN,
				max: GuildConstants.GUILD_NAME_LENGTH_RANGE.MAX
			})}`);
		return;
	}

	guild = await getGuildByName(askedName);

	if (guild !== null) {
		// the name is already used
		await replyErrorMessage(
			interaction,
			language,
			guildCreateModule.get("nameAlreadyUsed")
		);
		return;
	}

	const endCallback = endCallbackGuildCreateValidationMessage(player, guild, askedName, interaction, language, guildCreateModule);

	const validationEmbed = createValidationEmbedGuildCreation(interaction, endCallback, askedName, guildCreateModule);

	await validationEmbed.reply(interaction, (collector) => BlockingUtils.blockPlayerWithCollector(player.discordUserId, BlockingConstants.REASONS.GUILD_CREATE, collector));
}

const currentCommandFrenchTranslations = Translations.getModule("commands.guildCreate", Constants.LANGUAGE.FRENCH);
const currentCommandEnglishTranslations = Translations.getModule("commands.guildCreate", Constants.LANGUAGE.ENGLISH);
export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand(currentCommandFrenchTranslations, currentCommandEnglishTranslations)
		.addStringOption(option => option.setName(currentCommandEnglishTranslations.get("optionGuildName"))
			.setNameLocalizations({
				fr: currentCommandFrenchTranslations.get("optionGuildName")
			})
			.setDescription(currentCommandEnglishTranslations.get("optionGuildDescription"))
			.setDescriptionLocalizations({
				fr: currentCommandFrenchTranslations.get("optionGuildDescription")
			})
			.setRequired(true)) as SlashCommandBuilder,
	executeCommand,
	requirements: {
		requiredLevel: GuildConstants.REQUIRED_LEVEL,
		disallowEffects: [EffectsConstants.EMOJI_TEXT.BABY, EffectsConstants.EMOJI_TEXT.DEAD]
	},
	mainGuildCommand: false
};