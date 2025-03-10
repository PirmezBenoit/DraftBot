import {Fighter} from "../../fighter/Fighter";
import {FightAction} from "../FightAction";
import {Translations} from "../../../Translations";
import {FightConstants} from "../../../constants/FightConstants";

export default class CounterAttack extends FightAction {
	use(sender: Fighter, receiver: Fighter, turn: number, language: string): string {

		// Of course, it should not be possible to counter on the first turn
		const couterAttackTranslationModule = Translations.getModule(`fightactions.${this.name}`, language);
		if (turn <= 1) {
			return couterAttackTranslationModule.get("fail");
		}

		const lastAttack = receiver.getLastFightActionUsed();
		// we also want to check for a few moves that should not be countered
		if (FightConstants.UNCOUNTERABLE_ACTIONS.includes(lastAttack.name)) {
			return couterAttackTranslationModule.get("fail");
		}

		return lastAttack.use(sender, receiver, turn, language);
	}
}