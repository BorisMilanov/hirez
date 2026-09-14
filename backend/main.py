from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import os

import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


DATABASE_URL = "sqlite:///./auth.db"
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-before-deployment")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer()


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: int
    email: EmailStr


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


def get_db():
    database = SessionLocal()
    try:
        yield database
    finally:
        database.close()


def public_user(user: User) -> UserResponse:
    return UserResponse(id=user.id, email=user.email)


def create_token(user: User) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": str(user.id), "exp": expires_at}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    database: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from error

    user = database.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Auth API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(credentials: Credentials, database: Session = Depends(get_db)):
    email = str(credentials.email).lower()
    existing_user = database.scalar(select(User).where(User.email == email))
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")

    user = User(email=email, password_hash=password_hash.hash(credentials.password))
    database.add(user)
    database.commit()
    database.refresh(user)
    return TokenResponse(access_token=create_token(user), token_type="bearer", user=public_user(user))


@app.post("/auth/login", response_model=TokenResponse)
def login(credentials: Credentials, database: Session = Depends(get_db)):
    email = str(credentials.email).lower()
    user = database.scalar(select(User).where(User.email == email))
    if user is None or not password_hash.verify(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect")
    return TokenResponse(access_token=create_token(user), token_type="bearer", user=public_user(user))


@app.get("/auth/me", response_model=UserResponse)
def get_current_user(user: User = Depends(current_user)):
    return public_user(user)
