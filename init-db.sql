-- SecondPage.ai Database Initialization Script
-- Creates tables matching the Drizzle schema

-- Create users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` TEXT,
  `email` VARCHAR(320),
  `loginMethod` VARCHAR(64),
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `isAnonymous` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `lastSignedIn` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create searches table
CREATE TABLE IF NOT EXISTS `searches` (
  `id` VARCHAR(64) PRIMARY KEY,
  `query` VARCHAR(500) NOT NULL,
  `pageStart` INT NOT NULL DEFAULT 2,
  `pageEnd` INT NOT NULL DEFAULT 4,
  `engines` TEXT NOT NULL,
  `userId` VARCHAR(64),
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `query_idx` (`query`),
  INDEX `user_idx` (`userId`),
  FULLTEXT INDEX `ft_query` (`query`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create searchResults table
CREATE TABLE IF NOT EXISTS `searchResults` (
  `id` VARCHAR(64) PRIMARY KEY,
  `searchId` VARCHAR(64) NOT NULL,
  `title` TEXT NOT NULL,
  `url` TEXT NOT NULL,
  `snippet` TEXT,
  `sourceEngine` VARCHAR(50) NOT NULL,
  `originalPosition` INT NOT NULL,
  `originalPage` INT NOT NULL,
  `finalScore` INT NOT NULL,
  `isDuplicate` INT NOT NULL DEFAULT 0,
  `duplicateOf` TEXT,
  `appearances` INT NOT NULL DEFAULT 1,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `search_idx` (`searchId`),
  FULLTEXT INDEX `ft_title_snippet` (`title`, `snippet`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create engineStats table
CREATE TABLE IF NOT EXISTS `engineStats` (
  `id` VARCHAR(64) PRIMARY KEY,
  `searchId` VARCHAR(64) NOT NULL,
  `engine` VARCHAR(50) NOT NULL,
  `durationMs` INT NOT NULL,
  `success` INT NOT NULL DEFAULT 1,
  `resultCount` INT NOT NULL DEFAULT 0,
  `errorMessage` TEXT,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `engine_search_idx` (`searchId`),
  INDEX `engine_name_idx` (`engine`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
