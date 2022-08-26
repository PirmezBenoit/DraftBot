import {Entities} from "../../../../core/database/game/models/Entity";
import {NumberChangeReason} from "../../../../core/database/logs/LogsDatabase";
import {format} from "../../../../core/utils/StringFormatter";

/**
 * Set the health of the player
 * @param {("fr"|"en")} language - Language to use in the response
 * @param interaction
 * @param {String[]} args=[] - Additional arguments sent with the command
 * @return {String} - The successful message formatted
 */
const playerHealthTestCommand = async (language, interaction, args) => {
	const [entity] = await Entities.getOrRegister(interaction.user.id);
	if (args[0] < 0) {
		throw new Error("Erreur experience : experience donné inférieur à 0 interdit !");
	}
	await entity.addHealth(parseInt(args[0], 10) - entity.health, interaction.channel, language, NumberChangeReason.TEST, {
		overHealCountsForMission: false,
		shouldPokeMission: false
	});
	await entity.save();

	return format(module.exports.commandInfo.messageWhenExecuted, {health: entity.health});
};

module.exports.commandInfo = {
	name: "playerhealth",
	aliases: ["health"],
	commandFormat: "<health>",
	typeWaited: {
		health: typeVariable.INTEGER
	},
	messageWhenExecuted: "Vous avez maintenant {health} :heart:!",
	description: "Mets la vie de votre joueur à la valeur donnée",
	commandTestShouldReply: true,
	execute: playerHealthTestCommand
};