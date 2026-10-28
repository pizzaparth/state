import { pgTable, text, integer } from "drizzle-orm/pg-core";
import { boards } from "./boards";

export const columns = pgTable("columns", {
  id: text("id").primaryKey(),
  boardId: text("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  stateType: text("state_type").notNull().default("backlog"), // "backlog" | "active" | "review" | "done"
});
