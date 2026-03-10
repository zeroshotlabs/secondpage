CREATE TABLE `searchResults` (
	`id` varchar(64) NOT NULL,
	`searchId` varchar(64) NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`snippet` text,
	`sourceEngine` varchar(50) NOT NULL,
	`originalPosition` int NOT NULL,
	`originalPage` int NOT NULL,
	`finalScore` int NOT NULL,
	`isDuplicate` int NOT NULL DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `searchResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `searches` (
	`id` varchar(64) NOT NULL,
	`query` varchar(500) NOT NULL,
	`pageStart` int NOT NULL DEFAULT 2,
	`pageEnd` int NOT NULL DEFAULT 4,
	`engines` text NOT NULL,
	`userId` varchar(64),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `searches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `search_idx` ON `searchResults` (`searchId`);--> statement-breakpoint
CREATE INDEX `query_idx` ON `searches` (`query`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `searches` (`userId`);
