-- Create users table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- To generate UUIDs if not using application-generated ones

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Create an index on email for faster lookups, though UNIQUE constraint already creates one.
-- CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Optional: Trigger to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- You can add more tables or initial data here if needed.
-- Example: Admin user (ensure to hash the password correctly if adding directly)
-- INSERT INTO users (username, email, password_hash) VALUES ('admin', 'admin@example.com', 'hashed_admin_password');

-- Create audio_files table
CREATE TABLE IF NOT EXISTS audio_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Using UUID for id as well for consistency, or SERIAL if preferred
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Must match users.id type
    s3_key VARCHAR(512) NOT NULL UNIQUE, -- s3_key should be sufficiently long and unique
    original_filename VARCHAR(255) NOT NULL, -- Store the original filename
    content_type VARCHAR(100), -- Store MIME type
    size_bytes BIGINT, -- Store file size
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audio_files_user_id ON audio_files(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_files_s3_key ON audio_files(s3_key);

-- Create audio_history table
CREATE TABLE IF NOT EXISTS audio_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size VARCHAR(50), -- Storing as VARCHAR as in frontend, consider BIGINT if only numeric bytes
    analysis_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    probability REAL NOT NULL, -- Using REAL for floating point numbers like probability
    s3_key VARCHAR(512), -- Optional: if you want to link to the stored audio file
    original_file_id UUID REFERENCES audio_files(id) ON DELETE SET NULL, -- Optional: link to the original audio_files entry
    analysis_details JSONB -- Optional: for storing detailed analysis results if any
);

CREATE INDEX IF NOT EXISTS idx_audio_history_user_id ON audio_history(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_history_analysis_date ON audio_history(analysis_date DESC);