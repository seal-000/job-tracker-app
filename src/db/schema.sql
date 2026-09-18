CREATE TYPE application_status AS ENUM (
    'Applied',
    'Screening',
    'Interview',
    'Offer',
    'Accepted',
    'Rejected'
);

CREATE TABLE users (
    id serial PRIMARY KEY,
    email varchar(255) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE session (
    sid varchar PRIMARY KEY,
    sess json NOT NULL,
    expire timestamp NOT NULL
);

CREATE INDEX session_expire_idx ON session (expire);

CREATE TABLE password_reset_tokens (
    user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token_hash char(64) NOT NULL UNIQUE,
    expires_at timestamp with time zone NOT NULL
);

CREATE INDEX password_reset_tokens_expires_at_idx
    ON password_reset_tokens (expires_at);

CREATE TABLE applications (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company varchar(255) NOT NULL,
    position varchar(255) NOT NULL,
    location varchar(255),
    job_url text,
    salary numeric(12, 2),
    current_status application_status DEFAULT 'Applied' NOT NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE application_status_history (
    id serial PRIMARY KEY,
    application_id integer NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    old_status application_status,
    new_status application_status NOT NULL,
    changed_at timestamp DEFAULT CURRENT_TIMESTAMP
);
