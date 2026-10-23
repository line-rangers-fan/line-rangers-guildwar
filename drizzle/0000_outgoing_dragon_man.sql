CREATE TABLE `cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `checks` (
	`gid` text NOT NULL,
	`team` text NOT NULL,
	`uid` text NOT NULL,
	`day` text NOT NULL,
	`slot` integer NOT NULL,
	`checked` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`gid`, `team`, `uid`, `day`, `slot`),
	CONSTRAINT "valid_slot" CHECK("checks"."slot" in (1,2)),
	CONSTRAINT "valid_checked" CHECK("checks"."checked" in (0,1))
);
--> statement-breakpoint
CREATE TABLE `local_guilds` (
	`gid` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rosters` (
	`gid` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`mode` text NOT NULL,
	`observed_at` text,
	`updated_at` text NOT NULL
);
