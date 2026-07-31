-- =====================================================================
-- COMPUTERIZED CRIME TRACKING INFORMATION SYSTEM
-- Case Study: Nigerian Police, Ikot Udota, Eket
-- Database: MySQL
-- =====================================================================

CREATE DATABASE IF NOT EXISTS crime_tracking_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE crime_tracking_db;

-- ---------------------------------------------------------------------
-- USERS TABLE  (Admin / IPO - Investigating Police Officer / DCO - Divisional Crime Officer)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  badge_number    VARCHAR(30)  NOT NULL UNIQUE,
  full_name       VARCHAR(120) NOT NULL,
  username        VARCHAR(60)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('admin','ipo','dco') NOT NULL DEFAULT 'ipo',
  officer_rank    VARCHAR(60),
  station         VARCHAR(120) DEFAULT 'Ikot Udota Division, Eket',
  phone           VARCHAR(20),
  is_active       TINYINT(1) DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- CRIME RECORDS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE crimes (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  case_number        VARCHAR(40) NOT NULL UNIQUE,
  crime_type         VARCHAR(100) NOT NULL,
  description        TEXT,
  location            VARCHAR(200),
  date_occurred      DATE,
  date_reported      DATE NOT NULL,
  victim_name        VARCHAR(120),
  victim_gender      ENUM('male','female','unknown') DEFAULT 'unknown',
  victim_phone       VARCHAR(20),
  status             ENUM('open','under_investigation','closed','in_court') NOT NULL DEFAULT 'open',
  reported_by        INT,                         -- user who registered the record
  assigned_officer_id INT,                        -- IPO/DCO assigned to investigate
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_officer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- SUSPECTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE suspects (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  crime_id       INT NOT NULL,
  full_name      VARCHAR(120) NOT NULL,
  alias          VARCHAR(120),
  gender         ENUM('male','female','unknown') DEFAULT 'unknown',
  age            INT,
  address        VARCHAR(200),
  phone          VARCHAR(20),
  national_id    VARCHAR(40),         -- NIN / other identifier
  status         ENUM('at_large','arrested','released','convicted','deceased') DEFAULT 'at_large',
  photo_path     VARCHAR(255),
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (crime_id) REFERENCES crimes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- INVESTIGATING OFFICERS ASSIGNMENT LOG (many officers can touch one case over time)
-- ---------------------------------------------------------------------
CREATE TABLE investigations (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  crime_id      INT NOT NULL,
  officer_id    INT NOT NULL,
  role_on_case  ENUM('lead','support') DEFAULT 'lead',
  remarks       TEXT,
  assigned_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (crime_id) REFERENCES crimes(id) ON DELETE CASCADE,
  FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- COURT RECORDS TABLE (Case Tracking Module)
-- ---------------------------------------------------------------------
CREATE TABLE court_records (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  crime_id       INT NOT NULL,
  suspect_id     INT,
  court_name     VARCHAR(150),
  case_file_no   VARCHAR(60),
  judge_name     VARCHAR(120),
  hearing_date   DATE,
  verdict        ENUM('pending','guilty','not_guilty','dismissed','adjourned') DEFAULT 'pending',
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (crime_id) REFERENCES crimes(id) ON DELETE CASCADE,
  FOREIGN KEY (suspect_id) REFERENCES suspects(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- REPORTS LOG TABLE (records every generated report for audit purposes)
-- ---------------------------------------------------------------------
CREATE TABLE reports (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  report_type   VARCHAR(60) NOT NULL,     -- daily | monthly | gender | status | custom
  generated_by  INT,
  date_from     DATE,
  date_to       DATE,
  parameters    JSON,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- AUDIT TRAIL TABLE (Business Logic Layer requirement)
-- ---------------------------------------------------------------------
CREATE TABLE audit_trail (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT,
  action        VARCHAR(100) NOT NULL,
  entity_type   VARCHAR(60),
  entity_id     INT,
  details       TEXT,
  ip_address    VARCHAR(45),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Helpful indexes for search & reporting
-- ---------------------------------------------------------------------
CREATE INDEX idx_crimes_status ON crimes(status);
CREATE INDEX idx_crimes_date_reported ON crimes(date_reported);
CREATE INDEX idx_crimes_type ON crimes(crime_type);
CREATE INDEX idx_suspects_status ON suspects(status);
CREATE INDEX idx_suspects_gender ON suspects(gender);
CREATE FULLTEXT INDEX idx_crimes_search ON crimes(crime_type, description, location, victim_name);
CREATE FULLTEXT INDEX idx_suspects_search ON suspects(full_name, alias, address);

-- ---------------------------------------------------------------------
-- Seed default admin account
-- Username: admin   Password: Admin@123  (bcrypt hash generated at seed-time, see seed.js)
-- ---------------------------------------------------------------------
