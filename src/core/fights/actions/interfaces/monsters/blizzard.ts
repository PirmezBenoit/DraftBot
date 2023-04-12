import {Fighter, FightStatModifierOperation} from "../../../fighter/Fighter";
import {FightActionController} from "../../FightActionController";
import {attackInfo, FightAction, statsInfo} from "../../FightAction";
import {FightAlterations} from "../../FightAlterations";
import {FightConstants} from "../../../../constants/FightConstants";
import {Translations} from "../../../../Translations";

export default class Blizzard extends FightAction {
	use(sender: Fighter, receiver: Fighter, turn: number, language: string): string {
		const attackTranslationModule = Translations.getModule("commands.fight", language);
		const blizzardTranslationModule = Translations.getModule(`fightactions.${this.name}`, language);
		receiver.applyDefenseModifier({
			origin: this,
			operation: FightStatModifierOperation.ADDITION,
			value: - receiver.getDefense() * 0.10
		});
		receiver.applySpeedModifier({
			origin: this,
			operation: FightStatModifierOperation.ADDITION,
			value: - receiver.getSpeed() * 0.10
		});
		let sideEffectsSpeed = attackTranslationModule.format("actions.sideEffects.speed", {
			adversary: FightConstants.TARGET.OPPONENT,
			operator: FightConstants.OPERATOR.MINUS,
			amount: 10
		});
		let sideEffectsDefense = attackTranslationModule.format("actions.sideEffects.defense", {
			adversary: FightConstants.TARGET.OPPONENT,
			operator: FightConstants.OPERATOR.MINUS,
			amount: 10
		});
		return blizzardTranslationModule.get("active") + sideEffectsDefense + sideEffectsSpeed
	}

}