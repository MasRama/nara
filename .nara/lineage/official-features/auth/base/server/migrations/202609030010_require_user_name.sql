UPDATE users SET name = email WHERE name IS NULL;

CREATE TRIGGER users_name_required_insert
BEFORE INSERT ON users
FOR EACH ROW
WHEN NEW.name IS NULL
BEGIN
  SELECT RAISE(ABORT, 'users.name must not be null');
END;

CREATE TRIGGER users_name_required_update
BEFORE UPDATE OF name ON users
FOR EACH ROW
WHEN NEW.name IS NULL
BEGIN
  SELECT RAISE(ABORT, 'users.name must not be null');
END;
