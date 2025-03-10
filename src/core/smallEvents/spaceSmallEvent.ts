import {CommandInteraction, Message} from "discord.js";
import {NearEarthObject, NeoWSFeed, SpaceUtils} from "../utils/SpaceUtils";
import {TranslationModule, Translations} from "../Translations";
import {performance} from "perf_hooks";
import {MoonPhase, NextLunarEclipse, SearchLunarEclipse, SearchMoonQuarter} from "../utils/astronomy";
import {SmallEvent} from "./SmallEvent";
import {format} from "../utils/StringFormatter";
import {botConfig} from "../bot";
import {RandomUtils} from "../utils/RandomUtils";
import {SpaceConstants} from "../constants/SpaceConstants";
import {DraftBotEmbed} from "../messages/DraftBotEmbed";
import Player from "../database/game/models/Player";

/**
 * Gives an object that is going close to earth
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function neoWS(): Promise<Record<string, unknown>> {
	let neoWSFeed: NeoWSFeed;
	try {
		neoWSFeed = await SpaceUtils.getNeoWSFeed(botConfig.NASA_API_KEY);
	}
	catch (e) {
		// Si erreur durant récup data api
		neoWSFeed = null;
	}
	// check if the list contains an object
	if (neoWSFeed && neoWSFeed.length > 0) {
		const randomObject: NearEarthObject = RandomUtils.draftbotRandom.pick(neoWSFeed.near_earth_objects);
		return Promise.resolve({
			count: neoWSFeed.near_earth_objects.length,
			randomObjectName: randomObject.name,
			randomObjectDistance: Math.floor(parseInt(randomObject.close_approach_data[0].miss_distance.kilometers, 10) / 1000000),
			randomObjectDiameter: Math.floor((randomObject.estimated_diameter.meters.estimated_diameter_max + randomObject.estimated_diameter.meters.estimated_diameter_min) / 2)
		});
	}
	// if the list is empty, return a random invented object
	return Promise.resolve({
		count: 1,
		randomObjectName: RandomUtils.draftbotRandom.pick(SpaceConstants.INVENTED_ASTEROIDS_NAMES),
		randomObjectDistance: RandomUtils.rangedInt(SpaceConstants.DISTANCE_RANGE),
		randomObjectDiameter: RandomUtils.rangedInt(SpaceConstants.DIAMETER_RANGE)
	});
}

/**
 * Gives when the next moon phase is occurring
 * @param translationModule
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function moonPhase(translationModule: TranslationModule): Promise<Record<string, unknown>> {
	return Promise.resolve({
		// eslint-disable-next-line new-cap
		moonPhase: translationModule.getFromArray("moonPhases", SearchMoonQuarter(new Date()).quarter)
	});
}

/**
 * Gives when the next full moon is occurring
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function nextFullMoon(): Promise<Record<string, unknown>> {
	let days = 0;
	const currDate = new Date();
	// eslint-disable-next-line new-cap
	let currDegrees = MoonPhase(currDate);
	// eslint-disable-next-line new-cap
	let nextDegrees = MoonPhase(new Date(currDate.getDate() + 1));
	while (!(currDegrees <= 180 && nextDegrees > 180)) {
		currDegrees = nextDegrees;
		currDate.setDate(currDate.getDate() + 1);
		// eslint-disable-next-line new-cap
		nextDegrees = MoonPhase(currDate);
		days++;
	}
	return Promise.resolve({days});
}

/**
 * Gives when the next partial lunar eclipse is coming
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function nextPartialLunarEclipse(): Promise<Record<string, unknown>> {
	// eslint-disable-next-line new-cap
	let eclipse = SearchLunarEclipse(new Date());
	for (; ;) {
		if (eclipse.kind === "partial") {
			break;
		}
		// eslint-disable-next-line new-cap
		eclipse = NextLunarEclipse(eclipse.peak);
	}
	return Promise.resolve({
		days: Math.floor((eclipse.peak.date.valueOf() - new Date().valueOf()) / (1000 * 3600 * 24))
	});
}

/**
 * Gives when the next total lunar eclipse is coming
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function nextTotalLunarEclipse(): Promise<Record<string, unknown>> {
	// eslint-disable-next-line new-cap
	let eclipse = SearchLunarEclipse(new Date());
	for (; ;) {
		if (eclipse.kind === "total") {
			break;
		}
		// eslint-disable-next-line new-cap
		eclipse = NextLunarEclipse(eclipse.peak);
	}
	return Promise.resolve({
		days: Math.floor((eclipse.peak.date.valueOf() - new Date().valueOf()) / (1000 * 3600 * 24))
	});
}

export const smallEvent: SmallEvent = {
	/**
	 * No restrictions on who can do it
	 */
	canBeExecuted(): Promise<boolean> {
		return Promise.resolve(true);
	},

	/**
	 * Throws a random, verified by the NASA, fact about the surrounding space
	 */
	async executeSmallEvent(interaction: CommandInteraction, language: string, player: Player, seEmbed: DraftBotEmbed) {
		let keysList = Translations.getModule("smallEvents.space", language).getKeys("specific");
		if ((await nextFullMoon()).days === 0) {
			keysList = keysList.filter(e => e !== "nextFullMoon");
		}

		const spaceTranslationModule = Translations.getModule("smallEvents.space", language);
		const name = spaceTranslationModule.getRandom("names");
		const seIntro = Translations.getModule("smallEventsIntros", language).getRandom("intro");
		const intro = format(spaceTranslationModule.getRandom("intro"), {name});
		const searchAction = spaceTranslationModule.getRandom("searchAction");
		const search = spaceTranslationModule.getRandom("search");
		const actionIntro = spaceTranslationModule.getRandom("actionIntro");
		const action = spaceTranslationModule.getRandom("action");
		const outro = spaceTranslationModule.getRandom("outro");

		const baseDescription = seEmbed.data.description;
		const messageBefore = format(spaceTranslationModule.get("before_search_format"), {
			seIntro, intro, searchAction, search
		});
		seEmbed.setDescription(baseDescription + messageBefore);
		interaction.editReply({embeds: [seEmbed]}).then(async (sentMessage) => {
			const waitTime = SpaceConstants.WAIT_TIME_BEFORE_SEARCH;
			const t0 = performance.now();
			await SpaceUtils.getNeoWSFeed(botConfig.NASA_API_KEY);
			const specificEvent = RandomUtils.draftbotRandom.pick(keysList);
			eval(`${specificEvent}(spaceTranslationModule)`).then((replacements: Record<string, string | number | boolean>) => {
				const specific = format(spaceTranslationModule.getRandom(`specific.${specificEvent}`), replacements);
				const t1 = performance.now();
				const timeLeft = waitTime - (t1 - t0);
				const messageAfter = format(spaceTranslationModule.get("after_search_format"), {
					seIntro, intro, searchAction, search, actionIntro, action, outro, specific
				});
				/**
				 * Callback of the space small event
				 */
				const callBack = async (): Promise<void> => {
					seEmbed.setDescription(baseDescription + messageAfter);
					await (sentMessage as Message).edit({embeds: [seEmbed]});
				};
				if (timeLeft <= 0) {
					callBack().then();
				}
				else {
					setTimeout(async function() {
						await callBack();
					}, timeLeft);
				}
			});
		});
	}
};