import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App settings
    APP_NAME: str = "Brauser IDE Backend"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS settings
    CORS_ORIGINS: list = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list = ["*"]
    CORS_ALLOW_HEADERS: list = ["*"]
    
    # Database settings (MySQL)
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = ""
    MYSQL_DATABASE: str = ""
    
    # Apache settings
    APACHE_PORT: int = 80
    APACHE_DOCUMENT_ROOT: str = "./public"
    
    # PHP settings
    PHP_PORT: int = 9000
    
    # Git settings
    GIT_DEFAULT_BRANCH: str = "main"
    
    # File system settings
    WORKSPACE_ROOT: str = str(Path.home() / "brauser-workspace")
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # Security settings
    SECRET_KEY: str = "your-secret-key-here"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()

# Ensure workspace directory exists
os.makedirs(settings.WORKSPACE_ROOT, exist_ok=True)