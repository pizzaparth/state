import { pgTable, text, integer, index } from "drizzle-orm/pg-core";
import { boards } from "./boards";

export const columns = pgTable(
  "columns",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    boardId: text("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    stateType: text("state_type").notNull().default("backlog"), // "backlog" | "active" | "review" | "done" (done = terminal, triggers commit)
  },
  (table) => [
    index("columns_board_idx").on(table.boardId, table.position),
  ]
);
