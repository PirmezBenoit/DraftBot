/**
 * Display the inventory of the guild
 * @param {("fr"|"en")} language - Language to use in the response
 * @param {module:"discord.js".Message} message - Message from the discord server
 * @param {String[]} args=[] - Additional arguments sent with the command
 */
const GuildInventoryCommand = async (language, message, args) => {
    [entity] = await Entities.getOrRegister(message.author.id);

    if (
        (await canPerformCommand(
            message,
            language,
            PERMISSION.ROLE.ALL,
            [EFFECT.BABY, EFFECT.DEAD],
            entity
        )) !== true
    ) {
        return;
    }

    const foodInfos = JsonReader.food;
    const translations = JsonReader.commands.guildInventory.getTranslation(
        language
    );
    // search for a user's guild
    let guild;
    try {
        guild = await Guilds.getById(entity.Player.guild_id);
    } catch (error) {
        guild = null;
    }

    if (guild == null) {
        // not in a guild
        return sendErrorMessage(
            message.author,
            message.channel,
            language,
            translations.notInAguild
        );
    }

    let inventoryEmbed = new discord.MessageEmbed();

    inventoryEmbed.setTitle(
        format(translations.embedTitle, {
            guild: guild.name,
        })
    );

    inventoryEmbed.setThumbnail(JsonReader.commands.guild.icon);

    inventoryEmbed.addField(
        translations.fieldDescKey,
        translations.fieldDescValue
    );
    inventoryEmbed.addField(
        format(translations.foodTitle, {
            foodType: foodInfos.herbivorousFood.translations[language].name,
        }),
        format(translations.foodField, {
            guildFood: guild.herbivorousFood,
            maxFood: GUILD.MAX_COMMON_PETFOOD,
            emote: foodInfos.herbivorousFood.emote,
        }),
        true
    );
    inventoryEmbed.addField(
        format(translations.foodTitle, {
            foodType: foodInfos.herbivorousFood.translations[language].name,
        }),
        format(translations.foodField, {
            guildFood: guild.herbivorousFood,
            maxFood: GUILD.MAX_HERBIVOROUS_PETFOOD,
            emote: foodInfos.herbivorousFood.emote,
        }),
        true
    );
    inventoryEmbed.addField(
        format(translations.foodTitle, {
            foodType: foodInfos.carnivorousFood.translations[language].name,
        }),
        format(translations.foodField, {
            guildFood: guild.carnivorousFood,
            maxFood: GUILD.MAX_CARNIVOROUS_PETFOOD,
            emote: foodInfos.carnivorousFood.emote,
        }),
        true
    );
    inventoryEmbed.addField(
        format(translations.foodTitle, {
            foodType: foodInfos.ultimateFood.translations[language].name,
        }),
        format(translations.foodField, {
            guildFood: guild.ultimateFood,
            maxFood: GUILD.MAX_ULTIMATE_PETFOOD,
            emote: foodInfos.ultimateFood.emote,
        }),
        true
    );


    await message.channel.send(inventoryEmbed);
};

module.exports = {
    commands: [
        {
            name: "guildinventory",
            func: GuildInventoryCommand,
            aliases: ["guildinventory", "ginv"],
        },
    ],
};
