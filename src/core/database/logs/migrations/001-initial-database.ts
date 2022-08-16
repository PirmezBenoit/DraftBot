import {DataTypes, QueryInterface} from "sequelize";

export const logsPlayerNumberAttributes = {
	playerId: DataTypes.INTEGER,
	value: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	reason: {
		type: DataTypes.TINYINT.UNSIGNED,
		allowNull: false
	},
	date: {
		type: DataTypes.INTEGER.UNSIGNED,
		allowNull: false
	}
};

export async function up({context}: { context: QueryInterface }): Promise<void> {
	await context.createTable("players", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		discordId: {
			type: DataTypes.STRING(20), // eslint-disable-line new-cap
			allowNull: false
		}
	});
	await context.createTable("players_money", logsPlayerNumberAttributes);
	await context.createTable("players_health", logsPlayerNumberAttributes);
	await context.createTable("players_experience", logsPlayerNumberAttributes);
	await context.createTable("players_score", logsPlayerNumberAttributes);
	await context.createTable("players_gems", logsPlayerNumberAttributes);
	await context.createTable("players_level", {
		playerId: DataTypes.INTEGER,
		level: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
}

export async function down(context: QueryInterface): Promise<void> {
	await context.dropTable("players");
	await context.dropTable("players_money");
	await context.dropTable("players_health");
	await context.dropTable("players_experience");
	await context.dropTable("players_level");
	await context.dropTable("players_score");
	await context.dropTable("players_gems");
}