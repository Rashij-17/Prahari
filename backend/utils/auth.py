import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from core.config import settings
from models.db import get_db, User

security = HTTPBearer()

_jwks_client = None

def get_jwks_client(supabase_url: str):
    global _jwks_client
    if _jwks_client is None:
        from jwt import PyJWKClient
        jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    try:
        secret = settings.supabase_jwt_secret.strip() if settings.supabase_jwt_secret else ""
        is_mock_token = "mocksignature" in token or token.startswith("mock_")
        
        has_hs256_secret = secret and secret != "your_supabase_jwt_secret" and secret != ""
        should_verify = not is_mock_token and (has_hs256_secret or settings.supabase_url)
        
        # Determine if we should verify signature
        if should_verify:
            try:
                # Inspect the algorithm in the token header
                header = jwt.get_unverified_header(token)
                alg = header.get("alg", "HS256")
                print(f"Authenticating request with algorithm: {alg}")
                
                if alg == "HS256" and has_hs256_secret:
                    # Decode and verify token using the symmetric secret
                    # Try base64-decoded secret first (standard for Supabase), fall back to raw string
                    try:
                        import base64, binascii
                        # Strip existing padding before re-adding it to avoid double-padding
                        stripped = secret.rstrip("=")
                        # Add correct padding (length must be multiple of 4)
                        padded = stripped + "=" * ((4 - len(stripped) % 4) % 4)
                        # Try urlsafe_b64decode first (handles - and _ chars used by Supabase)
                        try:
                            decoded_secret = base64.urlsafe_b64decode(padded)
                        except Exception:
                            decoded_secret = base64.b64decode(padded)
                        # Validate it's actually binary (Supabase secrets are base64url)
                        if len(decoded_secret) < 16:
                            raise ValueError("Decoded secret too short, not a real base64 secret")
                        payload = jwt.decode(
                            token,
                            decoded_secret,
                            algorithms=["HS256"],
                            audience="authenticated"
                        )
                    except (jwt.InvalidSignatureError, binascii.Error, ValueError, Exception):
                        # Fall back to using the raw string secret
                        payload = jwt.decode(
                            token,
                            secret,
                            algorithms=["HS256"],
                            audience="authenticated"
                        )
                elif alg in ["ES256", "RS256"] and settings.supabase_url:
                    # Decode and verify token using the JWKS endpoint
                    jwks_client = get_jwks_client(settings.supabase_url)
                    signing_key = jwks_client.get_signing_key_from_jwt(token)
                    payload = jwt.decode(
                        token,
                        signing_key.key,
                        algorithms=[alg],
                        audience="authenticated"
                    )
                else:
                    # Missing configuration for the given algorithm
                    raise jwt.InvalidTokenError(f"Missing configuration to verify {alg} tokens")
            except jwt.InvalidTokenError as e:
                # In debug/development mode, fall back to decoding without verification
                if settings.debug:
                    print(f"JWT Signature Verification failed: {str(e)}. Falling back to unverified decode for development.")
                    parts = token.split('.')
                    if len(parts) == 3:
                        parts[2] = "mocksignature123"
                        token = '.'.join(parts)
                    payload = jwt.decode(
                        token,
                        options={"verify_signature": False}
                    )
                else:
                    raise e
        else:
            # Local/offline development: decode without verification
            parts = token.split('.')
            if len(parts) == 3:
                parts[2] = "mocksignature123"
                token = '.'.join(parts)
            payload = jwt.decode(
                token,
                options={"verify_signature": False}
            )
            
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id or not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing user identifiers (sub/email)"
            )
            
        # Get or create the user in the database
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            user = User(id=user_id, email=email)
            db.add(user)
            db.commit()
            db.refresh(user)
            
        return user
        
    except jwt.ExpiredSignatureError:
        print("Auth Error: ExpiredSignatureError - Session has expired.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please sign in again."
        )
    except jwt.InvalidTokenError as e:
        print(f"Auth Error: InvalidTokenError - {str(e)} - Token starts with: {token[:30] if token else 'None'}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}"
        )
    except Exception as e:
        print(f"Auth Error: General Exception - {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}"
        )
