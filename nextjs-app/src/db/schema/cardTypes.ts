/**
 * @file cardTypes.ts
 * @description
 *  Exports the pgEnum for flashcard card types: "qa", "cloze"
 */

import { pgEnum } from "drizzle-orm/pg-core";

export const cardTypeEnum = pgEnum("card_type", ["qa", "cloze"]);
