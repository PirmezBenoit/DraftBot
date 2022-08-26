const {CommandsManager} = require("../../../CommandsManager");
const {Entities} = require("../../../../core/database/game/models/Entity");
import {format} from "../../../../core/utils/StringFormatter";

let stringDesc = "Force un type de mini event parmis ceux-ci :\n";
Object.keys(JsonReader.smallEvents).forEach(seName => {
	stringDesc += "\n - " + seName;
});

/**
 * Force an small event with a given event name
 * @param {("fr"|"en")} language - Language to use in the response
 * @param interaction
 * @param {String[]} args=[] - Additional arguments sent with the command
 * @return {String} - The successful message formatted
 */
const smallEventTestCommand = async (language, interaction, args) => {
	if (JsonReader.smallEvents[args[0]] === undefined) {
		throw new Error("Erreur smallEvent : le mini-event " + args[0] + " n'existe pas. Veuillez vous référer à la commande \"test help smallEvent\" pour plus d'informations");
	}
	const [entity] = await Entities.getOrRegister(interaction.user.id);
	await CommandsManager.executeCommandWithParameters("report", interaction, language, entity, null, args[0]);
	return format(module.exports.commandInfo.messageWhenExecuted, {name: args[0]});
};

module.exports.commandInfo = {
	name: "smallEvent",
	commandFormat: "<seName>",
	typeWaited: {
		seName: typeVariable.STRING
	},
	messageWhenExecuted: "Mini event `{name}` forcé !",
	description: stringDesc,
	execute: smallEventTestCommand
};