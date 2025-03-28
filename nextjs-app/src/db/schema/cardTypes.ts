import { pgEnum } from "drizzle-orm/pg-core";

export const cardTypeEnum = pgEnum("card_type", ["qa", "cloze"]);
