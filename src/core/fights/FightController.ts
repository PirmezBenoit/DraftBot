import {Fighter} from "./Fighter";
import {FightState} from "./FightState";
import {FightView} from "./FightView";
import {RandomUtils} from "../utils/RandomUtils";
import {FightConstants} from "../constants/FightConstants";
import {TextBasedChannel} from "discord.js";
import {FighterStatus} from "./FighterStatus";
import {IFightAction} from "../attacks/IFightAction";
import {FightActionController} from "../attacks/FightActionController";
import {BlockingUtils} from "../utils/BlockingUtils";
import {MissionsController} from "../missions/MissionsController";

export class FightController {

	private readonly fighters: Fighter[];

	private readonly fightView: FightView

	private state: FightState;

	turn: number;

	private readonly friendly: boolean;

	public constructor(fighter1: Fighter, fighter2: Fighter, friendly: boolean, channel: TextBasedChannel, language: string) {
		this.fighters = [fighter1, fighter2];
		this.state = FightState.NOT_STARTED;
		this.turn = 1;
		this.friendly = friendly;
		this.fightView = new FightView(channel, language, this);
	}

	/**
	 * start a fight
	 * @public
	 */
	public async startFight() {
		// make the fighters ready
		for (let i = 0; i < this.fighters.length; i++) {
			await this.fighters[i].consumePotionIfNeeded(this.friendly, this.fightView.channel, this.fightView.language);
			this.fighters[i].block();
		}

		// the player with the highest speed start the fight
		if (this.fighters[1].stats.speed > this.fighters[0].stats.speed || RandomUtils.draftbotRandom.bool() && this.fighters[1].stats.speed === this.fighters[0].stats.speed) {
			this.invertFighters();
		}
		await this.fightView.introduceFight(this.fighters[0], this.fighters[1]);
		this.state = FightState.RUNNING;
		await this.prepareNextTurn();
	}

	/**
	 * Get the playing fighter or null if the fight is not running
	 * @return {Fighter|null}
	 */
	public getPlayingFighter() {
		return this.state === FightState.RUNNING ? this.fighters[(this.turn - 1) % 2] : null;
	}

	/**
	 * Get the defending fighter or null if the fight is not running
	 * @return {Fighter|null}
	 */
	public getDefendingFighter() {
		return this.state === FightState.RUNNING ? this.fighters[this.turn % 2] : null;
	}

	/**
	 * execute the next fight action
	 */
	public async executeFightAction(fightAction: IFightAction) {
		const receivedMessage = fightAction.use(this.getPlayingFighter(), this.getDefendingFighter(), this.fightView.language);
		await this.fightView.updateHistory(fightAction.getEmoji(), this.getPlayingFighter().getMention(), receivedMessage);
		this.getPlayingFighter().fightActionsHistory.push(fightAction.getName());
		this.turn++;
		if (this.hadEnded()) {
			await this.endFight();
			return;
		}
		await this.prepareNextTurn();
	}

	/**
	 * End the fight
	 */
	public endFight() {
		this.state = FightState.FINISHED;
		const winner = this.getWinner();

		const isADraw = winner === 2;

		for (const fighter of this.fighters) {
			BlockingUtils.unblockPlayer(fighter.getUser().id);
		}

		if (isADraw) {
			console.log("Fight ended; " +
				`equality between: ${this.fighters[winner].getUser().id} (${this.fighters[winner].stats.fightPoints}/${this.fighters[winner].stats.maxFightPoint}); ` +
				`and: ${this.fighters[1 - winner].getUser().id} (${this.fighters[1 - winner].stats.fightPoints}/${this.fighters[1 - winner].stats.maxFightPoint}); ` +
				`turns: ${this.turn}`);
		}
		else {
			console.log("Fight ended; " +
				`winner: ${this.fighters[winner].getUser().id} (${this.fighters[winner].stats.fightPoints}/${this.fighters[winner].stats.maxFightPoint}); ` +
				`loser: ${this.fighters[1 - winner].getUser().id} (${this.fighters[1 - winner].stats.fightPoints}/${this.fighters[1 - winner].stats.maxFightPoint}); ` +
				`turns: ${this.turn}`);
		}
		this.fightView.outroFight(this.fighters[(1 - winner) % 2], this.fighters[winner % 2], isADraw).finally(() => null);
		for (const fighter of this.fighters) {
			this.manageMissionsOf(fighter).finally(() => null);
		}
		if (winner !== 2) {
			MissionsController.update(this.fighters[winner].getUser().id, this.fightView.channel, this.fightView.language, "fightHealthPercent", 1, {
				remainingPercent: this.fighters[winner].stats.fightPoints / this.fighters[winner].stats.maxFightPoint
			}).finally(() => null);
		}
	}

	private getWinner(): number {
		if (this.fighters[0].isDead() === this.fighters[1].isDead()) {
			return 2;
		}
		return this.fighters[0].isDead() ? 1 : 0;
	}

	private async manageMissionsOf(fighter: Fighter): Promise<void> {
		if (this.friendly) {
			await MissionsController.update(fighter.getUser().id, this.fightView.channel, this.fightView.language, "friendlyFight");
		}
		else {
			await MissionsController.update(fighter.getUser().id, this.fightView.channel, this.fightView.language, "rankedFight");
		}
		await MissionsController.update(fighter.getUser().id, this.fightView.channel, this.fightView.language, "anyFight");
	}

	/**
	 * execute a turn of a fight
	 * @private
	 */
	private async prepareNextTurn() {
		await this.fightView.displayFightStatus();
		if (this.getPlayingFighter().nextFightActionId === null) {
			await this.fightView.selectFightActionMenu(this.getPlayingFighter());
		}
		else {
			await this.executeFightAction(FightActionController.getFightActionInterface(this.getPlayingFighter().nextFightActionId));
		}
	}

	/**
	 * Change who is the player 1 and who is the player 2.
	 * The player 1 start the fight.
	 * @private
	 */
	private invertFighters() {
		const temp = this.fighters[0];
		this.fighters[0] = this.fighters[1];
		this.fighters[1] = temp;
		this.fighters[0].setStatus(FighterStatus.ATTACKER);
		this.fighters[1].setStatus(FighterStatus.DEFENDER);
	}

	/**
	 * check if a fight has ended or not
	 * @private
	 */
	private hadEnded() {
		return (
			this.turn >= FightConstants.MAX_TURNS ||
			this.getPlayingFighter().isDeadOrBug() ||
			this.getDefendingFighter().isDeadOrBug() ||
			this.state !== FightState.RUNNING);
	}
}
