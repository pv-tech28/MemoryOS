
import secrets

# Generate a secure 32-byte secret key
secret_key = secrets.token_hex(32)
print(f"Generated SESSION_SECRET_KEY: {secret_key}")
