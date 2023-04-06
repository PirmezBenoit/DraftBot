import {Fighter, FightStatModifierOperation} from "../../../fighter/Fighter";
import {FightActionController} from "../../FightActionController";
import {attackInfo, FightAction, statsInfo} from "../../FightAction";
import {FightAlterations} from "../../FightAlterations";
import {FightConstants} from "../../../../constants/FightConstants";
import {Translations} from "../../../../Translations";

export default class FreezingTouch extends FightAction {
	use(sender: Fighter, receiver: Fighter, turn: number, language: string): string {
		const initialDamage = FightActionController.getAttackDamage(this.getStatsInfo(sender, receiver), sender, this.getAttackInfo());
		const damageDealt = FightActionController.applySecondaryEffects(initialDamage, 10, 5);
		receiver.damage(damageDealt);

		const attackTranslationModule = Translations.getModule("commands.fight", language);
		let sideEffects = "";
		receiver.applySpeedModifier({
			origin: this,
			operation: FightStatModifierOperation.ADDITION,
			value: - receiver.getSpeed() * 0.15
		});
		sideEffects = attackTranslationModule.format("actions.sideEffects.speed", {
			adversary: FightConstants.TARGET.OPPONENT,
			operator: FightConstants.OPERATOR.MINUS,
			amount: 15
		});

		return this.getGenericAttackOutput(damageDealt, initialDamage, language, sideEffects);
	}

	getAttackInfo(): attackInfo {
		return {minDamage: 10, averageDamage: 50, maxDamage: 60};
	}

	getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
		return {
			attackerStats: [
				sender.getAttack()
			], defenderStats: [
				receiver.getDefense()
			], statsEffect: [
				1
			]
		};
	}
}