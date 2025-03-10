import {SlashCommandBuilder} from "@discordjs/builders";
import {CommandInteraction, User} from "discord.js";
import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";
import {DraftBotTradeMessage} from "../../core/messages/DraftBotTradeMessage";
import {MissionsController} from "../../core/missions/MissionsController";
import {BlockingUtils, sendBlockedError} from "../../core/utils/BlockingUtils";
import {ICommand} from "../ICommand";
import {Constants} from "../../core/Constants";
import {replyErrorMessage, sendErrorMessage} from "../../core/utils/ErrorUtils";
import {TranslationModule, Translations} from "../../core/Translations";
import {CommandsManager} from "../CommandsManager";
import PetEntity, {PetEntities} from "../../core/database/game/models/PetEntity";
import {PetTradeConstants} from "../../core/constants/PetTradeConstants";
import {BlockingConstants} from "../../core/constants/BlockingConstants";
import {EffectsConstants} from "../../core/constants/EffectsConstants";
import {SlashCommandBuilderGenerator} from "../SlashCommandBuilderGenerator";
import {LogsDatabase} from "../../core/database/logs/LogsDatabase";
import Player, {Players} from "../../core/database/game/models/Player";
import {Pets} from "../../core/database/game/models/Pet";
import {PetConstants} from "../../core/constants/PetConstants";

type TraderAndPet = { trader: Player, pet: PetEntity, user: User }

/**
 * Check if both traders are in a valid state to trade their pet
 * @param traderAndPet1
 * @param traderAndPet2
 * @param interaction
 * @param petTradeModule
 */
async function missingRequirementsForAnyTrader(
	traderAndPet1: TraderAndPet,
	traderAndPet2: TraderAndPet,
	interaction: CommandInteraction,
	petTradeModule: TranslationModule
): Promise<boolean> {
	const petModule = Translations.getModule("commands.pet", petTradeModule.language);
	if (traderAndPet1.trader.id === traderAndPet2.trader.id) {
		await replyErrorMessage(interaction, petTradeModule.language, petTradeModule.get("cantTradeSelf"));
		return true;
	}
	if (!await CommandsManager.userCanPerformCommand(CommandsManager.commands.get("pettrade"), traderAndPet2.trader, {
		interaction,
		tr: Translations.getModule("bot", petTradeModule.language)
	}, true)) {
		return true;
	}
	if (await sendBlockedError(interaction, petTradeModule.language, traderAndPet2.user)) {
		return true;
	}

	for (const traderAndPet of [traderAndPet1, traderAndPet2]) {
		if (!traderAndPet.pet) {
			await replyErrorMessage(interaction, petTradeModule.language, petModule.get(traderAndPet === traderAndPet1 ? "noPet" : "noPetOther"));
			return true;
		}
		if (traderAndPet.pet.isFeisty()) {
			await replyErrorMessage(interaction, petTradeModule.language, petModule.get(traderAndPet === traderAndPet1 ? "isFeisty" : "isFeistyOther"));
			return true;
		}
	}
	return false;
}

/**
 * Refresh the missions of the trader to accommodate the trade success
 * @param tradersAndPets
 * @param i
 * @param interaction
 * @param petTradeModule
 */
async function refreshMissionsOfTrader(
	tradersAndPets: TraderAndPet[],
	i: number,
	interaction: CommandInteraction,
	petTradeModule: TranslationModule
): Promise<void> {

	/**
	 * check if the mission is finished from its name
	 * @param missionName
	 */
	async function checkLoveLevelMission(missionName: string): Promise<void> {
		await MissionsController.update(
			tradersAndPets[i].trader,
			interaction.channel,
			petTradeModule.language,
			{missionId: missionName, params: {loveLevel: tradersAndPets[1 - i].pet.getLoveLevelNumber()}});
	}

	await checkLoveLevelMission("tamedPet");
	await checkLoveLevelMission("trainedPet");
	await MissionsController.update(
		tradersAndPets[i].trader,
		interaction.channel,
		petTradeModule.language,
		{missionId: "sellOrTradePet"});
}

/**
 * Manage a pet and his trader when the trade is accepted
 * @param tradersAndPets
 * @param i
 * @param interaction
 * @param petTradeModule
 */
async function manageATraderAndPet(tradersAndPets: TraderAndPet[], i: number, interaction: CommandInteraction, petTradeModule: TranslationModule): Promise<void> {
	BlockingUtils.unblockPlayer(tradersAndPets[i].trader.discordUserId, BlockingConstants.REASONS.PET_TRADE);
	tradersAndPets[i].trader.petId = tradersAndPets[1 - i].pet.id;
	await tradersAndPets[i].trader.save();
	tradersAndPets[i].pet.lovePoints -= (await Pets.getById(tradersAndPets[i].pet.petId)).rarity * PetTradeConstants.POINT_REMOVE_MULTIPLIER;
	if (tradersAndPets[i].pet.lovePoints < PetConstants.BASE_LOVE) {
		tradersAndPets[i].pet.lovePoints = PetConstants.BASE_LOVE;
	}
	await tradersAndPets[i].pet.save();
	await refreshMissionsOfTrader(tradersAndPets, i, interaction, petTradeModule);
}

/**
 * Returns the callback if the trade succeed
 * @param traderAndPet1
 * @param traderAndPet2
 * @param interaction
 * @param petTradeModule
 */
