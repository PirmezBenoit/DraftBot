import {CommandInteraction} from "discord.js";
import {ITestCommand} from "../../../../core/CommandsTest";
import {Players} from "../../../../core/database/game/models/Player";
import {NumberChangeReason} from "../../../../core/constants/LogsConstants";

export const commandInfo: ITestCommand = {
	name: "playerkill",
	aliases: ["kill"],
	commandFormat: "",
	messageWhenExecuted: "Vous vous êtes suicidé avec succès !",
	description: "Vous permet de vous kill dans le plus grand des calmes",
	commandTestShouldReply: true,
	execute: null // defined later
};

/**
 * Kill yourself
 * @param {("fr"|"en")} language - Language to use in the response
 * @param interaction
 * @return {String} - The successful message formatted
 */
const playerSuicideTestCommand = async (language: string, interaction: CommandInteraction): Promise<string> => {
	const [player] = await Players.getOrRegister(interaction.user.id);

	await player.addHealth(-player.health, interaction.channel, language, NumberChangeReason.TEST, {
		overHealCountsForMission: true,
		shouldPokeMission: true
	});
	await player.killIfNeeded(interaction.channel, language, NumberChangeReason.TEST);
	await Promise.all([player.save(), player.save()]);

	return commandInfo.messageWhenExecuted;
};

commandInfo.execute = playerSuicideTestCommand;
