import {format} from "../../../../core/utils/StringFormatter";
import {NumberChangeReason} from "../../../../core/constants/LogsConstants";
import {CommandInteraction} from "discord.js";
import {Constants} from "../../../../core/Constants";
import {ITestCommand} from "../../../../core/CommandsTest";
import {Players} from "../../../../core/database/game/models/Player";
import {PetEntities} from "../../../../core/database/game/models/PetEntity";

export const commandInfo: ITestCommand = {
	name: "petlovepoints",
	aliases: ["petlp"],
	commandFormat: "<lovePoints>",
	typeWaited: {
		lovePoints: Constants.TEST_VAR_TYPES.INTEGER
	},
	messageWhenExecuted: "Votre pet a maintenant un amour de {love}. Cela correspond à un pet {loveLevel} !",
	description: "Mets le niveau d'amour de votre pet au niveau donné",
	commandTestShouldReply: true,
	execute: null // defined later
};

/**
 * Set the lovePoints of your pet
 * @param {("fr"|"en")} language - Language to use in the response
 * @param interaction
 * @param {String[]} args=[] - Additional arguments sent with the command
 * @return {String} - The successful message formatted
 */
const petLovePointsTestCommand = async (language: string, interaction: CommandInteraction, args: string[]): Promise<string> => {
	const [player] = await Players.getOrRegister(interaction.user.id);
	const pet = await PetEntities.getById(player.petId);
	if (pet === null) {
		throw new Error("Erreur petlp : vous n'avez pas de pet !");
	}
	const lovePoints = parseInt(args[0], 10);
	if (lovePoints < 0 || lovePoints > 100) {
		throw new Error("Erreur petlp : lovePoints invalide ! Fourchette de lovePoints comprise entre 0 et 100.");
	}
	await pet.changeLovePoints({
		player,
		amount: lovePoints - pet.lovePoints,
		channel: interaction.channel,
		language,
		reason: NumberChangeReason.TEST
	});
	await pet.save();
	return format(
		commandInfo.messageWhenExecuted, {
			love: args[0],
			loveLevel: pet.getLoveLevel(language)
		}
	);
};

commandInfo.execute = petLovePointsTestCommand;
