import Guild from "../../../../core/database/game/models/Guild";
import {format} from "../../../../core/utils/StringFormatter";
import {Constants} from "../../../../core/Constants";
import {CommandInteraction} from "discord.js";
import {ITestCommand} from "../../../../core/CommandsTest";
import {Players} from "../../../../core/database/game/models/Player";
import {GuildConstants} from "../../../../core/constants/GuildConstants";

export const commandInfo: ITestCommand = {
	name: "forcejoinguild",
	aliases: ["fjg"],
	commandFormat: "<guildToJoin>",
	typeWaited: {
		guildToJoin: Constants.TEST_VAR_TYPES.INTEGER
	},
	messageWhenExecuted: "Votre guilde est maintenant la guilde {guildToJoin} !",
	description: "Vous fait changer de guilde de force. Votre nouvelle guilde sera la guilde passée en paramètre",
	commandTestShouldReply: true,
	execute: null // defined later
};

/**
 * Set your new guild
 * @param {("fr"|"en")} language - Language to use in the response
 * @param interaction
 * @param {String[]} args=[] - Additional arguments sent with the command
 * @return {String} - The successful message formatted
 */
const forceJoinGuildTestCommand = async (language: string, interaction: CommandInteraction, args: string[]): Promise<string> => {
	const [player] = await Players.getOrRegister(interaction.user.id);

	const guildToJoin = await Guild.findOne({where: {id: args[0]}});
	if (guildToJoin === null) {
		throw new Error("Erreur forcejoinguild : pas de guilde avec cet id !");
	}

	const guildToLeave = await Guild.findOne({where: {id: player.guildId}});
	if (guildToLeave !== null && guildToLeave) {
		if (guildToJoin.id === guildToLeave.id) {
			throw new Error("Erreur forcejoinguild : vous êtes déjà dans la guilde donnée !");
		}
	}
	if ((await Players.getByGuild(guildToJoin.id)).length === GuildConstants.MAX_GUILD_MEMBERS) {
		throw new Error("Erreur forcejoinguild : nombre de joueurs maximum dans cette guilde atteint !");
	}
	if (guildToLeave && guildToLeave.chiefId === player.id) {
		// the chief is leaving : destroy the guild
		await Guild.destroy({
			where: {
				id: guildToLeave.id
			}
		});
	}

	player.guildId = guildToJoin.id;

	await Promise.all([
		guildToJoin.save(),
		player.save(),
		player.save()
	]);

	return format(commandInfo.messageWhenExecuted, {guildToJoin: guildToJoin.name});
};

commandInfo.execute = forceJoinGuildTestCommand;