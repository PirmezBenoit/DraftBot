import {Guilds} from "../database/game/models/Guild";
import {DraftBotEmbed} from "../messages/DraftBotEmbed";
import {CommandInteraction} from "discord.js";
import {Translations} from "../Translations";
import {Constants} from "../Constants";
import {sendErrorMessage} from "./ErrorUtils";
import {format} from "./StringFormatter";
import {getFoodIndexOf} from "./FoodUtils";
import Player from "../database/game/models/Player";
import {NumberChangeReason} from "../constants/LogsConstants";
import {RandomUtils} from "./RandomUtils";
import {GuildConstants} from "../constants/GuildConstants";

/**
 * Gives food to a given guild / player
 * @param interaction
 * @param language
 * @param player
 * @param selectedFood
 * @param quantity
 * @param reason
 */
export async function giveFood(
	interaction: CommandInteraction,
	language: string,
	player: Player,
	selectedFood: string,
	quantity: number,
	reason: NumberChangeReason
): Promise<void> {
	const tr = Translations.getModule("commands.guildShop", language);
	const foodModule = Translations.getModule("food", language);
	const guild = await Guilds.getById(player.guildId);
	const selectedFoodIndex = getFoodIndexOf(selectedFood);
	if (guild.isStorageFullFor(selectedFood, quantity)) {
		await sendErrorMessage(
			interaction.user,
			interaction,
			language,
			tr.get("fullStock")
		);
		return;
	}
	guild.addFood(selectedFood, quantity, reason);
	await Promise.all([guild.save()]);
	const successEmbed = new DraftBotEmbed()
		.formatAuthor(tr.get("success"), interaction.user);
	if (quantity === 1) {
		successEmbed.setDescription(
			format(tr.get("singleSuccessAddFoodDesc"),
				{
					emote: Constants.PET_FOOD_GUILD_SHOP.EMOTE[selectedFoodIndex],
					quantity,
					name: foodModule.get(`${selectedFood}.name`)
						.slice(2, -2)
						.toLowerCase()
				}
			)
		);
	}
	else {
		successEmbed.setDescription(
			format(tr.get("multipleSuccessAddFoodDesc"),
				{
					emote: Constants.PET_FOOD_GUILD_SHOP.EMOTE[selectedFoodIndex],
					quantity,
					name:
						selectedFood === "ultimateFood" && language === Constants.LANGUAGE.FRENCH
							? foodModule.get(`${selectedFood}.name`)
								.slice(2, -2)
								.toLowerCase()
								.replace(
									foodModule.get(`${selectedFood}.name`)
										.slice(2, -2)
										.toLowerCase()
										.split(" ")[0],
									foodModule.get(`${selectedFood}.name`)
										.slice(2, -2)
										.toLowerCase()
										.split(" ")[0]
										.concat("s")
								)
							: foodModule.get(`${selectedFood}.name`)
								.slice(2, -2)
								.toLowerCase()
				}
			)
		);
	}
	await interaction.channel.send({embeds: [successEmbed]});
}

/**
 * calculate the amount of xp the guild will receive from the price chosen by the user
 * @param cost
 */
export function calculateAmountOfXPToAdd(cost: number): number {
	/**
	 * Does the random for xp obtained from the step / the reminder
	 * @param cost
	 */
	function calculateAmountOfXPToAddForStep(cost: number): number {
		return RandomUtils.randInt(
			Math.floor(cost / GuildConstants.XP_DIVIDER.MIN),
			Math.floor(cost / GuildConstants.XP_DIVIDER.MAX) + 1);
	}

	let guildExp = 0;
	for (let i = 0; i < Math.floor(cost / GuildConstants.XP_CALCULATION_STEP); i++) {
		guildExp += calculateAmountOfXPToAddForStep(GuildConstants.XP_CALCULATION_STEP);
	}

	return guildExp + calculateAmountOfXPToAddForStep(cost % GuildConstants.XP_CALCULATION_STEP);
}