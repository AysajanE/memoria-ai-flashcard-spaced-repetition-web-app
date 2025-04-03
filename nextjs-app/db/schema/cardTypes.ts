import { pgEnum } from 'drizzle-orm/pg-core';

export const cardTypes = pgEnum('card_type', ['qa', 'cloze']); 