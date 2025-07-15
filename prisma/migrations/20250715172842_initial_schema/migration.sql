-- CreateTable
CREATE TABLE "players" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "elo" BIGINT NOT NULL DEFAULT 1200,
    "is_ranked" BOOLEAN NOT NULL DEFAULT false,
    "top_10_players_played" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participants" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "match_id" BIGINT NOT NULL,
    "player" BIGINT NOT NULL,
    "smash_character" TEXT NOT NULL,
    "is_cpu" BOOLEAN NOT NULL DEFAULT false,
    "total_kos" INTEGER NOT NULL DEFAULT 0,
    "total_falls" INTEGER NOT NULL DEFAULT 0,
    "total_sds" INTEGER NOT NULL DEFAULT 0,
    "has_won" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_name_key" ON "players"("name");

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_player_fkey" FOREIGN KEY ("player") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