function getTradeSuccessCallback(traderAndPet1: TraderAndPet, traderAndPet2: TraderAndPet, interaction: CommandInteraction, petTradeModule: TranslationModule) {
	return async (): Promise<void> => {
		const tradersAndPets = [traderAndPet1, traderAndPet2];
		for (let i = 0; i < 2; i++) {
			await manageATraderAndPet(tradersAndPets, i, interaction, petTradeModule);
		}
		LogsDatabase.logPetTrade(tradersAndPets[0].pet, tradersAndPets[1].pet).then();
		await interaction.followUp({
			embeds: [new DraftBotEmbed()
				.formatAuthor(petTradeModule.get("tradeTitle"), interaction.user)
				.setDescription(petTradeModule.get("tradeSuccess"))
			]
		});
	};
}

/**
 * Returns the callback if one of the traders refuse to trade
 * @param tradersAndPets
 * @param interaction
 * @param petTradeModule
 * @param hasResponded
 */
function getTradeUnsuccessfulCallback(tradersAndPets: TraderAndPet[], interaction: CommandInteraction, petTradeModule: TranslationModule, hasResponded: boolean) {
	return async (tradeMessage: DraftBotTradeMessage): Promise<void> => {
		BlockingUtils.unblockPlayer(tradersAndPets[0].trader.discordUserId, BlockingConstants.REASONS.PET_TRADE);
		BlockingUtils.unblockPlayer(tradersAndPets[1].trader.discordUserId, BlockingConstants.REASONS.PET_TRADE);
		if (hasResponded) {
			await sendErrorMessage(interaction.user, interaction, petTradeModule.language, petTradeModule.format("tradeCanceled", {
				trader: tradeMessage.trader1Accepted === false ? tradersAndPets[0].user : tradersAndPets[1].user
			}), true);
		}
		else {
			await sendErrorMessage(interaction.user, interaction, petTradeModule.language, petTradeModule.get("tradeCanceledTime"), true);
		}
	};
}

/**
 * Prepare and send the trade message
 * @param traderAndPet1
 * @param traderAndPet2
 * @param interaction
 * @param petTradeModule
 */
async function createAndSendTradeMessage(traderAndPet1: TraderAndPet, traderAndPet2: TraderAndPet, interaction: CommandInteraction, petTradeModule: TranslationModule): Promise<void> {
	const tradersAndPets = [traderAndPet1, traderAndPet2];
	const tradeMessage = new DraftBotTradeMessage(
		traderAndPet1.user,
		traderAndPet2.user,
		getTradeSuccessCallback(traderAndPet1, traderAndPet2, interaction, petTradeModule) as () => void,
		getTradeUnsuccessfulCallback(tradersAndPets, interaction, petTradeModule, true) as (msg: DraftBotTradeMessage) => void,
		getTradeUnsuccessfulCallback(tradersAndPets, interaction, petTradeModule, false) as (msg: DraftBotTradeMessage) => void
	)
		.formatAuthor(petTradeModule.get("tradeTitle"), traderAndPet1.user)
		.setDescription(petTradeModule.format("tradeDescription", {
			trader1: traderAndPet1.user,
			trader2: traderAndPet2.user
		}))
		.setFooter({text: petTradeModule.get("warningTradeReset")});
	for (const traderAndPet of tradersAndPets) {
		tradeMessage.addFields({
			name: petTradeModule.format("petOfTrader", {
				trader: traderAndPet.trader.getPseudo(petTradeModule.language)
			}),
			value: traderAndPet.pet.getPetDisplay(await Pets.getById(traderAndPet.pet.petId), petTradeModule.language),
			inline: true
		});
	}
	await tradeMessage.reply(interaction, (collector) => {
		BlockingUtils.blockPlayerWithCollector(traderAndPet1.trader.discordUserId, BlockingConstants.REASONS.PET_TRADE, collector);
		BlockingUtils.blockPlayerWithCollector(traderAndPet2.trader.discordUserId, BlockingConstants.REASONS.PET_TRADE, collector);
	});
}

/**
 * Make a pet trade with someone else
 * @param interaction
 * @param {("fr"|"en")} language - Language to use in the response
 * @param trader1
 */
async function executeCommand(interaction: CommandInteraction, language: string, trader1: Player): Promise<void> {
	if (await sendBlockedError(interaction, language)) {
		return;
	}
	const petTradeModule = Translations.getModule("commands.petTrade", language);

	const trader2 = await Players.getByOptions(interaction);
	const pet1 = await PetEntities.getById(trader1.petId);
	const pet2 = await PetEntities.getById(trader2.petId);

	const traderAndPet1: TraderAndPet = {trader: trader1, pet: pet1, user: interaction.user};
	const traderAndPet2: TraderAndPet = {trader: trader2, pet: pet2, user: interaction.options.getUser("user")};

	if (await missingRequirementsForAnyTrader(traderAndPet1, traderAndPet2, interaction, petTradeModule)) {
		return;
	}

	await createAndSendTradeMessage(traderAndPet1, traderAndPet2, interaction, petTradeModule);
}

const currentCommandFrenchTranslations = Translations.getModule("commands.petTrade", Constants.LANGUAGE.FRENCH);
const currentCommandEnglishTranslations = Translations.getModule("commands.petTrade", Constants.LANGUAGE.ENGLISH);
export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand(currentCommandFrenchTranslations, currentCommandEnglishTranslations)
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateUserOption(
				currentCommandFrenchTranslations, currentCommandEnglishTranslations, option
			).setRequired(true)) as SlashCommandBuilder,
	executeCommand,
	requirements: {
		allowEffects: [EffectsConstants.EMOJI_TEXT.SMILEY]
	},
	mainGuildCommand: false
};