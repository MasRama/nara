import { Knex } from "knex";
import Authenticate from "../app/services/Authenticate";
import dayjs from "dayjs";
import { randomUUID } from "crypto";

export async function seed(knex: Knex): Promise<void> {
	await knex("users").del();

	const password = await Authenticate.hash("nara");

	await knex("users").insert([
		{
			id: randomUUID(),
			name: "Nara",
			email: "nara@ramaren.com",
			phone: null,
			is_verified: false,
			membership_date: null,
			is_admin: false,
			password: password,
			remember_me_token: null,
			created_at: dayjs().valueOf(),
			updated_at: dayjs().valueOf(),
		},
	]);
};
