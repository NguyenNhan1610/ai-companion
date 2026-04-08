---
paths:
  - "**/*.py"
---

# Python Security Rules

## DO
- Use `yaml.safe_load()` not `yaml.load()` for YAML parsing
- Use `json` or `msgpack` for serialization, never `pickle` with untrusted data
- Use parameterized queries: `cursor.execute("SELECT ... WHERE id=%s", [user_id])`
- Use `subprocess.run(cmd_list, shell=False)` for command execution
- Use `tempfile.NamedTemporaryFile()` not `tempfile.mktemp()` (race condition)
- Use `secrets` module for tokens/keys, never `random`
- Use `bcrypt` or `argon2` for password hashing, never MD5/SHA1
- Use `hmac.compare_digest()` for secret comparison (timing-safe)
- Use `ssl.create_default_context()` with `check_hostname=True`
- Validate paths with `PurePosixPath.relative_to()` or `os.path.commonpath()` to prevent traversal
- Use `hashlib.sha256` with salt for non-password hashing

## DON'T
- Never `pickle.loads()` / `pickle.load()` untrusted data -- arbitrary code execution
- Never use f-strings or %-formatting in SQL queries
- Never use `subprocess.run(cmd, shell=True)` with user input
- Never use `eval()` or `exec()` with any external input
- Never use `os.system()` -- use `subprocess.run()` instead
- Never use `random.random()` for security-sensitive values
- Never compare secrets with `==` (timing attack)
- Never disable TLS verification (`verify=False`)

## ANTIPATTERNS
- `pickle.loads(request.data)` -- RCE via crafted pickle payload
- `cursor.execute(f"SELECT * FROM users WHERE id={user_id}")` -- SQL injection
- `subprocess.run(f"convert {user_filename}", shell=True)` -- command injection
- `eval(user_expression)` -- arbitrary code execution
- `token = str(random.randint(0, 999999))` -- predictable tokens
- `if secret == user_input:` -- timing side channel
- `os.path.join(base_dir, user_path)` without validation -- `../../../etc/passwd` traversal
